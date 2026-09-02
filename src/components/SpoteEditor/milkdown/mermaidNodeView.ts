import type { Node as ProseNode } from '@milkdown/prose/model'
import { TextSelection } from '@milkdown/prose/state'
import type { EditorView, NodeView, ViewMutationRecord } from '@milkdown/prose/view'
import { renderMermaid, parseMermaid } from './mermaidRenderer'
import type { MermaidTheme } from './mermaidRenderer'

export const MERMAID_LANGUAGE = 'mermaid'

export function isMermaidBlock(node: ProseNode): boolean {
  return node.type.name === 'code_block' && node.attrs.language === MERMAID_LANGUAGE
}

export interface CodeBlockNodeViewOptions {
  getTheme: () => MermaidTheme
  onZoom: (svg: string) => void
}

/**
 * A node view for `code_block`.
 *
 * ProseMirror has no way to decline a node view for a particular node, so this is
 * constructed for every code block and mirrors the commonmark preset's default DOM
 * (`pre > code`, with `data-language` when set) when the language is not `mermaid`.
 * In that case it is a no-op wrapper.
 *
 * For a mermaid block the code lives in the same `pre`, hidden by CSS, with a preview
 * container beside it. Which one is visible is driven by `data-state`, which this
 * class owns and derives from both the selection and DOM focus — see `sync()`. The
 * mermaid plugin's decoration (`mermaidPlugin.ts`) only carries the theme and a
 * selection-derived attribute that exists to make `update()` fire; it does not set
 * `data-state` itself, since it never has a `view` to check focus with.
 */
export class CodeBlockNodeView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement

  private figure: HTMLElement | null = null
  private renderToken = 0
  private lastCode: string | null = null
  private lastTheme: MermaidTheme | null = null
  private status: HTMLElement | null = null
  private parseTimer: ReturnType<typeof setTimeout> | null = null
  // Edit state needs DOM focus as well as selection: `view.state.selection` alone
  // can't tell "the user clicked in" from ProseMirror's own default cursor
  // placement (`Selection.atStart`), which can land inside this very block before
  // anyone has touched the document. Tracked here, not in the decoration, because
  // only the node view holds a reference to `view` to ask it.
  private focused = false
  private onFocus: (() => void) | null = null
  private onBlur: (() => void) | null = null

  constructor(
    private node: ProseNode,
    private view: EditorView,
    private getPos: () => number | undefined,
    private options: CodeBlockNodeViewOptions,
  ) {
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    pre.appendChild(code)
    // Assumes the commonmark preset's `codeBlockAttr` is `{}` (the default). If that is
    // ever customized, this hardcoded `pre > code` shape would silently diverge from it.
    if (node.attrs.language) pre.dataset.language = node.attrs.language as string
    this.contentDOM = code

    if (!isMermaidBlock(node)) {
      this.dom = pre
      return
    }

    const wrap = document.createElement('div')
    wrap.className = 'spote-mermaid'

    const preview = document.createElement('div')
    preview.className = 'spote-mermaid__preview'
    // Keeps ProseMirror from treating the injected SVG as editable document content.
    preview.contentEditable = 'false'

    const figure = document.createElement('div')
    figure.className = 'spote-mermaid__figure'
    preview.appendChild(figure)
    this.figure = figure

    // Clicking the diagram moves the cursor into the block and focuses the view;
    // `sync()` then flips `data-state` and the CSS reveals the code. No toggle
    // state to keep in sync — both selection and focus are read live from `view`.
    preview.addEventListener('mousedown', (event) => this.enterEdit(event))

    const status = document.createElement('div')
    status.className = 'spote-mermaid__status'
    status.contentEditable = 'false'
    this.status = status

    wrap.append(preview, pre, status)
    this.dom = wrap

    this.focused = this.view.hasFocus()
    this.onFocus = () => { this.focused = true; this.sync() }
    this.onBlur = () => { this.focused = false; this.sync() }
    this.view.dom.addEventListener('focus', this.onFocus)
    this.view.dom.addEventListener('blur', this.onBlur)

    this.sync()
  }

  update(node: ProseNode): boolean {
    if (node.type !== this.node.type) return false
    // A language change flips the whole DOM shape; let ProseMirror rebuild instead.
    if (isMermaidBlock(node) !== isMermaidBlock(this.node)) return false
    this.node = node
    if (!isMermaidBlock(node)) return true
    this.sync()
    return true
  }

  /** Mutations outside `contentDOM` are our own rendered SVG, not user edits. */
  ignoreMutation(mutation: ViewMutationRecord): boolean {
    return !this.contentDOM.contains(mutation.target)
  }

  /** ProseMirror must not handle events inside the preview — we handle them. */
  stopEvent(event: Event): boolean {
    const target = event.target
    return target instanceof Node ? !this.contentDOM.contains(target) : false
  }

  destroy(): void {
    // Invalidate any in-flight render so it cannot write to detached DOM.
    this.renderToken++
    this.clearParse()
    if (this.onFocus) this.view.dom.removeEventListener('focus', this.onFocus)
    if (this.onBlur) this.view.dom.removeEventListener('blur', this.onBlur)
  }

  private enterEdit(event: MouseEvent): void {
    if (!this.view.editable) return
    event.preventDefault()
    const pos = this.getPos()
    if (pos == null) return
    const { state } = this.view
    // pos + 1 is just inside the code block's text content.
    this.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, pos + 1)))
    this.view.focus()
  }

  private isEditing(): boolean {
    const pos = this.getPos()
    if (pos == null) return false
    const { from, to } = this.view.state.selection
    return from >= pos && to <= pos + this.node.nodeSize
  }

  private sync(): void {
    const editing = this.focused && this.isEditing()
    this.dom.dataset.state = editing ? 'edit' : 'preview'
    if (editing) {
      this.scheduleParse(this.node.textContent)
      return
    }
    this.clearParse()
    if (this.status) this.status.textContent = ''
    const code = this.node.textContent
    const theme = this.options.getTheme()
    if (code === this.lastCode && theme === this.lastTheme) return
    this.lastCode = code
    this.lastTheme = theme
    void this.renderNow(code, theme)
  }

  /**
   * While the cursor is in the block we don't re-render — a full render per keystroke
   * is wasteful. A debounced syntax check gives the same feedback for far less work.
   */
  private scheduleParse(code: string): void {
    this.clearParse()
    this.parseTimer = setTimeout(() => {
      void parseMermaid(code).then((result) => {
        if (!this.status) return
        this.status.textContent = result.ok ? '' : `⚠ ${result.message}`
        this.status.classList.toggle('is-error', !result.ok)
      })
    }, 250)
  }

  private clearParse(): void {
    if (this.parseTimer == null) return
    clearTimeout(this.parseTimer)
    this.parseTimer = null
  }

  private async renderNow(code: string, theme: MermaidTheme): Promise<void> {
    const token = ++this.renderToken
    const result = await renderMermaid(code, theme)
    // A newer render started, or the view was destroyed, while we awaited.
    if (token !== this.renderToken) return
    const figure = this.figure
    if (!figure) return
    if (result.ok) {
      figure.classList.remove('is-error')
      figure.innerHTML = result.svg
    } else {
      figure.classList.add('is-error')
      figure.textContent = result.message
    }
  }
}

import type { Node as ProseNode } from '@milkdown/prose/model'
import type { EditorView, NodeView, ViewMutationRecord } from '@milkdown/prose/view'
import { renderMermaid } from './mermaidRenderer'
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
 * container beside it. Which one is visible is driven entirely by `data-state`, set
 * from the selection — see `mermaidPlugin.ts`.
 */
export class CodeBlockNodeView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement

  private figure: HTMLElement | null = null
  private renderToken = 0
  private lastCode: string | null = null
  private lastTheme: MermaidTheme | null = null

  constructor(
    private node: ProseNode,
    private view: EditorView,
    private getPos: () => number | undefined,
    private options: CodeBlockNodeViewOptions,
  ) {
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    pre.appendChild(code)
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

    wrap.append(preview, pre)
    this.dom = wrap
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

  destroy(): void {
    // Invalidate any in-flight render so it cannot write to detached DOM.
    this.renderToken++
  }

  private sync(): void {
    const code = this.node.textContent
    const theme = this.options.getTheme()
    if (code === this.lastCode && theme === this.lastTheme) return
    this.lastCode = code
    this.lastTheme = theme
    void this.renderNow(code, theme)
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

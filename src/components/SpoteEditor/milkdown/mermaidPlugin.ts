import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import { CodeBlockNodeView, isMermaidBlock } from './mermaidNodeView'
import type { MermaidTheme } from './mermaidRenderer'

interface MermaidPluginState {
  theme: MermaidTheme
  // Latches true the first time a transaction actually sets the selection
  // (`tr.selectionSet`) and never goes back to false. ProseMirror's own default
  // selection (`Selection.atStart(doc)`) is not the product of any transaction, so
  // this is what tells a real user action — a click, an arrow key, a keystroke —
  // apart from that placeholder, or from `view.focus()` alone (which dispatches no
  // transaction and so cannot set this). See `mermaidNodeView.ts`'s `sync()`.
  selectionMoved: boolean
}

export const mermaidPluginKey = new PluginKey<MermaidPluginState>('spote-mermaid')

/** Transaction meta key used to push a new theme into the plugin's state. */
export const SET_MERMAID_THEME = 'spote-mermaid-set-theme'

export interface MermaidPluginOptions {
  initialTheme: MermaidTheme
  onZoom: (svg: string) => void
}

/**
 * Registers the code-block node view and holds the diagram theme.
 *
 * The theme lives in plugin state rather than a closure so a theme change is an
 * ordinary transaction — see Task 5 / `MilkdownEditor`.
 */
export function createMermaidPlugin(options: MermaidPluginOptions): Plugin<MermaidPluginState> {
  let currentTheme = options.initialTheme
  let currentSelectionMoved = false
  return new Plugin<MermaidPluginState>({
    key: mermaidPluginKey,
    state: {
      init: () => ({ theme: options.initialTheme, selectionMoved: false }),
      apply: (tr, value) => {
        const nextTheme = (tr.getMeta(SET_MERMAID_THEME) as MermaidTheme | undefined) ?? value.theme
        if (nextTheme !== value.theme) currentTheme = nextTheme
        const selectionMoved = value.selectionMoved || tr.selectionSet
        if (selectionMoved) currentSelectionMoved = true
        if (nextTheme === value.theme && selectionMoved === value.selectionMoved) return value
        return { theme: nextTheme, selectionMoved }
      },
    },
    props: {
      nodeViews: {
        code_block: (node, view, getPos) =>
          new CodeBlockNodeView(node, view, getPos, {
            getTheme: () => currentTheme,
            getSelectionMoved: () => currentSelectionMoved,
            onZoom: options.onZoom,
          }),
      },
      /**
       * One node decoration per mermaid block. These attributes do not drive the
       * CSS — the node view owns `data-state` (see `mermaidNodeView.ts`), because
       * edit state also depends on DOM focus, which this callback cannot see (it
       * receives only `state`, never `view`). `data-selected` exists purely to make
       * the decoration set differ whenever the selection moves, which is what
       * guarantees the node view's `update()` runs; `data-theme` carries the theme.
       */
      decorations(state) {
        const theme = mermaidPluginKey.getState(state)?.theme ?? 'light'
        const decorations: Decoration[] = []
        state.doc.descendants((node, pos) => {
          if (node.type.name !== 'code_block') return true
          if (!isMermaidBlock(node)) return false
          const { from, to } = state.selection
          const editing = from >= pos && to <= pos + node.nodeSize
          decorations.push(
            Decoration.node(pos, pos + node.nodeSize, {
              'data-selected': editing ? 'true' : 'false',
              'data-theme': theme,
            }),
          )
          return false
        })
        return DecorationSet.create(state.doc, decorations)
      },
    },
  })
}

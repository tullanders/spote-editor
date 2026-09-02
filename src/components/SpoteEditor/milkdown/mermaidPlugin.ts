import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import { CodeBlockNodeView, isMermaidBlock, isSelectionInsideBlock } from './mermaidNodeView'
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

// Transaction meta key that forces `selectionMoved` back to false. Dispatched right
// after a controlled reconcile (`replaceAll`) swaps the document out from under the
// user: `tr.replace(0, size, slice)` does not set `selectionSet`, so the latch would
// otherwise survive into a document the user never touched, and ProseMirror's mapped
// cursor could land inside a mermaid block there — opening it with no user action.
// See `MilkdownEditor.tsx`'s controlled reconcile effect.
export const RESET_MERMAID_SELECTION = 'spote-mermaid-reset-selection'

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
  return new Plugin<MermaidPluginState>({
    key: mermaidPluginKey,
    state: {
      init: () => ({ theme: options.initialTheme, selectionMoved: false }),
      apply: (tr, value) => {
        const nextTheme = (tr.getMeta(SET_MERMAID_THEME) as MermaidTheme | undefined) ?? value.theme
        const selectionMoved = tr.getMeta(RESET_MERMAID_SELECTION) === true
          ? false
          : value.selectionMoved || tr.selectionSet
        if (nextTheme === value.theme && selectionMoved === value.selectionMoved) return value
        return { theme: nextTheme, selectionMoved }
      },
    },
    props: {
      nodeViews: {
        code_block: (node, view, getPos) =>
          new CodeBlockNodeView(node, view, getPos, {
            getTheme: () => mermaidPluginKey.getState(view.state)?.theme ?? 'light',
            getSelectionMoved: () => mermaidPluginKey.getState(view.state)?.selectionMoved ?? false,
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
       *
       * `data-selected` also factors in `selectionMoved`, not just raw selection
       * position: `RESET_MERMAID_SELECTION` changes plugin state without touching
       * the document or the selection itself, so if this ignored the latch the
       * decoration set would come out byte-for-byte identical to the transaction
       * before it. ProseMirror's diffing skips calling `update()` on node views
       * whose node and decorations are both unchanged, so the reset would silently
       * fail to reach the node view — the exact same reasoning that puts the theme
       * in this decoration rather than a closure.
       */
      decorations(state) {
        const pluginState = mermaidPluginKey.getState(state)
        const theme = pluginState?.theme ?? 'light'
        const selectionMoved = pluginState?.selectionMoved ?? false
        const decorations: Decoration[] = []
        state.doc.descendants((node, pos) => {
          if (node.type.name !== 'code_block') return true
          if (!isMermaidBlock(node)) return false
          const { from, to } = state.selection
          const editing = selectionMoved && isSelectionInsideBlock(pos, node.nodeSize, from, to)
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

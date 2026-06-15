import { Plugin, PluginKey } from '@milkdown/prose/state'
import type { EditorView } from '@milkdown/prose/view'
import { shouldTriggerSlash } from '../codemirror/slashExtension'

export interface SlashCoords { x: number; y: number }

export interface SlashCallbacks {
  /** `triggerPos` is the document position of the typed `/` character. */
  onOpen: (coords: SlashCoords, triggerPos: number) => void
  onQuery: (query: string) => void
  onClose: () => void
}

export const slashPluginKey = new PluginKey('spote-slash')

/** Caret coords (top/left) for the current selection head, in viewport space. */
function caretCoords(view: EditorView): SlashCoords {
  const rect = view.coordsAtPos(view.state.selection.from)
  return { x: rect.left, y: rect.bottom }
}

/** Text in the current textblock from its start up to (not including) `pos`. */
function textBlockBefore(view: EditorView, pos: number): string {
  const $pos = view.state.doc.resolve(pos)
  const start = $pos.start()
  return view.state.doc.textBetween(start, pos, '\n', '\n')
}

/**
 * ProseMirror plugin mirroring the CodeMirror slash extension. Detects a `/`
 * typed at the start of a textblock or after whitespace, then tracks the query
 * after the trigger. Closes when the query contains whitespace or the cursor
 * moves at/before the trigger position.
 *
 * `triggerPos` is the document position of the `/` character itself.
 */
export function createSlashPlugin(cb: SlashCallbacks): Plugin {
  let triggerPos: number | null = null
  // Position of a '/' just typed, awaiting the post-update tick where the doc
  // is committed and `coordsAtPos` returns the caret rect after the character.
  let pendingTriggerPos: number | null = null

  return new Plugin({
    key: slashPluginKey,
    props: {
      // `handleTextInput` fires before insertion: the selection and preceding
      // text are exactly what the trigger predicate needs. We open in the
      // plugin's `update` (below) so caret coords reflect the inserted '/'.
      handleTextInput(view, _from, _to, text) {
        if (text !== '/') return false
        const before = textBlockBefore(view, view.state.selection.from)
        if (shouldTriggerSlash('/', before)) {
          pendingTriggerPos = view.state.selection.from
        }
        return false
      },
    },
    view() {
      return {
        update(view) {
          // Open on the tick after a '/' was accepted by the predicate.
          if (pendingTriggerPos != null) {
            triggerPos = pendingTriggerPos
            pendingTriggerPos = null
            cb.onOpen(caretCoords(view), triggerPos)
            return
          }
          if (triggerPos == null) return
          const head = view.state.selection.from
          // Cursor moved to/before the trigger -> close.
          if (head <= triggerPos) { triggerPos = null; cb.onClose(); return }
          const query = view.state.doc.textBetween(triggerPos + 1, head, '\n', '\n')
          if (/\s/.test(query)) { triggerPos = null; cb.onClose(); return }
          cb.onQuery(query)
        },
      }
    },
  })
}

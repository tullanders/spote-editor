import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export const WRAP_CHARS = ['*', '_', '`', '~'] as const
export type WrapChar = (typeof WRAP_CHARS)[number]

function isWrapChar(ch: string): ch is WrapChar {
  return (WRAP_CHARS as readonly string[]).includes(ch)
}

// Detect that the selection is already directly wrapped by `ch` so we can re-wrap
// (e.g. *sel* -> **sel**). Only meaningful for '*' and '~' but harmless for others.
function isAlreadyWrapped(state: EditorState, from: number, to: number, ch: string): boolean {
  if (from < 1 || to > state.doc.length - 1) return false
  return state.sliceDoc(from - 1, from) === ch && state.sliceDoc(to, to + 1) === ch
}

/**
 * Returns a TransactionSpec that wraps each non-empty selection range with `ch`,
 * preserving the selection. Returns null when there is nothing to wrap (empty
 * selection or non-wrap char) so the caller can fall back to default insertion.
 */
export function wrapTransactionFor(state: EditorState, ch: string): TransactionSpec | null {
  if (!isWrapChar(ch)) return null
  if (state.selection.ranges.every((r) => r.empty)) return null

  const marker = ch
  const changes = state.changeByRange((range) => {
    if (range.empty) {
      return { range, changes: { from: range.from, insert: ch } }
    }
    const reWrap = isAlreadyWrapped(state, range.from, range.to, ch)
    const insert = marker
    const startInsertAt = reWrap ? range.from - 1 : range.from
    const endInsertAt = reWrap ? range.to + 1 : range.to
    return {
      changes: [
        { from: startInsertAt, insert },
        { from: endInsertAt, insert },
      ],
      // Selection shifts right by one marker char on the left side.
      // changeByRange ranges are in NEW document coordinates.
      range: EditorSelection.range(range.from + insert.length, range.to + insert.length),
    }
  })
  return changes
}

/** CodeMirror input handler that applies wrap-on-type. */
export const wrapOnType = EditorView.inputHandler.of(
  (view, _from, _to, text, _insert) => {
    if (text.length !== 1) return false
    const spec = wrapTransactionFor(view.state, text)
    if (!spec) return false
    view.dispatch(spec)
    return true
  }
)

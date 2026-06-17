import { keymap, type EditorView, type KeyBinding } from '@codemirror/view'
import { applyAction } from './applyAction'

type Mark = 'strong' | 'emphasis' | 'inlineCode'

/**
 * Keyboard shortcuts for inline marks in the raw (CodeMirror) editor, mirroring
 * Milkdown's commonmark defaults. `Mod` is Cmd on macOS, Ctrl elsewhere.
 */
export const MARK_SHORTCUTS: { key: string; mark: Mark }[] = [
  { key: 'Mod-b', mark: 'strong' },
  { key: 'Mod-i', mark: 'emphasis' },
  { key: 'Mod-e', mark: 'inlineCode' },
]

/** Toggles `mark` around the current selection (or inserts an empty pair at the cursor). */
function toggleMark(mark: Mark): (view: EditorView) => boolean {
  return (view) => {
    view.dispatch(applyAction(view.state, { kind: 'toggleMark', mark }))
    return true
  }
}

export const markKeymapBindings: KeyBinding[] = MARK_SHORTCUTS.map(({ key, mark }) => ({
  key,
  preventDefault: true,
  run: toggleMark(mark),
}))

export const markKeymap = keymap.of(markKeymapBindings)

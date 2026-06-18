import { ViewPlugin, type ViewUpdate, EditorView } from '@codemirror/view'

export interface SlashCallbacks {
  onOpen: (coords: { x: number; y: number }, at: number) => void
  onQuery: (query: string, at: number) => void
  onClose: () => void
}

/** `textBefore` is the text on the current line up to (not including) the typed char. */
export function shouldTriggerSlash(typed: string, textBefore: string): boolean {
  if (typed !== '/') return false
  if (textBefore.length === 0) return true
  return /\s$/.test(textBefore)
}

export function slashExtension(cb: SlashCallbacks) {
  let triggerPos: number | null = null

  return ViewPlugin.fromClass(
    class {
      update(u: ViewUpdate) {
        if (!u.docChanged && !u.selectionSet) return

        // Detect a freshly typed '/'
        if (u.docChanged) {
          u.changes.iterChanges((_fa, _ta, _fb, _tb, inserted) => {
            const text = inserted.toString()
            if (text !== '/') return
            const pos = u.state.selection.main.head
            const line = u.state.doc.lineAt(pos)
            const textBefore = u.state.sliceDoc(line.from, pos - 1)
            if (shouldTriggerSlash('/', textBefore)) {
              triggerPos = pos - 1
              const at = triggerPos
              // Defer the layout read: CM6 forbids reading coords (readMeasured)
              // synchronously inside an update() cycle. The `read` phase is the
              // only place layout reads are allowed; `write` runs the callback.
              u.view.requestMeasure({
                read: (view) => view.coordsAtPos(pos),
                write: (coords) => { if (coords) cb.onOpen({ x: coords.left, y: coords.bottom }, at) },
              })
            }
          })
        }

        // While open, update query from text after the trigger.
        if (triggerPos != null) {
          const head = u.state.selection.main.head
          if (head <= triggerPos) { triggerPos = null; cb.onClose(); return }
          const query = u.state.sliceDoc(triggerPos + 1, head)
          if (/\s/.test(query)) { triggerPos = null; cb.onClose(); return }
          cb.onQuery(query, triggerPos)
        }
      }
    },
  )
}

/** Remove the `/query` fragment starting at `at` up to the current head. */
export function removeSlashFragment(view: EditorView, at: number) {
  const head = view.state.selection.main.head
  view.dispatch({ changes: { from: at, to: head } })
}

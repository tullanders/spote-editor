import { useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { wrapOnType } from './wrapOnType'
import { applyCmCommand } from './cmCommands'
import { slashExtension, removeSlashFragment } from './slashExtension'
import { CommandMenu } from '../command-core/CommandMenu'
import { SelectionBubble } from '../command-core/SelectionBubble'
import { useCommandMenu } from '../command-core/useCommandMenu'
import type { Command, BubbleAction } from '../command-core/core.types'
import type { MenuPosition } from '../command-core/useCommandMenu'

export interface CodeMirrorEditorProps {
  value: string
  onChange: (md: string) => void
  commands: Command[]
  readOnly?: boolean
  autoFocus?: boolean
  placeholder?: string
  onRequestLink: (position: MenuPosition, applyHref: (href: string) => void) => void
}

export function CodeMirrorEditor({ value, onChange, commands, readOnly, autoFocus, placeholder, onRequestLink }: CodeMirrorEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const triggerPosRef = useRef<number>(0)
  const menu = useCommandMenu(commands)
  const [bubble, setBubble] = useState<MenuPosition | null>(null)

  // Keep latest handlers in refs so the (once-built) extension can call them.
  const menuRef = useRef(menu); menuRef.current = menu

  useEffect(() => {
    if (!hostRef.current) return
    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        ...(placeholder ? [cmPlaceholder(placeholder)] : []),
        wrapOnType,
        slashExtension({
          onOpen: (coords, at) => { triggerPosRef.current = at; menuRef.current.openAt(coords) },
          onQuery: (q) => menuRef.current.setQuery(q),
          onClose: () => menuRef.current.close(),
        }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChange(u.state.doc.toString())
          if (u.selectionSet) {
            const sel = u.state.selection.main
            if (!sel.empty) {
              const coords = u.view.coordsAtPos(sel.from)
              if (coords) setBubble({ x: coords.left, y: coords.top - 40 })
            } else {
              setBubble(null)
            }
          }
        }),
        EditorView.editable.of(!readOnly),
      ],
    })
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    if (autoFocus) view.focus()
    return () => view.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reconcile external value changes (controlled component).
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  function runCommand(id: string) {
    const view = viewRef.current
    if (!view) return
    removeSlashFragment(view, triggerPosRef.current)
    if (id === 'link') {
      const coords = view.coordsAtPos(view.state.selection.main.from)
      onRequestLink({ x: coords?.left ?? 0, y: coords?.bottom ?? 0 }, (href) => {
        const r = view.state.selection.main
        const label = view.state.sliceDoc(r.from, r.to) || 'länk'
        view.dispatch({ changes: { from: r.from, to: r.to, insert: `[${label}](${href})` } })
      })
    } else {
      view.dispatch(applyCmCommand(view.state, id))
    }
    view.focus()
    menu.close()
  }

  function runBubble(action: BubbleAction) {
    const view = viewRef.current
    if (!view) return
    if (action === 'link') {
      // Snapshot the selection as primitives now; the link popover is async, so
      // re-read against the current doc length when applying to stay in range.
      const { from, to } = view.state.selection.main
      const coords = view.coordsAtPos(from)
      onRequestLink({ x: coords?.left ?? 0, y: (coords?.top ?? 0) - 40 }, (href) => {
        const docLen = view.state.doc.length
        const safeFrom = Math.min(from, docLen)
        const safeTo = Math.min(to, docLen)
        const label = view.state.sliceDoc(safeFrom, safeTo) || 'länk'
        view.dispatch({ changes: { from: safeFrom, to: safeTo, insert: `[${label}](${href})` } })
      })
    } else {
      view.dispatch(applyCmCommand(view.state, action))
    }
    setBubble(null)
    view.focus()
  }

  return (
    <div className="spote-editor__cm" ref={hostRef}>
      {menu.open && (
        <CommandMenu
          results={menu.results}
          activeIndex={menu.activeIndex}
          position={menu.position}
          onSelect={runCommand}
          onClose={menu.close}
          onMove={menu.move}
        />
      )}
      {bubble && <SelectionBubble position={bubble} onAction={runBubble} />}
    </div>
  )
}

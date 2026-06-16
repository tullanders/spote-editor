import { useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { wrapOnType } from './wrapOnType'
import { applyAction } from './applyAction'
import { slashExtension, removeSlashFragment } from './slashExtension'
import { CommandMenu } from '../command-core/CommandMenu'
import { SelectionBubble } from '../command-core/SelectionBubble'
import { useCommandMenu } from '../command-core/useCommandMenu'
import type { SpotePlugin, PluginUI } from '../command-core/plugin.types'
import { slashPlugins, bubblePlugins, pluginById } from '../command-core/pluginMenu'
import type { MenuPosition } from '../command-core/useCommandMenu'

export interface CodeMirrorEditorProps {
  value: string
  onChange: (md: string) => void
  plugins: SpotePlugin[]
  readOnly?: boolean
  autoFocus?: boolean
  placeholder?: string
  requestLink: (position: MenuPosition) => Promise<string | null>
}

export function CodeMirrorEditor({ value, onChange, plugins, readOnly, autoFocus, placeholder, requestLink }: CodeMirrorEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const triggerPosRef = useRef<number>(0)
  const menu = useCommandMenu(slashPlugins(plugins))
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

  async function runCommand(id: string) {
    const view = viewRef.current
    if (!view) return
    removeSlashFragment(view, triggerPosRef.current)
    const plugin = pluginById(plugins, id)
    menu.close()
    if (!plugin?.slash) { view.focus(); return }
    const coords = view.coordsAtPos(view.state.selection.main.from)
    const ui: PluginUI = { requestLink: () => requestLink({ x: coords?.left ?? 0, y: coords?.bottom ?? 0 }) }
    const action = await plugin.slash({ ui })
    if (action) view.dispatch(applyAction(view.state, action))
    view.focus()
  }

  async function runBubble(id: string) {
    const view = viewRef.current
    if (!view) return
    const { from, to } = view.state.selection.main
    const selectedText = view.state.sliceDoc(from, to)
    const coords = view.coordsAtPos(from)
    setBubble(null)
    const plugin = pluginById(plugins, id)
    if (!plugin?.bubble) { view.focus(); return }
    const ui: PluginUI = { requestLink: () => requestLink({ x: coords?.left ?? 0, y: (coords?.top ?? 0) - 40 }) }
    const action = await plugin.bubble({ selectedText, ui })
    if (!action) { view.focus(); return }
    // Re-assert the (clamped) snapshot selection so the action applies to the right range
    const len = view.state.doc.length
    const safeFrom = Math.min(from, len)
    const safeTo = Math.min(to, len)
    view.dispatch({ selection: { anchor: safeFrom, head: safeTo } })
    view.dispatch(applyAction(view.state, action))
    view.focus()
  }

  const bubble_plugins = bubblePlugins(plugins)

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
      {bubble && <SelectionBubble plugins={bubble_plugins} position={bubble} onSelect={runBubble} />}
    </div>
  )
}

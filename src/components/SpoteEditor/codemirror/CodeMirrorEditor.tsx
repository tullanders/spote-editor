import { useEffect, useRef, useState } from 'react'
import { EditorState, EditorSelection } from '@codemirror/state'
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { wrapOnType } from './wrapOnType'
import { markKeymap } from './markKeymap'
import { applyAction } from './applyAction'
import { slashExtension, removeSlashFragment } from './slashExtension'
import { CommandMenu } from '../command-core/CommandMenu'
import { SelectionBubble } from '../command-core/SelectionBubble'
import { useCommandMenu } from '../command-core/useCommandMenu'
import type { SpotePlugin, PluginUI } from '../command-core/plugin.types'
import { imageFilesFrom, nextUploadId, placeholderMarkdown, imageMarkdown, findPlaceholderRange } from '../command-core/imageUpload'
import { slashPlugins, bubblePlugins, pluginById } from '../command-core/pluginMenu'
import type { MenuPosition } from '../command-core/useCommandMenu'

/**
 * Two-phase image upload for CodeMirror: insert a raw-markdown placeholder at the
 * cursor now, await the host upload, then swap the placeholder for `![](url)` —
 * or remove it on failure. Located by unique placeholder text so concurrent
 * uploads and unrelated edits don't collide.
 */
async function cmUploadAndInsert(view: EditorView, file: File, onUpload: (file: File) => Promise<string>) {
  // Known limitation (v1): if the user switches editor mode mid-upload, the engine
  // unmounts and this resolve no-ops, leaving the placeholder behind. Acceptable per
  // the spec's silent-failure posture.
  const id = nextUploadId()
  const ph = placeholderMarkdown(id)
  const r = view.state.selection.main
  view.dispatch({ changes: { from: r.from, to: r.to, insert: ph }, selection: EditorSelection.cursor(r.from + ph.length) })
  try {
    const url = await onUpload(file)
    const range = findPlaceholderRange(view.state.doc.toString(), id)
    if (range) view.dispatch({ changes: { from: range.from, to: range.to, insert: imageMarkdown(url) } })
  } catch {
    const range = findPlaceholderRange(view.state.doc.toString(), id)
    if (range) view.dispatch({ changes: { from: range.from, to: range.to, insert: '' } })
  }
}

export interface CodeMirrorEditorProps {
  value: string
  onChange: (md: string) => void
  plugins: SpotePlugin[]
  readOnly?: boolean
  autoFocus?: boolean
  placeholder?: string
  requestLink: (position: MenuPosition) => Promise<string | null>
  onUpload?: (file: File) => Promise<string>
  pickImage: () => Promise<File | null>
}

export function CodeMirrorEditor({ value, onChange, plugins, readOnly, autoFocus, placeholder, requestLink, onUpload, pickImage }: CodeMirrorEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const triggerPosRef = useRef<number>(0)
  const onUploadRef = useRef(onUpload); onUploadRef.current = onUpload
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
        markKeymap,
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
        EditorView.domEventHandlers({
          paste(event, view) {
            const onUpload = onUploadRef.current
            if (!onUpload) return false
            const files = imageFilesFrom(event.clipboardData?.files)
            if (files.length === 0) return false
            event.preventDefault()
            files.forEach((f) => { void cmUploadAndInsert(view, f, onUpload) })
            return true
          },
          drop(event, view) {
            const onUpload = onUploadRef.current
            if (!onUpload) return false
            const files = imageFilesFrom(event.dataTransfer?.files)
            if (files.length === 0) return false
            event.preventDefault()
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
            if (pos != null) view.dispatch({ selection: EditorSelection.cursor(pos) })
            files.forEach((f) => { void cmUploadAndInsert(view, f, onUpload) })
            return true
          },
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
    const ui: PluginUI = {
      requestLink: () => requestLink({ x: coords?.left ?? 0, y: coords?.bottom ?? 0 }),
      pickImage,
    }
    const action = await plugin.slash({ ui })
    if (action?.kind === 'uploadImage') {
      if (onUploadRef.current) void cmUploadAndInsert(view, action.file, onUploadRef.current)
      view.focus()
      return
    }
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
    const ui: PluginUI = {
      requestLink: () => requestLink({ x: coords?.left ?? 0, y: (coords?.top ?? 0) - 40 }),
      pickImage,
    }
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

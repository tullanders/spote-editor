import { useEffect, useRef, useState } from 'react'
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, editorViewOptionsCtx } from '@milkdown/core'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { $prose, replaceAll } from '@milkdown/utils'
import { CommandMenu } from '../command-core/CommandMenu'
import { SelectionBubble } from '../command-core/SelectionBubble'
import { useCommandMenu } from '../command-core/useCommandMenu'
import type { SpotePlugin, PluginUI } from '../command-core/plugin.types'
import { slashPlugins, bubblePlugins, pluginById } from '../command-core/pluginMenu'
import type { MenuPosition } from '../command-core/useCommandMenu'
import { applyAction } from './applyAction'
import { createSlashPlugin } from './slashPlugin'

export interface MilkdownEditorProps {
  value: string
  onChange: (md: string) => void
  plugins: SpotePlugin[]
  readOnly?: boolean
  autoFocus?: boolean
  /** Accepted for prop parity with the raw editor; not yet applied in WYSIWYG (v1). */
  placeholder?: string
  requestLink: (position: MenuPosition) => Promise<string | null>
}

/**
 * Inner component: must live under a {@link MilkdownProvider} so `useEditor` and
 * the `<Milkdown />` mount point share editor context.
 */
function MilkdownEditorInner({ value, onChange, plugins, readOnly, autoFocus, requestLink }: MilkdownEditorProps) {
  const menu = useCommandMenu(slashPlugins(plugins))
  const [bubble, setBubble] = useState<MenuPosition | null>(null)

  // The editor factory runs once; route through refs so it always sees latest.
  const menuRef = useRef(menu); menuRef.current = menu
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange
  const requestLinkRef = useRef(requestLink); requestLinkRef.current = requestLink
  const readOnlyRef = useRef(readOnly); readOnlyRef.current = readOnly
  const triggerPosRef = useRef(0)
  // Last markdown we emitted, used to guard the controlled reconcile loop.
  const lastMarkdownRef = useRef(value)

  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, value)
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          editable: () => !readOnlyRef.current,
        }))
        const l = ctx.get(listenerCtx)
        l.markdownUpdated((_c, markdown) => {
          lastMarkdownRef.current = markdown
          onChangeRef.current(markdown)
        })
        l.selectionUpdated((selCtx, selection) => {
          if (selection.empty) { setBubble(null); return }
          const view = selCtx.get(editorViewCtx)
          const rect = view.coordsAtPos(selection.from)
          setBubble({ x: rect.left, y: rect.top - 40 })
        })
      })
      .use(commonmark)
      .use(gfm)
      .use(listener)
      .use(
        $prose(() =>
          createSlashPlugin({
            onOpen: (coords, triggerPos) => {
              triggerPosRef.current = triggerPos
              menuRef.current.openAt(coords)
            },
            onQuery: (q) => menuRef.current.setQuery(q),
            onClose: () => menuRef.current.close(),
          }),
        ),
      ),
  )

  // Focus once the editor has finished creating (autoFocus at setup only).
  useEffect(() => {
    if (!autoFocus) return
    const editor = get()
    if (!editor) return
    editor.action((ctx) => ctx.get(editorViewCtx).focus())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [get()])

  // Controlled reconcile: replace content when external value diverges from the
  // last markdown we serialized. Guarded so onChange-driven updates don't loop.
  useEffect(() => {
    const editor = get()
    if (!editor) return
    if (value === lastMarkdownRef.current) return
    lastMarkdownRef.current = value
    editor.action(replaceAll(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  async function runSlash(id: string) {
    const editor = get()
    if (!editor) return
    // Remove the `/query` fragment left in the doc by the slash trigger.
    const coords = editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const from = triggerPosRef.current
      const to = view.state.selection.from
      if (to > from) view.dispatch(view.state.tr.delete(from, to))
      return view.coordsAtPos(view.state.selection.from)
    })
    menu.close()
    const plugin = pluginById(plugins, id)
    if (!plugin?.slash) {
      editor.action((ctx) => ctx.get(editorViewCtx).focus())
      return
    }
    const ui: PluginUI = { requestLink: () => requestLinkRef.current({ x: coords.left, y: coords.bottom }) }
    const action = await plugin.slash({ ui })
    if (action) editor.action((ctx) => applyAction(ctx, action))
    editor.action((ctx) => ctx.get(editorViewCtx).focus())
  }

  async function runBubble(id: string) {
    const editor = get()
    if (!editor) return
    const { selectedText, coords } = editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { from, to } = view.state.selection
      return {
        selectedText: view.state.doc.textBetween(from, to, ' '),
        coords: view.coordsAtPos(from),
      }
    })
    setBubble(null)
    const plugin = pluginById(plugins, id)
    if (!plugin?.bubble) {
      editor.action((ctx) => ctx.get(editorViewCtx).focus())
      return
    }
    const ui: PluginUI = { requestLink: () => requestLinkRef.current({ x: coords.left, y: coords.top - 40 }) }
    const action = await plugin.bubble({ selectedText, ui })
    if (action) editor.action((ctx) => applyAction(ctx, action))
    editor.action((ctx) => ctx.get(editorViewCtx).focus())
  }

  return (
    <div className="spote-editor__milkdown">
      <Milkdown />
      {menu.open && (
        <CommandMenu
          results={menu.results}
          activeIndex={menu.activeIndex}
          position={menu.position}
          onSelect={runSlash}
          onClose={menu.close}
          onMove={menu.move}
        />
      )}
      {bubble && <SelectionBubble plugins={bubblePlugins(plugins)} position={bubble} onSelect={runBubble} />}
    </div>
  )
}

export function MilkdownEditor(props: MilkdownEditorProps) {
  return (
    <MilkdownProvider>
      <MilkdownEditorInner {...props} />
    </MilkdownProvider>
  )
}

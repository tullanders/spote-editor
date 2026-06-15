import { useEffect, useRef, useState } from 'react'
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, editorViewOptionsCtx } from '@milkdown/core'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { commonmark, toggleLinkCommand } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { $prose, callCommand, replaceAll } from '@milkdown/utils'
import type { Ctx } from '@milkdown/ctx'
import { CommandMenu } from '../command-core/CommandMenu'
import { SelectionBubble } from '../command-core/SelectionBubble'
import { useCommandMenu } from '../command-core/useCommandMenu'
import type { Command, BubbleAction } from '../command-core/core.types'
import type { MenuPosition } from '../command-core/useCommandMenu'
import { milkdownCommands, isMilkdownCommandId } from './milkdownCommands'
import { createSlashPlugin } from './slashPlugin'

export interface MilkdownEditorProps {
  value: string
  onChange: (md: string) => void
  commands: Command[]
  readOnly?: boolean
  autoFocus?: boolean
  /** Accepted for prop parity with the raw editor; not yet applied in WYSIWYG (v1). */
  placeholder?: string
  onRequestLink: (position: MenuPosition, applyHref: (href: string) => void) => void
}

/**
 * Inner component: must live under a {@link MilkdownProvider} so `useEditor` and
 * the `<Milkdown />` mount point share editor context.
 */
function MilkdownEditorInner({ value, onChange, commands, readOnly, autoFocus, onRequestLink }: MilkdownEditorProps) {
  const menu = useCommandMenu(commands)
  const [bubble, setBubble] = useState<MenuPosition | null>(null)

  // The editor factory runs once; route through refs so it always sees latest.
  const menuRef = useRef(menu); menuRef.current = menu
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange
  const onRequestLinkRef = useRef(onRequestLink); onRequestLinkRef.current = onRequestLink
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

  /** Remove the `/query` fragment (if any), then run the editor mutation `fn`. */
  function withSlashRemoved(fn: (ctx: Ctx) => void) {
    const editor = get()
    if (!editor) return
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const from = triggerPosRef.current
      const to = view.state.selection.from
      if (to > from) view.dispatch(view.state.tr.delete(from, to))
      fn(ctx)
      view.focus()
    })
  }

  function runCommand(id: string) {
    const editor = get()
    if (!editor) return
    if (id === 'link') {
      const rect = editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const from = triggerPosRef.current
        const to = view.state.selection.from
        if (to > from) view.dispatch(view.state.tr.delete(from, to))
        return view.coordsAtPos(view.state.selection.from)
      })
      onRequestLinkRef.current({ x: rect.left, y: rect.bottom }, (href) => {
        editor.action(callCommand(toggleLinkCommand.key, { href }))
        editor.action((ctx) => ctx.get(editorViewCtx).focus())
      })
    } else if (isMilkdownCommandId(id)) {
      withSlashRemoved((ctx) => milkdownCommands[id](ctx))
    }
    menu.close()
  }

  function runBubble(action: BubbleAction) {
    const editor = get()
    if (!editor) return
    if (action === 'link') {
      const rect = editor.action((ctx) => ctx.get(editorViewCtx).coordsAtPos(ctx.get(editorViewCtx).state.selection.from))
      onRequestLinkRef.current({ x: rect.left, y: rect.top - 40 }, (href) => {
        editor.action(callCommand(toggleLinkCommand.key, { href }))
        editor.action((ctx) => ctx.get(editorViewCtx).focus())
      })
    } else if (isMilkdownCommandId(action)) {
      editor.action((ctx) => {
        milkdownCommands[action](ctx)
        ctx.get(editorViewCtx).focus()
      })
    }
    setBubble(null)
  }

  return (
    <div className="spote-editor__milkdown">
      <Milkdown />
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

export function MilkdownEditor(props: MilkdownEditorProps) {
  return (
    <MilkdownProvider>
      <MilkdownEditorInner {...props} />
    </MilkdownProvider>
  )
}

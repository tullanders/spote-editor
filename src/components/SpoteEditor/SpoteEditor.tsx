import { useState, useCallback } from 'react'
import type { SpoteEditorProps, EditorMode } from './SpoteEditor.types'
import { DEFAULT_COMMANDS } from './command-core/commands'
import { CodeMirrorEditor } from './codemirror/CodeMirrorEditor'
import { MilkdownEditor } from './milkdown/MilkdownEditor'
import { LinkPopover } from './command-core/LinkPopover'
import type { MenuPosition } from './command-core/useCommandMenu'
import type { Command } from './command-core/core.types'

interface LinkRequest {
  position: MenuPosition
  apply: (href: string) => void
}

// Stable default reference so we don't allocate a new array (and re-register the
// menu's keydown listeners) on every render when no commands prop is passed.
const DEFAULT_COMMAND_LIST: Command[] = [...DEFAULT_COMMANDS]

export function SpoteEditor(props: SpoteEditorProps) {
  const {
    value, onChange, mode: modeProp, onModeChange,
    onSearchNotes, onResolveNoteHref, commands = DEFAULT_COMMAND_LIST,
    readOnly, className, autoFocus, placeholder,
  } = props

  const [internalMode, setInternalMode] = useState<EditorMode>('wysiwyg')
  const mode = modeProp ?? internalMode
  const [link, setLink] = useState<LinkRequest | null>(null)

  const setMode = useCallback((next: EditorMode) => {
    if (modeProp == null) setInternalMode(next)
    onModeChange?.(next)
  }, [modeProp, onModeChange])

  const onRequestLink = useCallback((position: MenuPosition, apply: (href: string) => void) => {
    setLink({ position, apply })
  }, [])

  const Engine = mode === 'raw' ? CodeMirrorEditor : MilkdownEditor

  return (
    <div className={'spote-editor' + (className ? ' ' + className : '')}>
      <div className="spote-editor__toolbar">
        <button
          type="button"
          className="spote-editor__mode-toggle"
          onClick={() => setMode(mode === 'raw' ? 'wysiwyg' : 'raw')}
        >
          {mode === 'raw' ? 'WYSIWYG' : 'Raw markdown'}
        </button>
      </div>
      <Engine
        value={value}
        onChange={onChange}
        commands={commands}
        readOnly={readOnly}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onRequestLink={onRequestLink}
      />
      {link && (
        <LinkPopover
          position={link.position}
          onSearchNotes={onSearchNotes}
          onResolveNoteHref={onResolveNoteHref}
          onSubmitHref={(href) => { link.apply(href); setLink(null) }}
          onCancel={() => setLink(null)}
        />
      )}
    </div>
  )
}

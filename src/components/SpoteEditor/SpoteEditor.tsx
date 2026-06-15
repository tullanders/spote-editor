import { useState, useCallback } from 'react'
import type { SpoteEditorProps, EditorMode } from './SpoteEditor.types'
import { DEFAULT_COMMANDS } from './command-core/commands'
import { CodeMirrorEditor } from './codemirror/CodeMirrorEditor'
import { MilkdownEditor } from './milkdown/MilkdownEditor'
import { LinkPopover } from './command-core/LinkPopover'
import type { MenuPosition } from './command-core/useCommandMenu'

interface LinkRequest {
  position: MenuPosition
  apply: (href: string) => void
}

export function SpoteEditor(props: SpoteEditorProps) {
  const {
    value, onChange, mode: modeProp, onModeChange,
    onSearchNotes, onResolveNoteHref, commands = [...DEFAULT_COMMANDS],
    readOnly, className, autoFocus,
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

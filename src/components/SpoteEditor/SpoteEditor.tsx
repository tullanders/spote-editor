import { useState, useCallback, useRef } from 'react'
import type { SpoteEditorProps, EditorMode } from './SpoteEditor.types'
import { DEFAULT_PLUGINS } from './command-core/plugins'
import { withImageGate } from './command-core/pluginMenu'
import { CodeMirrorEditor } from './codemirror/CodeMirrorEditor'
import { MilkdownEditor } from './milkdown/MilkdownEditor'
import { LinkPopover } from './command-core/LinkPopover'
import type { MenuPosition } from './command-core/useCommandMenu'
import type { SpotePlugin } from './command-core/plugin.types'

const DEFAULTS: SpotePlugin[] = DEFAULT_PLUGINS

interface PendingLink { position: MenuPosition; resolve: (href: string | null) => void }

export function SpoteEditor(props: SpoteEditorProps) {
  const {
    value, onChange, mode: modeProp, onModeChange,
    onSearchNotes, onResolveNoteHref, plugins = DEFAULTS,
    readOnly, className, autoFocus, placeholder, onUpload,
  } = props

  const [internalMode, setInternalMode] = useState<EditorMode>('wysiwyg')
  const mode = modeProp ?? internalMode
  const [pending, setPending] = useState<PendingLink | null>(null)

  const setMode = useCallback((next: EditorMode) => {
    if (modeProp == null) setInternalMode(next)
    onModeChange?.(next)
  }, [modeProp, onModeChange])

  const requestLink = useCallback((position: MenuPosition) =>
    new Promise<string | null>((resolve) => setPending({ position, resolve })), [])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pickResolveRef = useRef<((file: File | null) => void) | null>(null)

  const settlePick = useCallback((file: File | null) => {
    pickResolveRef.current?.(file)
    pickResolveRef.current = null
  }, [])

  const pickImage = useCallback(() => new Promise<File | null>((resolve) => {
    const input = fileInputRef.current
    if (!input) { resolve(null); return }
    pickResolveRef.current = resolve
    input.value = ''
    input.click()
  }), [])

  const gatedPlugins = withImageGate(plugins, !!onUpload)

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
        plugins={gatedPlugins}
        readOnly={readOnly}
        autoFocus={autoFocus}
        placeholder={placeholder}
        requestLink={requestLink}
        onUpload={onUpload}
        pickImage={pickImage}
      />
      {pending && (
        <LinkPopover
          position={pending.position}
          onSearchNotes={onSearchNotes}
          onResolveNoteHref={onResolveNoteHref}
          onSubmitHref={(href) => { pending.resolve(href); setPending(null) }}
          onCancel={() => { pending.resolve(null); setPending(null) }}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => settlePick(e.target.files?.[0] ?? null)}
        onCancel={() => settlePick(null)}
      />
    </div>
  )
}

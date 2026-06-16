import type { SpotePlugin } from './command-core/plugin.types'

export type EditorMode = 'wysiwyg' | 'raw'

export interface NoteHit {
  id: string
  title: string
}

export interface SpoteEditorProps {
  value: string
  onChange: (md: string) => void
  mode?: EditorMode
  onModeChange?: (mode: EditorMode) => void
  onSearchNotes?: (query: string) => Promise<NoteHit[]>
  onResolveNoteHref?: (note: NoteHit) => string
  plugins?: SpotePlugin[]
  placeholder?: string
  readOnly?: boolean
  className?: string
  autoFocus?: boolean
}

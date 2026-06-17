import { useState } from 'react'
import { SpoteEditor, DEFAULT_PLUGINS } from 'spote-editor'
import type { NoteHit, SpotePlugin } from 'spote-editor'
import 'spote-editor/styles'

const FAKE_NOTES: NoteHit[] = [
  { id: 'n1', title: 'Project plan' },
  { id: 'n2', title: 'Meeting notes' },
  { id: 'n3', title: 'Ideas' },
]

// Custom plugin: insert today's date (slash-only). Proves consumer extensibility.
const insertDate: SpotePlugin = {
  id: 'date', label: 'Date', icon: '📅',
  slash: () => ({ kind: 'insert', markdown: new Date().toISOString().slice(0, 10) }),
}

export default function App() {
  const [md, setMd] = useState('# Hello\n\nSelect a word and try the bubble. Type `/` for the menu (incl. "Date").')

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'system-ui' }}>
      <h1>SpoteEditor Demo</h1>
      <SpoteEditor
        value={md}
        onChange={setMd}
        plugins={[...DEFAULT_PLUGINS, insertDate]}
        onSearchNotes={async (q) => FAKE_NOTES.filter((n) => n.title.toLowerCase().includes(q.toLowerCase()))}
        onResolveNoteHref={(n) => `spote://note/${n.id}`}
      />
      <h2>Raw markdown (source)</h2>
      <pre style={{ background: '#f4f5f7', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{md}</pre>
    </div>
  )
}

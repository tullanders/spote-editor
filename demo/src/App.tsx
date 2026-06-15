import { useState } from 'react'
import { SpoteEditor } from 'spote-editor'
import type { NoteHit } from 'spote-editor'
import 'spote-editor/styles'

const FAKE_NOTES: NoteHit[] = [
  { id: 'n1', title: 'Projektplan' },
  { id: 'n2', title: 'Mötesanteckningar' },
  { id: 'n3', title: 'Idéer' },
]

export default function App() {
  const [md, setMd] = useState('# Hej\n\nMarkera ett ord och prova bubblan. Skriv `/` för menyn.')

  return (
    <div style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'system-ui' }}>
      <h1>SpoteEditor Demo</h1>
      <SpoteEditor
        value={md}
        onChange={setMd}
        onSearchNotes={async (q) =>
          FAKE_NOTES.filter((n) => n.title.toLowerCase().includes(q.toLowerCase()))
        }
        onResolveNoteHref={(n) => `spote://note/${n.id}`}
      />
      <h2>Rå markdown (källa)</h2>
      <pre style={{ background: '#f4f5f7', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{md}</pre>
    </div>
  )
}

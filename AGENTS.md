# spote-editor – Agent instructions

This file is intended for AI coding agents (Claude Code, Copilot, etc.) working on integrations with `spote-editor`.

## Package

```
npm install spote-editor
```

Always import the stylesheet:

```tsx
import 'spote-editor/styles'
```

## Component

```tsx
import { SpoteEditor } from 'spote-editor'
```

### All props

```ts
interface SpoteEditorProps {
  // Required
  value: string                                        // Markdown string (controlled)
  onChange: (md: string) => void                       // Called on every edit

  // Mode
  mode?: 'wysiwyg' | 'raw'                            // Defaults to 'wysiwyg'
  onModeChange?: (mode: 'wysiwyg' | 'raw') => void

  // Note linking (e.g. [[wiki-links]])
  onSearchNotes?: (query: string) => Promise<NoteHit[]>
  onResolveNoteHref?: (note: NoteHit) => string        // Return href for a note link

  // Image upload — omit to disable image features entirely
  onUpload?: (file: File) => Promise<string>           // Returns the URL to embed

  // Plugins
  plugins?: SpotePlugin[]                              // Defaults to DEFAULT_PLUGINS

  // Misc
  placeholder?: string
  readOnly?: boolean
  className?: string
  autoFocus?: boolean
}

interface NoteHit {
  id: string
  title: string
}
```

### Minimal Spote integration example

```tsx
import { SpoteEditor } from 'spote-editor'
import 'spote-editor/styles'

<SpoteEditor
  value={note.markdown}
  onChange={(md) => updateNote(note.id, md)}
  onSearchNotes={(q) => api.searchNotes(q)}
  onResolveNoteHref={(note) => `/notes/${note.id}`}
  onUpload={(file) => api.uploadImage(file).then((r) => r.url)}
/>
```

## Plugins

### Built-in named plugins (importable individually)

```
bold, italic, code, link, h1, h2, h3,
bulletList, orderedList, quote, codeBlock, divider
```

`DEFAULT_PLUGINS` is the full set above in the default order.

### Custom plugin shape

```ts
type SpotePlugin = {
  id: string
  label: string
  icon: ReactNode
  bubble?: (ctx: BubbleContext) => PluginAction | null | Promise<PluginAction | null>
  slash?: (ctx: SlashContext) => PluginAction | null | Promise<PluginAction | null>
  // At least one of bubble or slash is required
}
```

### PluginAction variants

```ts
type PluginAction =
  | { kind: 'replaceSelection'; markdown: string }
  | { kind: 'insert'; markdown: string }
  | { kind: 'toggleMark'; mark: 'strong' | 'emphasis' | 'inlineCode' }
  | { kind: 'setBlock'; block: 'heading' | 'bulletList' | 'orderedList' | 'blockquote' | 'codeBlock'; attrs?: { level?: number } }
  | { kind: 'uploadImage'; file: File }
```

### PluginUI helpers (available in bubble/slash context)

```ts
interface PluginUI {
  requestLink: () => Promise<string | null>   // Opens link popover
  pickImage: () => Promise<File | null>        // Opens image file picker
}
```

## Development (in this repo)

```bash
npm install
npm run dev      # Start demo app at localhost:5173
npm run build    # Build library
npm test         # Run tests (vitest)
npm run lint     # ESLint
```

## Architecture notes

- Two editor engines under the hood: **Milkdown** (WYSIWYG / ProseMirror) and **CodeMirror 6** (raw markdown).
- Both engines share a single markdown string as source of truth — toggling modes is lossless.
- Bundle is ~400 kB gzipped (expected given two full editor engines).
- Tests live next to source files (`*.test.ts` / `*.test.tsx`), run with vitest.

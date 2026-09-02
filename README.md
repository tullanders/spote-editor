# spote-editor

A React editor component published as an npm module.
Built for [Spote](https://spote.cloud) — markdown notes with MCP support — but usable standalone in any React app.

## Under the hood

`SpoteEditor` is a dual-mode markdown editor:

- **WYSIWYG** mode is powered by [Milkdown](https://milkdown.dev/) (ProseMirror + remark).
- **Raw markdown** mode is powered by [CodeMirror 6](https://codemirror.net/).

Both modes share the same markdown string as their single source of truth, so toggling
between them preserves content. Because the package bundles two full editor engines, it is
relatively large (~400 kB gzipped) — expected for what it does. Mermaid is a separate
dependency, loaded lazily the first time a diagram is rendered, so notes without diagrams
never pay for it.

Both Milkdown and CodeMirror are MIT-licensed.

## Installation

```bash
npm install spote-editor
```

## Usage

```tsx
import { SpoteEditor } from 'spote-editor'
import 'spote-editor/styles'

export default function App() {
  return <SpoteEditor />
}
```

## Command plugins

`SpoteEditor` ships with a default set of plugins (`DEFAULT_PLUGINS`) covering
bold, italic, inline code, link, headings (H1–H3), bullet list, ordered list,
blockquote, code block, mermaid diagram, image, and divider (horizontal rule).
You can replace or extend this set via the `plugins` prop.

### `SpotePlugin` shape

```ts
interface SpotePlugin {
  id: string         // unique key
  label: string      // displayed in slash menu / bubble tooltip
  icon: ReactNode    // emoji, short string, or any React node shown in UI

  /** Called when the user selects this plugin from the bubble (text selected). */
  bubble?: (ctx: BubbleContext) => PluginAction | null | Promise<PluginAction | null>

  /** Called when the user selects this plugin from the slash menu. */
  slash?: (ctx: SlashContext) => PluginAction | null | Promise<PluginAction | null>
}
```

At least one of `bubble` or `slash` must be provided.

### Contexts

```ts
interface BubbleContext {
  selectedText: string   // the currently selected text
  ui: PluginUI
}

interface SlashContext {
  ui: PluginUI
}

interface PluginUI {
  /** Opens the link popover and resolves with the href the user confirms. */
  requestLink: (defaultHref?: string) => Promise<string | null>
}
```

### `PluginAction`

```ts
type PluginAction =
  | { kind: 'replaceSelection'; markdown: string }   // replace selected text
  | { kind: 'insert'; markdown: string }             // insert at cursor
  | { kind: 'toggleMark'; mark: string }             // toggle inline mark (bold/italic/…)
  | { kind: 'setBlock'; block: string }              // set block type (heading/…)
```

### Example — custom "insert date" slash plugin

```tsx
import { SpoteEditor, DEFAULT_PLUGINS } from 'spote-editor'
import type { SpotePlugin } from 'spote-editor'

const insertDate: SpotePlugin = {
  id: 'date',
  label: 'Datum',
  icon: '📅',
  slash: () => ({ kind: 'insert', markdown: new Date().toISOString().slice(0, 10) }),
}

export default function App() {
  return (
    <SpoteEditor
      plugins={[...DEFAULT_PLUGINS, insertDate]}
    />
  )
}
```

### Composing a subset

You can import named plugins to build a custom, minimal set:

```tsx
import { bold, italic, link, h1, h2 } from 'spote-editor'

<SpoteEditor plugins={[bold, italic, link, h1, h2, myPlugin]} />
```

## Mermaid diagrams

Fenced code blocks tagged `mermaid` render as diagrams in WYSIWYG mode:

````markdown
```mermaid
graph TD
  A --> B
```
````

The block stays an ordinary fenced code block in the document, so markdown round-trip
is unaffected. Click a diagram to move the selection into it and reveal its source;
click elsewhere, or blur the editor, and it re-renders. (Merely having the selection
land inside the block — e.g. from `autoFocus` — does not open edit mode; it takes an
actual click or selection move while the editor has focus.)

A `⤢` button, shown on hover or keyboard focus in the corner of the diagram, opens it
full-screen. Escape or a click on the scrim closes it — this works even when the editor
is `readOnly`. In raw markdown mode the block is left as plain text.

Diagram colours follow the `theme` prop:

```tsx
<SpoteEditor value={md} onChange={setMd} theme="dark" />   // 'light' | 'dark' | 'auto' (default)
```

`'auto'` follows the OS `prefers-color-scheme` setting. The editor's own colours are
unaffected — those come from the `--spote-*` CSS variables.

A `/mermaid` slash command inserts a seeded diagram block (works in raw mode too).
Mermaid is loaded lazily the first time a diagram renders, so notes without diagrams
never pay for it — and it's marked `external` in the build, so it doesn't add to
`spote-editor`'s own bundle size.

## Development

```bash
# Install dependencies
npm install

# Start demo app
npm run dev

# Build library
npm run build

# Run tests
npm test

# Lint
npm run lint
```

## Publishing

Tag a commit with a version to trigger the GitHub Actions publish workflow:

```bash
git tag v0.1.0 && git push --tags
```

## About Spote

[Spote](https://spote.cloud) is a markdown notes system with first-class
[MCP](https://modelcontextprotocol.io/) support, so AI agents can read, write, search,
and relate your notes directly. `spote-editor` is the editing surface behind it — the
same dual-mode (WYSIWYG / raw markdown) component, extracted as a standalone npm package.

You don't need a Spote account to use the editor; it works in any React app. But if you
want notes that your tools and agents can actually reach, that's what Spote is for.

## License

MIT

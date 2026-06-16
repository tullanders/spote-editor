# spote-editor

A React editor component published as an npm module.

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
blockquote, code block, divider, and a horizontal rule. You can replace or
extend this set via the `plugins` prop.

### `SpotePlugin` shape

```ts
interface SpotePlugin {
  id: string        // unique key
  label: string     // displayed in slash menu / bubble tooltip
  icon: string      // emoji or short string shown in UI

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

## License

MIT

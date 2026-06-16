# Command Plugins — Design Spec

Date: 2026-06-15
Status: Draft for review
Supersedes the design section of `docs/superpowers/plans/2026-06-15-command-plugins.md`
(which used an earlier dual-handler `surfaces`-array model). The implementation plan
will be regenerated from this spec after approval.

## Goal

Make every toolbar item — in both the selection bubble and the slash menu — a **plugin**.
Built-ins are just the default plugin set, written with the exact same API consumers use.
Consumers can remove, reorder, restyle, or add items via one `plugins` prop.

User-visible behavior of the existing default commands stays the same (see Open Decisions
for the one inline-mark-in-slash nuance). This is a structural refactor.

## Core model

### Plugin shape

```ts
import type { ReactNode } from 'react'

interface PluginBase {
  id: string
  label: string
  icon: ReactNode          // plugin owns its visual representation
}

// The two surfaces have DIFFERENT context, so they are separate handlers.
// Placement is implicit: a plugin shows in the bubble iff it has `bubble`,
// in the slash menu iff it has `slash`. No `surfaces` field, no two arrays.
type SpotePlugin = PluginBase &
  ( { bubble: BubbleHandler; slash?: SlashHandler }
  | { bubble?: BubbleHandler; slash: SlashHandler } )  // at least one required (compile error otherwise)

type BubbleHandler = (ctx: BubbleContext) => PluginAction | null | Promise<PluginAction | null>
type SlashHandler  = (ctx: SlashContext)  => PluginAction | null | Promise<PluginAction | null>
```

- A handler returning `null` is a no-op (e.g. the user cancelled a popup).
- Handlers may be async (await a `ctx.ui` popup, then return an action).
- One flat `plugins: SpotePlugin[]` array; order within each surface = array order.

### Context per surface

```ts
interface BubbleContext {
  selectedText: string     // plain text of the current selection
  ui: PluginUI
}

interface SlashContext {
  ui: PluginUI             // no selection at slash time
}
```

The `slash` handler structurally cannot read `selectedText` — type-safe separation.

### Actions (the predefined, closed-but-extensible-by-us layer)

Handlers don't touch the editor engines. They return a declarative action; each adapter
owns an **action interpreter** that realizes it per engine. This is the ONLY place engine
knowledge lives, and it is shared by built-in and custom plugins alike.

```ts
type PluginAction =
  | { kind: 'replaceSelection'; markdown: string }   // bubble: swap selection for markdown
  | { kind: 'insert'; markdown: string }             // slash: insert markdown at cursor
  | { kind: 'toggleMark'; mark: 'strong' | 'emphasis' | 'inlineCode' }
  | { kind: 'setBlock'; block: 'heading' | 'bulletList' | 'orderedList' | 'blockquote' | 'codeBlock'; attrs?: { level?: number } }
```

Why a union and not a raw string: a returned markdown string works for templating
(`replaceSelection: \`**${ctx.selectedText}**\``) and is realized in WYSIWYG by parsing
the fragment and replacing. But (a) correct **toggle** of inline marks and (b) **block
type** changes can't be expressed as "a string in place" in WYSIWYG, so they get their
own action kinds that map to native ProseMirror/CodeMirror operations.

The set of action kinds (and the `mark`/`block` enums) is closed — a consumer can't invent
`toggleMark: 'superscript'` unless both adapters implement it. Extending the vocabulary is
our job. See Open Decisions for the raw escape hatch.

### Action interpreters (per adapter)

| Action | CodeMirror (raw) | Milkdown (WYSIWYG) |
|---|---|---|
| `replaceSelection` | replace selection range with the markdown text | parse markdown fragment → replace selection slice |
| `insert` | insert text at cursor | parse fragment → insert at cursor |
| `toggleMark` | wrap/unwrap selection with `**`/`*`/`` ` `` (reuse `wrapOnType` re-wrap detection) | `callCommand(toggleStrong/Emphasis/InlineCode)` |
| `setBlock` | line-prefix the current line (`# `, `- `, `1. `, `> `, fences) | `callCommand(wrapInHeading/BulletList/OrderedList/Blockquote/CodeBlock)` |

### The UI service (`ctx.ui`) — popup framework

Generalizes the current `LinkPopover`/`onRequestLink` so any plugin can request shell UI
and await a result. The shell owns rendering; plugins stay pure functions.

```ts
interface PluginUI {
  // v-next: the one concrete need. Reuses the existing LinkPopover + the shell's
  // onSearchNotes / onResolveNoteHref. Returns an href, or null if cancelled.
  requestLink(): Promise<string | null>
}
```

`PluginUI` is an extensible namespace. A generic `prompt(...)` and consumer-rendered
popups are future additions (see Open Decisions) — designed so adding them is non-breaking.

The link built-in then becomes an ordinary plugin:

```ts
const link: SpotePlugin = {
  id: 'link', label: 'Länk', icon: '🔗',
  bubble: async ({ selectedText, ui }) => {
    const href = await ui.requestLink()
    return href ? { kind: 'replaceSelection', markdown: `[${selectedText || 'länk'}](${href})` } : null
  },
  slash: async ({ ui }) => {
    const href = await ui.requestLink()
    return href ? { kind: 'insert', markdown: `[länk](${href})` } : null
  },
}
```

The `requestLink` effect channel from the old plan is gone — link is just a plugin.

## Built-in default plugins

All twelve become individually-importable named exports plus a `DEFAULT_PLUGINS` bundle,
so consumers can compose (`plugins={[bold, italic, myCustom]}`) or take the default set.

| id | bubble | slash | action(s) |
|---|---|---|---|
| `bold` | yes | (see Open Decisions) | `toggleMark: 'strong'` |
| `italic` | yes | (see Open Decisions) | `toggleMark: 'emphasis'` |
| `code` | yes | (see Open Decisions) | `toggleMark: 'inlineCode'` |
| `link` | yes | yes | `requestLink` → `replaceSelection`/`insert` |
| `h1`/`h2`/`h3` | no | yes | `setBlock: heading, level` |
| `bulletList` | no | yes | `setBlock: bulletList` |
| `orderedList` | no | yes | `setBlock: orderedList` |
| `quote` | no | yes | `setBlock: blockquote` |
| `codeBlock` | no | yes | `setBlock: codeBlock` |
| `divider` | no | yes | `insert: '\n---\n'` |

## What changes in the codebase

- **New:** `command-core/plugin.types.ts` (SpotePlugin, contexts, PluginAction, PluginUI),
  `command-core/plugins/` (one file per built-in + `index.ts` exporting `DEFAULT_PLUGINS`),
  and per-adapter action interpreters (`codemirror/applyAction.ts`, `milkdown/applyAction.ts`).
- **Deleted:** `cmCommands.ts` Record, `milkdownCommands.ts` Record, `commands.ts` metadata
  list + `Command`/`CommandId` types, `BubbleAction` union + hardcoded `ACTIONS` in
  `SelectionBubble.tsx`, the `onRequestLink`/`requestLink` effect plumbing (folded into `ui`).
- **Changed:** `CommandMenu` renders slash-eligible plugins (those with `slash`);
  `SelectionBubble` renders bubble-eligible plugins (those with `bubble`); both call back
  with the plugin id. Adapters resolve the plugin, invoke the right surface handler with the
  right context, await it, and run the returned action through their interpreter. `SpoteEditor`
  prop becomes `plugins?: SpotePlugin[]` (default `DEFAULT_PLUGINS`); it owns the `ui` service
  (wraps the existing LinkPopover + `onSearchNotes`/`onResolveNoteHref`). Mode toggle stays
  shell chrome (not a plugin).

## Scope guardrails

No new engines, no image upload, no live-preview. Independent of the CSS-isolation note;
if both are scheduled, do command-plugins first (smaller blast radius).

## Open decisions

1. **Inline marks (bold/italic/code) in the slash menu.** v1 technically allowed them
   (inserting empty markers with no selection). Cleaner option: make them **bubble-only**
   (they need a selection). *Recommendation: bubble-only* — minor behavior change, better UX.
   If we must preserve v1 exactly, give them a `slash` handler that inserts empty markers.
2. **Raw engine escape hatch.** Allow a plugin to provide raw `cm(view)`/`milkdown(ctx)`
   handlers for operations the action vocabulary can't express? *Recommendation: defer
   (YAGNI)* — all 12 defaults fit the vocabulary; add later, non-breaking, if a real need appears.
3. **`ctx.ui` breadth.** v-next ships only `requestLink`. Add a generic `prompt(...)` and
   consumer-rendered popups now, or defer? *Recommendation: defer* — design `PluginUI` as an
   extensible namespace so additions don't break.
4. **Naming:** `SpotePlugin` + named exports (`bold`, `h1`, …) + `DEFAULT_PLUGINS`. Drop the
   old `DEFAULT_COMMANDS`/`Command`/`CommandId` exports (no external users at v0.x).

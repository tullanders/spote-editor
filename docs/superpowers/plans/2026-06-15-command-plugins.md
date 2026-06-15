# Command Plugins Refactor — Spec + Plan

> Follow-up to the spote-editor v1 build. Makes slash-menu AND selection-bubble items
> data-driven "command plugins": one object per command carrying metadata + per-engine
> execution + which surfaces it appears in. Consumers can add/remove/reorder items.
> **For agentic workers:** use subagent-driven-development or executing-plans. Steps use `- [ ]`.

**Goal:** Replace the split (metadata in `commands.ts` + handlers in `cmCommands.ts`/`milkdownCommands.ts`, hardcoded bubble) with a single `EditorCommandPlugin[]` that drives both menus and both engines, passed via `SpoteEditor`'s existing `commands` prop.

**Why:** The shared-core + thin-adapter architecture already separates UI from execution. Unifying metadata+handlers per command makes the command set extensible without editing adapters, makes the bubble configurable like the slash menu already is, and removes the two parallel `Record<CommandId>` tables (coverage becomes structural).

---

## Design

### The plugin type (new `command-core/plugin.types.ts`)

```ts
import type { EditorView } from '@codemirror/view'
import type { Ctx } from '@milkdown/ctx'

export type CommandSurface = 'slash' | 'bubble'

// Effects a handler can ask the shell to perform (escape hatch for non-edit actions).
export type CommandEffect =
  | { type: 'none' }
  | { type: 'requestLink' }   // shell opens LinkPopover, applies href to current selection

export interface CommandRun {
  // Return an effect (default { type: 'none' }) OR perform the edit directly.
  cm: (view: EditorView) => CommandEffect | void
  milkdown: (ctx: Ctx) => CommandEffect | void
}

export interface EditorCommandPlugin {
  id: string
  label: string
  icon: string
  group: string
  keywords: string[]
  surfaces: CommandSurface[]   // where it appears; e.g. ['slash'] or ['slash','bubble']
  run: CommandRun
}
```

Notes:
- `Command` (current metadata type) becomes a structural subset of `EditorCommandPlugin` — `CommandMenu`/`SelectionBubble` only read the metadata fields, so they need almost no change.
- The `requestLink` effect is the one genuinely new concept: link can't be a pure edit (it needs the shell's `LinkPopover`). The adapter runs `plugin.run.cm(view)`; if it returns `{type:'requestLink'}`, the adapter calls `onRequestLink(...)` exactly as today. Keeps the popover a shell concern.

### Data flow (unchanged shape)
`SpoteEditor` owns `commands: EditorCommandPlugin[]` (default = `DEFAULT_COMMAND_PLUGINS`), passes to the active adapter. Adapter renders `CommandMenu` (items where `surfaces` includes `'slash'`) and `SelectionBubble` (items where `surfaces` includes `'bubble'`). On select/action: look up plugin by id, call `plugin.run[engine](...)`, honor any returned effect.

### What gets deleted
- `cmCommands.ts` `handlers` Record and `milkdownCommands.ts` Record → folded into plugin `run`.
- `BubbleAction` union and the hardcoded `ACTIONS` list in `SelectionBubble.tsx`.
- `applyCmCommand` callers switch to `plugin.run.cm`.

### Migration of existing behavior
The 12 current commands become `DEFAULT_COMMAND_PLUGINS`. Handlers already exist — relocate them:
- CM handlers currently return `TransactionSpec`; wrap as `(view) => { view.dispatch(applyXxx(view.state)) }` or inline. Bold/italic/code/h1-3/lists/quote/codeblock/divider → `surfaces` as today (`bold/italic/code` in both slash+bubble; headings/lists/quote/codeblock/divider slash-only). `link` → `surfaces: ['slash','bubble']`, `run.cm`/`run.milkdown` return `{type:'requestLink'}`.

---

## Tasks

### Task 1: Plugin types + default plugin list
- [ ] Create `command-core/plugin.types.ts` (`EditorCommandPlugin`, `CommandSurface`, `CommandEffect`, `CommandRun`).
- [ ] Create `command-core/commandPlugins.ts`: `DEFAULT_COMMAND_PLUGINS: EditorCommandPlugin[]` for all 12 ids, folding in current CM + Milkdown handlers. Keep `filterCommands`/`commandById` working on the metadata subset (relax their param type to `EditorCommandPlugin[]` or a shared `CommandMeta`).
- [ ] Test: every id present, `surfaces` correct (link/bold/italic/code include 'bubble'; rest slash-only), `filterCommands` still matches label+keywords.
- [ ] Commit.

### Task 2: Make SelectionBubble data-driven
- [ ] Change `SelectionBubble` props to take the bubble-eligible plugins + `onSelect(commandId)` (drop `BubbleAction`/hardcoded ACTIONS).
- [ ] Test: renders one button per bubble plugin (label/icon), emits id on click.
- [ ] Commit.

### Task 3: CodeMirror adapter uses plugins
- [ ] In `CodeMirrorEditor`, filter plugins by surface for menu vs bubble; `runCommand`/`runBubble` look up the plugin and call `run.cm(view)`, handling `{type:'requestLink'}` via existing `onRequestLink`. Remove `applyCmCommand` switch usage (delete `cmCommands.ts` Record or keep pure helpers the plugins call).
- [ ] Keep `wrapOnType` unchanged. Build + existing tests green.
- [ ] Commit.

### Task 4: Milkdown adapter uses plugins
- [ ] Same as Task 3 for `MilkdownEditor`: plugin lookup + `run.milkdown(ctx)` + `requestLink` effect. Remove the `milkdownCommands` Record.
- [ ] Build green.
- [ ] Commit.

### Task 5: Shell + public API
- [ ] `SpoteEditorProps.commands?: EditorCommandPlugin[]`; default `DEFAULT_COMMAND_PLUGINS`. Update `src/index.ts` exports (`EditorCommandPlugin`, `CommandSurface`, `DEFAULT_COMMAND_PLUGINS`; keep `DEFAULT_COMMANDS` as a deprecated alias or remove — decide).
- [ ] Shell `SpoteEditor.test.tsx` still green; add a test that a custom plugin list renders a custom slash item.
- [ ] Commit.

### Task 6: Demo + docs
- [ ] Demo: add one custom example plugin (e.g. "insert date") to show extensibility.
- [ ] README: document the `EditorCommandPlugin` shape and the `commands` prop.
- [ ] Manual demo verification (browser). Commit.

---

## Open decisions
- Keep `DEFAULT_COMMANDS` as a back-compat alias, or hard-rename to `DEFAULT_COMMAND_PLUGINS`? (v0.x, no external users yet → likely just rename.)
- Should `CommandEffect` be extensible now (union) or kept minimal (`none` | `requestLink`) until a second effect appears? (YAGNI: keep minimal.)
- Per-plugin enable/disable in `readOnly` mode — out of scope for this refactor.

## Scope guardrails (unchanged from v1)
No new engines, no image upload, no live-preview. This refactor is structural only; user-visible behavior of the 12 default commands stays identical.

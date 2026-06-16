# Command Plugins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn every bubble and slash-menu item into a `SpotePlugin`. Built-ins become the default plugin set, authored with the same API consumers use. Drive both menus and both engines from one `plugins` array.

**Architecture:** Plugin = `{ id, label, icon, bubble?, slash? }`; placement is implicit in which surface handlers exist. Handlers receive a per-surface context (`bubble` gets `selectedText`; both get `ctx.ui`) and return a declarative `PluginAction`. Each adapter owns an action interpreter that realizes actions per engine — the only place engine knowledge lives. `ctx.ui.requestLink()` generalizes the old link popover so link is just a plugin.

**Spec:** `docs/superpowers/specs/2026-06-15-command-plugins-design.md` (approved). Open decisions resolved: inline marks are **bubble-only**; raw escape hatch **deferred**; `ctx.ui` ships **only `requestLink`**; rename to `SpotePlugin`/`DEFAULT_PLUGINS`, drop old `Command`/`CommandId`/`DEFAULT_COMMANDS`.

**Tech Stack:** React 18, TS strict, CodeMirror 6, Milkdown 7.21.2, Vitest + @testing-library/react.

---

## File Structure

```
src/components/SpoteEditor/
  SpoteEditor.tsx                 shell: plugins prop, owns ui.requestLink + LinkPopover
  SpoteEditor.types.ts            SpoteEditorProps (plugins?), NoteHit, EditorMode
  command-core/
    plugin.types.ts          NEW  SpotePlugin, BubbleContext, SlashContext, PluginAction, PluginUI
    plugins/                 NEW  one file per built-in + index
      marks.ts                    bold, italic, code   (bubble-only)
      link.ts                     link                 (bubble + slash)
      blocks.ts                   h1,h2,h3,bulletList,orderedList,quote,codeBlock,divider (slash)
      index.ts                    DEFAULT_PLUGINS + re-exports
    pluginMenu.ts            NEW  filter helpers (bubblePlugins, slashPlugins, filterByQuery, byId)
    CommandMenu.tsx               renders slash plugins; onSelect(id)
    SelectionBubble.tsx           renders bubble plugins; onSelect(id)
    useCommandMenu.ts             unchanged (generic over the metadata it lists)
    LinkPopover.tsx               unchanged
  codemirror/
    applyAction.ts           NEW  PluginAction -> TransactionSpec
    CodeMirrorEditor.tsx          wire plugins + ctx + applyAction
    wrapOnType.ts                 unchanged
  milkdown/
    applyAction.ts           NEW  PluginAction -> Milkdown ctx ops
    MilkdownEditor.tsx            wire plugins + ctx + applyAction
DELETED: command-core/commands.ts, command-core/commands.test.ts,
         codemirror/cmCommands.ts (+test), milkdown/milkdownCommands.ts,
         BubbleAction from core.types.ts
```

---

## Task 1: Plugin types

**Files:** Create `src/components/SpoteEditor/command-core/plugin.types.ts`. Test: `plugin.types.test.ts`.

- [ ] **Step 1: Write the failing compile/behavior test**

```ts
// plugin.types.test.ts — type-level + a tiny runtime assertion
import { describe, it, expect } from 'vitest'
import type { SpotePlugin, PluginAction } from './plugin.types'

describe('plugin.types', () => {
  it('a plugin with only bubble is valid and callable', async () => {
    const p: SpotePlugin = {
      id: 'x', label: 'X', icon: 'x',
      bubble: ({ selectedText }) => ({ kind: 'replaceSelection', markdown: `**${selectedText}**` }),
    }
    const action = await p.bubble!({ selectedText: 'hi', ui: { requestLink: async () => null } })
    expect(action).toEqual({ kind: 'replaceSelection', markdown: '**hi**' })
  })

  it('action union shape', () => {
    const a: PluginAction = { kind: 'toggleMark', mark: 'strong' }
    expect(a.kind).toBe('toggleMark')
  })
})
```

- [ ] **Step 2: Run — expect fail** (`npm test -- --run plugin.types`): "Cannot find module './plugin.types'".

- [ ] **Step 3: Write `plugin.types.ts`**

```ts
import type { ReactNode } from 'react'

export type PluginAction =
  | { kind: 'replaceSelection'; markdown: string }
  | { kind: 'insert'; markdown: string }
  | { kind: 'toggleMark'; mark: 'strong' | 'emphasis' | 'inlineCode' }
  | { kind: 'setBlock'; block: 'heading' | 'bulletList' | 'orderedList' | 'blockquote' | 'codeBlock'; attrs?: { level?: number } }

export interface PluginUI {
  /** Opens the link popover; resolves to an href, or null if cancelled. */
  requestLink: () => Promise<string | null>
}

export interface BubbleContext {
  selectedText: string
  ui: PluginUI
}

export interface SlashContext {
  ui: PluginUI
}

export type ActionResult = PluginAction | null

export type BubbleHandler = (ctx: BubbleContext) => ActionResult | Promise<ActionResult>
export type SlashHandler = (ctx: SlashContext) => ActionResult | Promise<ActionResult>

interface PluginBase {
  id: string
  label: string
  icon: ReactNode
}

// At least one surface handler required (a plugin with neither is a compile error).
export type SpotePlugin = PluginBase &
  ( { bubble: BubbleHandler; slash?: SlashHandler }
  | { bubble?: BubbleHandler; slash: SlashHandler } )
```

- [ ] **Step 4: Run — expect pass.** `npx tsc -p tsconfig.build.json --noEmit` clean.
- [ ] **Step 5: Commit** `feat: SpotePlugin types (per-surface handlers + action union)`

---

## Task 2: Built-in plugins + DEFAULT_PLUGINS

**Files:** Create `command-core/plugins/{marks,link,blocks,index}.ts`. Test: `command-core/plugins/plugins.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { bold, italic, code, link, h1, bulletList, quote, codeBlock, divider, DEFAULT_PLUGINS } from './index'

const ui = { requestLink: async () => 'https://x' }

describe('built-in plugins', () => {
  it('bold/italic/code are bubble-only toggleMark', () => {
    expect(bold.slash).toBeUndefined()
    expect(bold.bubble!({ selectedText: 'a', ui })).toEqual({ kind: 'toggleMark', mark: 'strong' })
    expect(italic.bubble!({ selectedText: 'a', ui })).toEqual({ kind: 'toggleMark', mark: 'emphasis' })
    expect(code.bubble!({ selectedText: 'a', ui })).toEqual({ kind: 'toggleMark', mark: 'inlineCode' })
  })

  it('link (bubble) wraps selection with the requested href', async () => {
    expect(await link.bubble!({ selectedText: 'Spote', ui })).toEqual({ kind: 'replaceSelection', markdown: '[Spote](https://x)' })
  })

  it('link (bubble) cancels to null', async () => {
    const cancelUi = { requestLink: async () => null }
    expect(await link.bubble!({ selectedText: 'Spote', ui: cancelUi })).toBeNull()
  })

  it('headings/lists/quote/codeblock are slash setBlock; divider inserts', () => {
    expect(h1.bubble).toBeUndefined()
    expect(h1.slash!({ ui })).toEqual({ kind: 'setBlock', block: 'heading', attrs: { level: 1 } })
    expect(bulletList.slash!({ ui })).toEqual({ kind: 'setBlock', block: 'bulletList' })
    expect(quote.slash!({ ui })).toEqual({ kind: 'setBlock', block: 'blockquote' })
    expect(codeBlock.slash!({ ui })).toEqual({ kind: 'setBlock', block: 'codeBlock' })
    expect(divider.slash!({ ui })).toEqual({ kind: 'insert', markdown: '\n---\n' })
  })

  it('DEFAULT_PLUGINS has unique ids and the v1 set', () => {
    const ids = DEFAULT_PLUGINS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining(['bold','italic','code','link','h1','h2','h3','bulletList','orderedList','quote','codeBlock','divider']))
  })
})
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Write the plugins.** `marks.ts`:

```ts
import type { SpotePlugin } from '../plugin.types'

export const bold: SpotePlugin = { id: 'bold', label: 'Fet', icon: 'B', bubble: () => ({ kind: 'toggleMark', mark: 'strong' }) }
export const italic: SpotePlugin = { id: 'italic', label: 'Kursiv', icon: 'I', bubble: () => ({ kind: 'toggleMark', mark: 'emphasis' }) }
export const code: SpotePlugin = { id: 'code', label: 'Kod', icon: '<>', bubble: () => ({ kind: 'toggleMark', mark: 'inlineCode' }) }
```

`link.ts`:

```ts
import type { SpotePlugin } from '../plugin.types'

export const link: SpotePlugin = {
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

`blocks.ts`:

```ts
import type { SpotePlugin } from '../plugin.types'

export const h1: SpotePlugin = { id: 'h1', label: 'Rubrik 1', icon: 'H1', slash: () => ({ kind: 'setBlock', block: 'heading', attrs: { level: 1 } }) }
export const h2: SpotePlugin = { id: 'h2', label: 'Rubrik 2', icon: 'H2', slash: () => ({ kind: 'setBlock', block: 'heading', attrs: { level: 2 } }) }
export const h3: SpotePlugin = { id: 'h3', label: 'Rubrik 3', icon: 'H3', slash: () => ({ kind: 'setBlock', block: 'heading', attrs: { level: 3 } }) }
export const bulletList: SpotePlugin = { id: 'bulletList', label: 'Punktlista', icon: '•', slash: () => ({ kind: 'setBlock', block: 'bulletList' }) }
export const orderedList: SpotePlugin = { id: 'orderedList', label: 'Numrerad lista', icon: '1.', slash: () => ({ kind: 'setBlock', block: 'orderedList' }) }
export const quote: SpotePlugin = { id: 'quote', label: 'Citat', icon: '❝', slash: () => ({ kind: 'setBlock', block: 'blockquote' }) }
export const codeBlock: SpotePlugin = { id: 'codeBlock', label: 'Kodblock', icon: '{}', slash: () => ({ kind: 'setBlock', block: 'codeBlock' }) }
export const divider: SpotePlugin = { id: 'divider', label: 'Avdelare', icon: '―', slash: () => ({ kind: 'insert', markdown: '\n---\n' }) }
```

`index.ts`:

```ts
export * from './marks'
export * from './link'
export * from './blocks'
import { bold, italic, code } from './marks'
import { link } from './link'
import { h1, h2, h3, bulletList, orderedList, quote, codeBlock, divider } from './blocks'
import type { SpotePlugin } from '../plugin.types'

export const DEFAULT_PLUGINS: SpotePlugin[] = [
  h1, h2, h3, bold, italic, code, codeBlock, bulletList, orderedList, quote, link, divider,
]
```

- [ ] **Step 4: Run — expect pass.** tsc clean.
- [ ] **Step 5: Commit** `feat: built-in command plugins + DEFAULT_PLUGINS`

---

## Task 3: Menu filter helpers

**Files:** Create `command-core/pluginMenu.ts`. Test: `pluginMenu.test.ts`. (Replaces the old `filterCommands`/`commandById`.)

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { slashPlugins, bubblePlugins, filterByQuery, pluginById, keywordsFor } from './pluginMenu'
import { DEFAULT_PLUGINS } from './plugins'

describe('pluginMenu', () => {
  it('slashPlugins excludes bubble-only marks', () => {
    expect(slashPlugins(DEFAULT_PLUGINS).map((p) => p.id)).not.toContain('bold')
    expect(slashPlugins(DEFAULT_PLUGINS).map((p) => p.id)).toContain('h1')
  })
  it('bubblePlugins includes marks + link', () => {
    expect(bubblePlugins(DEFAULT_PLUGINS).map((p) => p.id)).toEqual(expect.arrayContaining(['bold', 'italic', 'code', 'link']))
  })
  it('filterByQuery matches label case-insensitively', () => {
    expect(filterByQuery(slashPlugins(DEFAULT_PLUGINS), 'rubrik').map((p) => p.id)).toContain('h1')
    expect(filterByQuery(DEFAULT_PLUGINS, '').length).toBe(DEFAULT_PLUGINS.length)
  })
  it('pluginById', () => {
    expect(pluginById(DEFAULT_PLUGINS, 'link')?.label).toBe('Länk')
  })
})
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Write `pluginMenu.ts`**

```ts
import type { SpotePlugin } from './plugin.types'

export const slashPlugins = (plugins: SpotePlugin[]) => plugins.filter((p) => p.slash)
export const bubblePlugins = (plugins: SpotePlugin[]) => plugins.filter((p) => p.bubble)
export const pluginById = (plugins: SpotePlugin[], id: string) => plugins.find((p) => p.id === id)

// Optional label-based search for the slash menu. Label only in v1 (icons are ReactNode).
export function filterByQuery(plugins: SpotePlugin[], query: string): SpotePlugin[] {
  const q = query.trim().toLowerCase()
  if (!q) return plugins
  return plugins.filter((p) => p.label.toLowerCase().includes(q))
}
```

(Drop `keywordsFor` from the test if you decide keywords aren't carried on plugins — the spec dropped the `keywords` metadata field. Update the test to not import it. Keep label-based filtering.)

- [ ] **Step 4: Run — expect pass.** Remove the `keywordsFor` import from the test (it is not implemented; keywords were dropped with the metadata type). tsc clean.
- [ ] **Step 5: Commit** `feat: plugin menu filter helpers`

---

## Task 4: CodeMirror action interpreter

**Files:** Create `codemirror/applyAction.ts`. Test: `codemirror/applyAction.test.ts`. (Replaces `cmCommands.ts`.)

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { EditorState, EditorSelection } from '@codemirror/state'
import { applyAction } from './applyAction'
import type { PluginAction } from '../command-core/plugin.types'

function run(doc: string, from: number, to: number, action: PluginAction) {
  const state = EditorState.create({ doc, selection: EditorSelection.single(from, to) })
  return state.update(applyAction(state, action)).state.doc.toString()
}

describe('applyAction (CM)', () => {
  it('replaceSelection swaps the selection for markdown', () => {
    expect(run('hello world', 0, 5, { kind: 'replaceSelection', markdown: '[hello](u)' })).toBe('[hello](u) world')
  })
  it('insert puts markdown at the cursor', () => {
    expect(run('ab', 1, 1, { kind: 'insert', markdown: 'X' })).toBe('aXb')
  })
  it('toggleMark strong wraps the selection with **', () => {
    expect(run('hi', 0, 2, { kind: 'toggleMark', mark: 'strong' })).toBe('**hi**')
  })
  it('toggleMark strong unwraps when already wrapped', () => {
    expect(run('**hi**', 2, 4, { kind: 'toggleMark', mark: 'strong' })).toBe('hi')
  })
  it('setBlock heading prefixes the line', () => {
    expect(run('title', 0, 0, { kind: 'setBlock', block: 'heading', attrs: { level: 2 } })).toBe('## title')
  })
  it('setBlock bulletList prefixes with "- "', () => {
    expect(run('item', 0, 0, { kind: 'setBlock', block: 'bulletList' })).toBe('- item')
  })
  it('setBlock codeBlock fences the selection', () => {
    expect(run('x', 0, 1, { kind: 'setBlock', block: 'codeBlock' })).toContain('```')
  })
})
```

- [ ] **Step 2: Run — expect fail.**

- [ ] **Step 3: Write `applyAction.ts`**

```ts
import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state'
import type { PluginAction } from '../command-core/plugin.types'

const MARK_MARKER: Record<'strong' | 'emphasis' | 'inlineCode', string> = {
  strong: '**', emphasis: '*', inlineCode: '`',
}

function replaceSelection(state: EditorState, text: string): TransactionSpec {
  const r = state.selection.main
  return { changes: { from: r.from, to: r.to, insert: text }, selection: EditorSelection.cursor(r.from + text.length) }
}

function insertAtCursor(state: EditorState, text: string): TransactionSpec {
  const r = state.selection.main
  return { changes: { from: r.from, to: r.to, insert: text }, selection: EditorSelection.cursor(r.from + text.length) }
}

function toggleMark(state: EditorState, marker: string): TransactionSpec {
  const r = state.selection.main
  const len = marker.length
  const wrapped =
    r.from >= len && r.to + len <= state.doc.length &&
    state.sliceDoc(r.from - len, r.from) === marker &&
    state.sliceDoc(r.to, r.to + len) === marker
  if (wrapped) {
    return {
      changes: [
        { from: r.from - len, to: r.from },
        { from: r.to, to: r.to + len },
      ],
      selection: EditorSelection.range(r.from - len, r.to - len),
    }
  }
  return {
    changes: [
      { from: r.from, insert: marker },
      { from: r.to, insert: marker },
    ],
    selection: EditorSelection.range(r.from + len, r.to + len),
  }
}

function linePrefix(state: EditorState, prefix: string): TransactionSpec {
  const line = state.doc.lineAt(state.selection.main.from)
  return { changes: { from: line.from, insert: prefix }, selection: EditorSelection.cursor(state.selection.main.from + prefix.length) }
}

const BLOCK_PREFIX: Record<'bulletList' | 'orderedList' | 'blockquote', string> = {
  bulletList: '- ', orderedList: '1. ', blockquote: '> ',
}

export function applyAction(state: EditorState, action: PluginAction): TransactionSpec {
  switch (action.kind) {
    case 'replaceSelection': return replaceSelection(state, action.markdown)
    case 'insert': return insertAtCursor(state, action.markdown)
    case 'toggleMark': return toggleMark(state, MARK_MARKER[action.mark])
    case 'setBlock':
      if (action.block === 'heading') return linePrefix(state, '#'.repeat(action.attrs?.level ?? 1) + ' ')
      if (action.block === 'codeBlock') {
        const r = state.selection.main
        const body = state.sliceDoc(r.from, r.to)
        const text = '```\n' + body + '\n```'
        return { changes: { from: r.from, to: r.to, insert: text }, selection: EditorSelection.cursor(r.from + 4) }
      }
      return linePrefix(state, BLOCK_PREFIX[action.block])
  }
}
```

- [ ] **Step 4: Run — expect pass** (7 tests). tsc clean. Adjust the codeBlock cursor offset only if a test fails; do not weaken assertions.
- [ ] **Step 5: Commit** `feat: CodeMirror action interpreter`

---

## Task 5: SelectionBubble is data-driven

**Files:** Modify `command-core/SelectionBubble.tsx` + its test. Remove `BubbleAction` from `core.types.ts`.

- [ ] **Step 1: Rewrite the test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SelectionBubble } from './SelectionBubble'
import { bubblePlugins } from './pluginMenu'
import { DEFAULT_PLUGINS } from './plugins'

describe('SelectionBubble', () => {
  it('renders one button per bubble plugin and emits id', async () => {
    const onSelect = vi.fn()
    render(<SelectionBubble plugins={bubblePlugins(DEFAULT_PLUGINS)} position={{ x: 0, y: 0 }} onSelect={onSelect} />)
    expect(screen.getByRole('button', { name: 'Fet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skapa länk' === undefined ? 'Länk' : 'Länk' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fet' }))
    expect(onSelect).toHaveBeenCalledWith('bold')
  })
})
```

(Use the real labels from the plugins: `Fet`, `Kursiv`, `Kod`, `Länk`. Fix the awkward expression above to a plain `screen.getByRole('button', { name: 'Länk' })`.)

- [ ] **Step 2: Run — expect fail** (old props).

- [ ] **Step 3: Rewrite `SelectionBubble.tsx`**

```tsx
import { createPortal } from 'react-dom'
import type { SpotePlugin } from './plugin.types'
import type { MenuPosition } from './useCommandMenu'

export interface SelectionBubbleProps {
  plugins: SpotePlugin[]
  position: MenuPosition
  onSelect: (id: string) => void
}

export function SelectionBubble({ plugins, position, onSelect }: SelectionBubbleProps) {
  return createPortal(
    <div className="spote-bubble" style={{ position: 'fixed', left: position.x, top: position.y }}>
      {plugins.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-label={p.label}
          className="spote-bubble__btn"
          onMouseDown={(e) => { e.preventDefault(); onSelect(p.id) }}
        >
          {p.icon}
        </button>
      ))}
    </div>,
    document.body,
  )
}
```

- [ ] **Step 4:** Remove `BubbleAction` from `core.types.ts` (and any remaining import). Run test — expect pass. tsc clean.
- [ ] **Step 5: Commit** `refactor: data-driven SelectionBubble from plugins`

---

## Task 6: CommandMenu renders slash plugins

**Files:** Modify `command-core/CommandMenu.tsx` + test. `useCommandMenu` is generic; pass it slash plugins.

- [ ] **Step 1: Update the test** to pass `results={slashPlugins(DEFAULT_PLUGINS)}` and assert a slash label (e.g. `Rubrik 1`) renders, Enter selects its id (`h1`), Escape closes, click selects. Keep the existing keyboard/portal assertions.

```tsx
import { slashPlugins } from './pluginMenu'
import { DEFAULT_PLUGINS } from './plugins'
const results = slashPlugins(DEFAULT_PLUGINS)
// render <CommandMenu results={results} activeIndex={0} ... />
// getByText('Rubrik 1'); Enter -> onSelect('h1'); click 'Citat' -> onSelect('quote')
```

- [ ] **Step 2: Run — expect fail** (type/label changes).

- [ ] **Step 3: Update `CommandMenu.tsx`**: change `results: Command[]` to `results: SpotePlugin[]`, render `p.icon` + `p.label`, `onSelect(p.id)`. Keep portal + capture-phase keydown + click-outside exactly as-is.

- [ ] **Step 4:** Update `useCommandMenu` if it imported `Command`/`filterCommands`: switch its filter to `filterByQuery` from `pluginMenu` and its type to `SpotePlugin[]`. Run the menu + hook tests — expect green.
- [ ] **Step 5: Commit** `refactor: CommandMenu + useCommandMenu over plugins`

---

## Task 7: Shell owns plugins + the ui.requestLink service

**Files:** Modify `SpoteEditor.tsx`, `SpoteEditor.types.ts`, `src/index.ts`, `SpoteEditor.test.tsx`.

The shell exposes `requestLink(position) => Promise<string|null>` to adapters (replaces `onRequestLink`). It renders a single `LinkPopover` for the pending request and resolves the promise on submit/cancel, wiring `onSearchNotes`/`onResolveNoteHref` as today.

- [ ] **Step 1: Update `SpoteEditor.types.ts`**

```ts
import type { SpotePlugin } from './command-core/plugin.types'
// SpoteEditorProps: replace `commands?: Command[]` with:
plugins?: SpotePlugin[]
// keep value,onChange,mode,onModeChange,onSearchNotes,onResolveNoteHref,placeholder,readOnly,className,autoFocus
```

- [ ] **Step 2: Update the shell test** (engines mocked) to assert: default renders WYSIWYG; toggle to raw; controlled mode + onModeChange (existing 3 tests, unchanged behavior). Add: passing a custom `plugins={[customSlashPlugin]}` reaches the engine (mock captures the `plugins` prop and asserts the custom id present).

- [ ] **Step 3: Rewrite shell internals**

```tsx
import { useState, useCallback, useRef } from 'react'
import type { SpoteEditorProps, EditorMode } from './SpoteEditor.types'
import { DEFAULT_PLUGINS } from './command-core/plugins'
import { CodeMirrorEditor } from './codemirror/CodeMirrorEditor'
import { MilkdownEditor } from './milkdown/MilkdownEditor'
import { LinkPopover } from './command-core/LinkPopover'
import type { MenuPosition } from './command-core/useCommandMenu'
import type { SpotePlugin } from './command-core/plugin.types'

const DEFAULTS: SpotePlugin[] = DEFAULT_PLUGINS

interface PendingLink { position: MenuPosition; resolve: (href: string | null) => void }

export function SpoteEditor(props: SpoteEditorProps) {
  const { value, onChange, mode: modeProp, onModeChange, onSearchNotes, onResolveNoteHref,
          plugins = DEFAULTS, readOnly, className, autoFocus, placeholder } = props
  const [internalMode, setInternalMode] = useState<EditorMode>('wysiwyg')
  const mode = modeProp ?? internalMode
  const [pending, setPending] = useState<PendingLink | null>(null)
  const pendingRef = useRef<PendingLink | null>(null); pendingRef.current = pending

  const setMode = useCallback((next: EditorMode) => {
    if (modeProp == null) setInternalMode(next)
    onModeChange?.(next)
  }, [modeProp, onModeChange])

  const requestLink = useCallback((position: MenuPosition) =>
    new Promise<string | null>((resolve) => setPending({ position, resolve })), [])

  const Engine = mode === 'raw' ? CodeMirrorEditor : MilkdownEditor

  return (
    <div className={'spote-editor' + (className ? ' ' + className : '')}>
      <div className="spote-editor__toolbar">
        <button type="button" className="spote-editor__mode-toggle"
          onClick={() => setMode(mode === 'raw' ? 'wysiwyg' : 'raw')}>
          {mode === 'raw' ? 'WYSIWYG' : 'Raw markdown'}
        </button>
      </div>
      <Engine value={value} onChange={onChange} plugins={plugins} readOnly={readOnly}
        autoFocus={autoFocus} placeholder={placeholder} requestLink={requestLink} />
      {pending && (
        <LinkPopover position={pending.position} onSearchNotes={onSearchNotes} onResolveNoteHref={onResolveNoteHref}
          onSubmitHref={(href) => { pending.resolve(href); setPending(null) }}
          onCancel={() => { pending.resolve(null); setPending(null) }} />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Update `src/index.ts`**

```ts
import './styles/index.css'
export { SpoteEditor } from './components/SpoteEditor'
export type { SpoteEditorProps, NoteHit, EditorMode } from './components/SpoteEditor'
export { DEFAULT_PLUGINS, bold, italic, code, link, h1, h2, h3, bulletList, orderedList, quote, codeBlock, divider } from './components/SpoteEditor/command-core/plugins'
export type { SpotePlugin, PluginAction, BubbleContext, SlashContext, PluginUI } from './components/SpoteEditor/command-core/plugin.types'
```

Remove old `DEFAULT_COMMANDS`/`Command`/`CommandGroup`/`BubbleAction` exports.

- [ ] **Step 5:** Run shell + full suite. tsc clean (will fail until adapters are updated — Tasks 8/9 — so this task's build check may show adapter prop mismatches; complete it together with Task 8/9 if needed, OR stub the adapter prop types here first). **Order note:** if the shell references the new adapter props, do Task 8 before declaring the shell build green. Sequence: implement shell + adapters, then verify build once at the end of Task 9.
- [ ] **Step 6: Commit** `refactor: SpoteEditor shell over plugins + ui.requestLink`

---

## Task 8: CodeMirror adapter wires plugins

**Files:** Modify `codemirror/CodeMirrorEditor.tsx`. Delete `codemirror/cmCommands.ts` (+ its test).

- [ ] **Step 1:** Change props: `plugins: SpotePlugin[]`, `requestLink: (position: MenuPosition) => Promise<string | null>` (remove `commands`, `onRequestLink`). Build `bubblePlugins`/`slashPlugins` from `plugins`.
- [ ] **Step 2:** Menu: render `slashPlugins(plugins)`; on select, `removeSlashFragment`, resolve plugin via `pluginById`, build `ctx = { ui: { requestLink: () => requestLink(coordsAtCaret) } }`, `const action = await plugin.slash?.(ctx)`, if action `view.dispatch(applyAction(view.state, action))`, focus, close.
- [ ] **Step 3:** Bubble: render `bubblePlugins(plugins)`; on select, snapshot `{from,to}`, `selectedText = sliceDoc(from,to)`, `ctx = { selectedText, ui }`, `const action = await plugin.bubble?.(ctx)`; for `replaceSelection`/`toggleMark` apply against the (clamped) snapshot range — set selection to that range before `applyAction`, or pass the range into a small helper. Keep `wrapOnType` unchanged.
- [ ] **Step 4:** Delete `cmCommands.ts` + `cmCommands.test.ts`.
- [ ] **Step 5: `npm run build`** — compile clean. No unit test for the wrapper (jsdom); behavior verified in the demo (Task 10).
- [ ] **Step 6: Commit** `refactor: CodeMirror adapter uses plugins + action interpreter`

---

## Task 9: Milkdown adapter wires plugins

**Files:** Modify `milkdown/MilkdownEditor.tsx`, create `milkdown/applyAction.ts`. Delete `milkdown/milkdownCommands.ts`.

> **Verify Milkdown 7.21.2 APIs** (already confirmed available in the v1 build, re-check signatures): `callCommand`, `toggleStrongCommand`/`toggleEmphasisCommand`/`toggleInlineCodeCommand`, `wrapInHeadingCommand`/`wrapInBulletListCommand`/`wrapInOrderedListCommand`/`wrapInBlockquoteCommand`/`createCodeBlockCommand`, `insertHrCommand`, and for `replaceSelection`/`insert` the parser slice — check `parserCtx` (`@milkdown/core`) to parse a markdown fragment to a ProseMirror node, then replace selection / insert. Read node_modules d.ts if unsure.

- [ ] **Step 1: Write `milkdown/applyAction.ts`** — `applyAction(ctx: Ctx, action: PluginAction)`:
  - `toggleMark` → `callCommand(toggleStrongCommand.key)` etc.
  - `setBlock heading` → `callCommand(wrapInHeadingCommand.key, level)`; lists/blockquote/codeBlock → respective wrap/create commands.
  - `replaceSelection`/`insert` → parse `action.markdown` via `parserCtx`, then dispatch a ProseMirror tr replacing the selection (replaceSelection) or inserting at cursor (insert). For inline-only markdown (the built-in `link`), insert the parsed inline content. Document this as the bit to confirm in the demo.
- [ ] **Step 2:** Change `MilkdownEditor` props to `{ plugins, requestLink, ... }` (match CodeMirrorEditor). Render `slashPlugins`/`bubblePlugins`. Slash select: remove `/query`, resolve plugin, `await plugin.slash?.(ctx)`, run `applyAction(ctx, action)`. Bubble: `selectedText` from selection, `await plugin.bubble?.(ctx)`, run `applyAction`. `ctx.ui.requestLink` calls the prop with the caret coords.
- [ ] **Step 3:** Delete `milkdownCommands.ts`.
- [ ] **Step 4: `npm run build`** clean; `npm test -- --run` fully green (all remaining suites). No `any`/VERIFY left.
- [ ] **Step 5: Commit** `refactor: Milkdown adapter uses plugins + action interpreter`

---

## Task 10: Demo + docs + manual verification

**Files:** Modify `demo/src/App.tsx`, `README.md`.

- [ ] **Step 1:** Demo: add a custom plugin to prove extensibility, e.g.:

```ts
const insertDate = {
  id: 'date', label: 'Datum', icon: '📅',
  slash: () => ({ kind: 'insert', markdown: new Date().toISOString().slice(0, 10) }),
}
// <SpoteEditor plugins={[...DEFAULT_PLUGINS, insertDate]} ... />
```

- [ ] **Step 2:** README: document the `SpotePlugin` shape (`bubble?`/`slash?`, contexts, `PluginAction`, `ctx.ui.requestLink`) and the `plugins` prop; show the custom-plugin example.
- [ ] **Step 3: Manual demo verification** (`npm run dev`): in BOTH modes — slash shows the same items (incl. the custom one); selecting a slash block transforms the block; bubble shows bold/italic/code/link on a selection; bold toggles on AND off; link opens the popover and produces a link (URL and note-search); custom plugins work. Toggling modes preserves content.
- [ ] **Step 4: Final:** `npm test -- --run && npm run lint && npm run build` all green.
- [ ] **Step 5: Commit** `feat: demo + docs for command plugins`

---

## Self-Review Notes (author)

- **Spec coverage:** plugin shape + at-least-one-surface union (Task 1); built-ins incl. inline-marks-bubble-only + link-as-plugin (Task 2); placement-via-handler filters (Task 3); action interpreters CM (Task 4) + Milkdown (Task 9); data-driven bubble (Task 5) + menu (Task 6); shell `plugins` prop + `ui.requestLink` framework (Task 7); adapters (Tasks 8–9); deletions of `commands.ts`/`cmCommands.ts`/`milkdownCommands.ts`/`BubbleAction` folded into Tasks 5/6/8/9; demo+docs (Task 10). Open decisions all resolved per spec.
- **Type consistency:** `SpotePlugin`, `PluginAction`, `BubbleContext`/`SlashContext`, `PluginUI.requestLink` used identically across plugins, interpreters, adapters, shell. Both adapters share prop shape `{ value,onChange,plugins,readOnly,autoFocus,placeholder,requestLink }`.
- **Known soft spots (manual demo):** Milkdown `replaceSelection`/`insert` via parser-slice (inline focus for link); CM `toggleMark` unwrap heuristic relies on adjacent markers; both wrappers remain non-unit-tested in jsdom. `keywords` search dropped with the metadata type — slash filtering is label-only now (note if you want keywords back, add a `keywords?: string[]` to `PluginBase`).

# spote-editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, publishable React component `SpoteEditor` with a WYSIWYG mode (Milkdown) and a raw-markdown mode (CodeMirror 6), sharing one slash menu and one selection bubble across both modes.

**Architecture:** A thin `SpoteEditor` shell owns the markdown string (`value`/`onChange`) and the mode toggle. An engine-agnostic core (`command-core/`) holds the command metadata list and the shared UI components (`CommandMenu`, `SelectionBubble`, `LinkPopover`). Two thin adapters (Milkdown, CodeMirror) translate a `commandId`/action into an engine-specific edit. The markdown string is the single source of truth, so toggling modes preserves content.

**Tech Stack:** React 18, TypeScript (strict), Vite library mode, Milkdown (ProseMirror/remark), CodeMirror 6 (`@codemirror/*`), Vitest + @testing-library/react + jsdom.

---

## File Structure

```
src/
  index.ts                              public exports
  components/SpoteEditor/
    SpoteEditor.tsx                     shell: value/mode, picks engine, renders overlays
    SpoteEditor.types.ts                SpoteEditorProps, NoteHit, EditorMode
    index.ts
    command-core/
      commands.ts                       command metadata + derived CommandId type
      useCommandMenu.ts                 open/query/activeIndex/position state
      CommandMenu.tsx                   shared slash UI (portal/floating)
      SelectionBubble.tsx               shared bubble (bold/italic/code/link)
      LinkPopover.tsx                   URL field + note search
      core.types.ts                     shared core types (Command, bubble action, etc.)
    codemirror/
      wrapOnType.ts                     pure wrap-on-type logic + CM extension
      cmCommands.ts                     commandId -> CM6 edit
      slashExtension.ts                 ViewPlugin: detect '/', report caret coords
      CodeMirrorEditor.tsx              CM6 instance + overlays wiring
    milkdown/
      milkdownCommands.ts               commandId -> ProseMirror transaction
      slashPlugin.ts                    PM plugin: detect '/', report caret coords
      MilkdownEditor.tsx                Milkdown instance + overlays wiring
  styles/index.css                      CSS variables + component styles
demo/src/App.tsx                        demo harness (controlled value, onSearchNotes stub)
vitest.config.ts                        test config (jsdom, setup)
vitest.setup.ts                         jest-dom matchers
```

Each file has one responsibility. The core never imports from `codemirror/` or `milkdown/`. Adapters import from the core, never from each other.

---

## Task 0: Testing infrastructure

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Modify: `package.json` (devDependencies, no script changes — `test` already runs `vitest`)

- [ ] **Step 1: Install test + runtime dependencies**

Run:
```bash
npm install -D jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
npm install @milkdown/core @milkdown/react @milkdown/preset-commonmark @milkdown/preset-gfm @milkdown/utils @milkdown/ctx @milkdown/prose @codemirror/state @codemirror/view @codemirror/commands @codemirror/lang-markdown @codemirror/language
```
Expected: installs succeed, `package.json` updated. (Milkdown packages are peers of each other; if npm reports a missing Milkdown peer, install the exact package it names.)

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

- [ ] **Step 3: Create `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4: Smoke-test the harness**

Create a throwaway test `src/__smoke__.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
describe('harness', () => { it('runs', () => { expect(1 + 1).toBe(2) }) })
```
Run: `npm test -- --run`
Expected: PASS. Then delete `src/__smoke__.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts
git commit -m "chore: add vitest + testing-library + editor deps"
```

---

## Task 1: Types and command metadata

**Files:**
- Create: `src/components/SpoteEditor/SpoteEditor.types.ts`
- Create: `src/components/SpoteEditor/command-core/core.types.ts`
- Create: `src/components/SpoteEditor/command-core/commands.ts`
- Test: `src/components/SpoteEditor/command-core/commands.test.ts`

- [ ] **Step 1: Write `SpoteEditor.types.ts`**

```ts
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
  commands?: Command[]
  placeholder?: string
  readOnly?: boolean
  className?: string
  autoFocus?: boolean
}

import type { Command } from './command-core/core.types'
```

- [ ] **Step 2: Write `core.types.ts`**

```ts
export type CommandGroup = 'heading' | 'inline' | 'block' | 'list'

export interface Command {
  id: string
  label: string
  icon: string          // short glyph/text, kept simple for v1
  group: CommandGroup
  keywords: string[]
}

// Selection-bubble actions are a fixed, small set in v1.
export type BubbleAction = 'bold' | 'italic' | 'code' | 'link'
```

- [ ] **Step 3: Write the failing test for the default command list**

```ts
// commands.test.ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_COMMANDS, commandById } from './commands'

describe('DEFAULT_COMMANDS', () => {
  it('has unique ids', () => {
    const ids = DEFAULT_COMMANDS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('includes the v1 baseline commands', () => {
    const ids = DEFAULT_COMMANDS.map((c) => c.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'h1', 'h2', 'h3', 'bold', 'italic', 'code', 'codeblock',
        'bullet-list', 'ordered-list', 'quote', 'link', 'divider',
      ]),
    )
  })

  it('looks up by id', () => {
    expect(commandById('h1')?.label).toBeTruthy()
    expect(commandById('nope')).toBeUndefined()
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- --run commands`
Expected: FAIL ("Cannot find module './commands'").

- [ ] **Step 5: Write `commands.ts`**

```ts
import type { Command } from './core.types'

export const DEFAULT_COMMANDS: Command[] = [
  { id: 'h1', label: 'Rubrik 1', icon: 'H1', group: 'heading', keywords: ['heading', 'rubrik', 'titel'] },
  { id: 'h2', label: 'Rubrik 2', icon: 'H2', group: 'heading', keywords: ['heading', 'rubrik'] },
  { id: 'h3', label: 'Rubrik 3', icon: 'H3', group: 'heading', keywords: ['heading', 'rubrik'] },
  { id: 'bold', label: 'Fet', icon: 'B', group: 'inline', keywords: ['bold', 'fet', 'stark'] },
  { id: 'italic', label: 'Kursiv', icon: 'I', group: 'inline', keywords: ['italic', 'kursiv'] },
  { id: 'code', label: 'Kod', icon: '<>', group: 'inline', keywords: ['code', 'kod', 'inline'] },
  { id: 'codeblock', label: 'Kodblock', icon: '{}', group: 'block', keywords: ['code', 'kod', 'block', 'pre'] },
  { id: 'bullet-list', label: 'Punktlista', icon: '•', group: 'list', keywords: ['list', 'lista', 'punkt', 'bullet'] },
  { id: 'ordered-list', label: 'Numrerad lista', icon: '1.', group: 'list', keywords: ['list', 'lista', 'numrerad', 'ordered'] },
  { id: 'quote', label: 'Citat', icon: '❝', group: 'block', keywords: ['quote', 'citat', 'blockquote'] },
  { id: 'link', label: 'Länk', icon: '🔗', group: 'inline', keywords: ['link', 'länk', 'url'] },
  { id: 'divider', label: 'Avdelare', icon: '―', group: 'block', keywords: ['divider', 'avdelare', 'hr', 'rule'] },
] as const

// Derive the command-id union from the default list so adapters can be type-checked
// against the exact same key set.
export type CommandId = (typeof DEFAULT_COMMANDS)[number]['id']

export function commandById(id: string, commands: Command[] = DEFAULT_COMMANDS): Command | undefined {
  return commands.find((c) => c.id === id)
}

export function filterCommands(query: string, commands: Command[] = DEFAULT_COMMANDS): Command[] {
  const q = query.trim().toLowerCase()
  if (!q) return commands
  return commands.filter(
    (c) => c.label.toLowerCase().includes(q) || c.keywords.some((k) => k.toLowerCase().includes(q)),
  )
}
```

- [ ] **Step 6: Add a filter test**

Append to `commands.test.ts`:
```ts
import { filterCommands } from './commands'

describe('filterCommands', () => {
  it('returns all on empty query', () => {
    expect(filterCommands('').length).toBe(DEFAULT_COMMANDS.length)
  })
  it('matches label and keywords case-insensitively', () => {
    expect(filterCommands('FET').map((c) => c.id)).toContain('bold')
    expect(filterCommands('lista').map((c) => c.id)).toEqual(
      expect.arrayContaining(['bullet-list', 'ordered-list']),
    )
  })
})
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- --run commands`
Expected: PASS (all describe blocks).

- [ ] **Step 8: Commit**

```bash
git add src/components/SpoteEditor/SpoteEditor.types.ts src/components/SpoteEditor/command-core/core.types.ts src/components/SpoteEditor/command-core/commands.ts src/components/SpoteEditor/command-core/commands.test.ts
git commit -m "feat: command metadata list with derived CommandId type"
```

---

## Task 2: useCommandMenu hook

Owns slash-menu UI state independent of any engine: whether it is open, the current query, the active index, and an anchor position. The engine adapters drive it via callbacks; the engine does not know the menu internals.

**Files:**
- Create: `src/components/SpoteEditor/command-core/useCommandMenu.ts`
- Test: `src/components/SpoteEditor/command-core/useCommandMenu.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCommandMenu } from './useCommandMenu'
import { DEFAULT_COMMANDS } from './commands'

describe('useCommandMenu', () => {
  it('starts closed', () => {
    const { result } = renderHook(() => useCommandMenu(DEFAULT_COMMANDS))
    expect(result.current.open).toBe(false)
  })

  it('opens at a position and resets index/query', () => {
    const { result } = renderHook(() => useCommandMenu(DEFAULT_COMMANDS))
    act(() => result.current.openAt({ x: 10, y: 20 }))
    expect(result.current.open).toBe(true)
    expect(result.current.position).toEqual({ x: 10, y: 20 })
    expect(result.current.activeIndex).toBe(0)
    expect(result.current.query).toBe('')
  })

  it('filters results by query', () => {
    const { result } = renderHook(() => useCommandMenu(DEFAULT_COMMANDS))
    act(() => result.current.openAt({ x: 0, y: 0 }))
    act(() => result.current.setQuery('fet'))
    expect(result.current.results.map((c) => c.id)).toContain('bold')
  })

  it('clamps active index to results length when navigating', () => {
    const { result } = renderHook(() => useCommandMenu(DEFAULT_COMMANDS))
    act(() => result.current.openAt({ x: 0, y: 0 }))
    act(() => result.current.move(-1)) // up from 0 stays at 0
    expect(result.current.activeIndex).toBe(0)
    act(() => result.current.move(1))
    expect(result.current.activeIndex).toBe(1)
  })

  it('close resets open flag', () => {
    const { result } = renderHook(() => useCommandMenu(DEFAULT_COMMANDS))
    act(() => result.current.openAt({ x: 0, y: 0 }))
    act(() => result.current.close())
    expect(result.current.open).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run useCommandMenu`
Expected: FAIL ("Cannot find module './useCommandMenu'").

- [ ] **Step 3: Write `useCommandMenu.ts`**

```ts
import { useMemo, useState, useCallback } from 'react'
import type { Command } from './core.types'
import { filterCommands } from './commands'

export interface MenuPosition { x: number; y: number }

export function useCommandMenu(commands: Command[]) {
  const [open, setOpen] = useState(false)
  const [query, setQueryState] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 })

  const results = useMemo(() => filterCommands(query, commands), [query, commands])

  const openAt = useCallback((pos: MenuPosition) => {
    setPosition(pos)
    setQueryState('')
    setActiveIndex(0)
    setOpen(true)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  const setQuery = useCallback((q: string) => {
    setQueryState(q)
    setActiveIndex(0)
  }, [])

  const move = useCallback(
    (delta: number) => {
      setActiveIndex((i) => {
        const max = Math.max(filterCommands(query, commands).length - 1, 0)
        return Math.min(Math.max(i + delta, 0), max)
      })
    },
    [query, commands],
  )

  return { open, query, activeIndex, position, results, openAt, close, setQuery, move, setActiveIndex }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run useCommandMenu`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SpoteEditor/command-core/useCommandMenu.ts src/components/SpoteEditor/command-core/useCommandMenu.test.ts
git commit -m "feat: useCommandMenu state hook"
```

---

## Task 3: CommandMenu component

Shared slash-menu UI. Renders into a portal at a fixed position, filters as the user types (driven by props), handles ArrowUp/ArrowDown/Enter/Escape, and calls `onSelect(commandId)`. Knows nothing about which engine is underneath.

**Files:**
- Create: `src/components/SpoteEditor/command-core/CommandMenu.tsx`
- Test: `src/components/SpoteEditor/command-core/CommandMenu.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommandMenu } from './CommandMenu'
import { DEFAULT_COMMANDS } from './commands'

function setup(overrides = {}) {
  const onSelect = vi.fn()
  const onClose = vi.fn()
  render(
    <CommandMenu
      results={DEFAULT_COMMANDS}
      activeIndex={0}
      position={{ x: 0, y: 0 }}
      onSelect={onSelect}
      onClose={onClose}
      onMove={vi.fn()}
      {...overrides}
    />,
  )
  return { onSelect, onClose }
}

describe('CommandMenu', () => {
  it('renders all results', () => {
    setup()
    expect(screen.getByText('Rubrik 1')).toBeInTheDocument()
    expect(screen.getByText('Punktlista')).toBeInTheDocument()
  })

  it('Enter selects the active command', async () => {
    const { onSelect } = setup({ activeIndex: 0 })
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('h1')
  })

  it('Escape closes', async () => {
    const { onClose } = setup()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('clicking an item selects it', async () => {
    const { onSelect } = setup()
    await userEvent.click(screen.getByText('Citat'))
    expect(onSelect).toHaveBeenCalledWith('quote')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run CommandMenu`
Expected: FAIL ("Cannot find module './CommandMenu'").

- [ ] **Step 3: Write `CommandMenu.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Command } from './core.types'
import type { MenuPosition } from './useCommandMenu'

export interface CommandMenuProps {
  results: Command[]
  activeIndex: number
  position: MenuPosition
  onSelect: (commandId: string) => void
  onClose: () => void
  onMove: (delta: number) => void
}

export function CommandMenu({ results, activeIndex, position, onSelect, onClose, onMove }: CommandMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); onMove(1) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); onMove(-1) }
      else if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = results[activeIndex]
        if (cmd) onSelect(cmd.id)
      } else if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [results, activeIndex, onSelect, onClose, onMove])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className="spote-command-menu"
      role="listbox"
      style={{ position: 'fixed', left: position.x, top: position.y }}
    >
      {results.map((cmd, i) => (
        <button
          key={cmd.id}
          type="button"
          role="option"
          aria-selected={i === activeIndex}
          className={'spote-command-menu__item' + (i === activeIndex ? ' is-active' : '')}
          onMouseDown={(e) => { e.preventDefault(); onSelect(cmd.id) }}
        >
          <span className="spote-command-menu__icon">{cmd.icon}</span>
          <span className="spote-command-menu__label">{cmd.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run CommandMenu`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SpoteEditor/command-core/CommandMenu.tsx src/components/SpoteEditor/command-core/CommandMenu.test.tsx
git commit -m "feat: shared CommandMenu UI"
```

---

## Task 4: SelectionBubble component

Shared bubble shown when text is selected (double-click is just one way to select). Fixed action set: Bold, Italic, Code, Link. Calls `onAction(action)`. The Link action is special: it asks the parent to open the link popover.

**Files:**
- Create: `src/components/SpoteEditor/command-core/SelectionBubble.tsx`
- Test: `src/components/SpoteEditor/command-core/SelectionBubble.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SelectionBubble } from './SelectionBubble'

describe('SelectionBubble', () => {
  it('renders the four actions', () => {
    render(<SelectionBubble position={{ x: 0, y: 0 }} onAction={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Fet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kursiv' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kod' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skapa länk' })).toBeInTheDocument()
  })

  it('emits the action on click', async () => {
    const onAction = vi.fn()
    render(<SelectionBubble position={{ x: 0, y: 0 }} onAction={onAction} />)
    await userEvent.click(screen.getByRole('button', { name: 'Fet' }))
    expect(onAction).toHaveBeenCalledWith('bold')
    await userEvent.click(screen.getByRole('button', { name: 'Skapa länk' }))
    expect(onAction).toHaveBeenCalledWith('link')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run SelectionBubble`
Expected: FAIL ("Cannot find module './SelectionBubble'").

- [ ] **Step 3: Write `SelectionBubble.tsx`**

```tsx
import { createPortal } from 'react-dom'
import type { BubbleAction } from './core.types'
import type { MenuPosition } from './useCommandMenu'

export interface SelectionBubbleProps {
  position: MenuPosition
  onAction: (action: BubbleAction) => void
}

const ACTIONS: { action: BubbleAction; label: string; icon: string }[] = [
  { action: 'bold', label: 'Fet', icon: 'B' },
  { action: 'italic', label: 'Kursiv', icon: 'I' },
  { action: 'code', label: 'Kod', icon: '<>' },
  { action: 'link', label: 'Skapa länk', icon: '🔗' },
]

export function SelectionBubble({ position, onAction }: SelectionBubbleProps) {
  return createPortal(
    <div className="spote-bubble" style={{ position: 'fixed', left: position.x, top: position.y }}>
      {ACTIONS.map(({ action, label, icon }) => (
        <button
          key={action}
          type="button"
          aria-label={label}
          className="spote-bubble__btn"
          onMouseDown={(e) => { e.preventDefault(); onAction(action) }}
        >
          {icon}
        </button>
      ))}
    </div>,
    document.body,
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run SelectionBubble`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SpoteEditor/command-core/SelectionBubble.tsx src/components/SpoteEditor/command-core/SelectionBubble.test.tsx
git commit -m "feat: shared SelectionBubble UI"
```

---

## Task 5: LinkPopover component

Opened by the bubble's "link" action. One input. If the input parses as a URL, "Enter" produces a plain link. Otherwise it calls `onSearchNotes(query)` (when provided) and lists hits; selecting a hit resolves to an href via `onResolveNoteHref`. Without `onSearchNotes`, it silently behaves as a URL-only field.

**Files:**
- Create: `src/components/SpoteEditor/command-core/LinkPopover.tsx`
- Test: `src/components/SpoteEditor/command-core/LinkPopover.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LinkPopover } from './LinkPopover'

describe('LinkPopover', () => {
  it('submits a URL on Enter', async () => {
    const onSubmit = vi.fn()
    render(<LinkPopover position={{ x: 0, y: 0 }} onSubmitHref={onSubmit} onCancel={vi.fn()} />)
    await userEvent.type(screen.getByRole('textbox'), 'https://spote.cloud{Enter}')
    expect(onSubmit).toHaveBeenCalledWith('https://spote.cloud')
  })

  it('searches notes for non-URL text and resolves a hit', async () => {
    const onSubmit = vi.fn()
    const onSearchNotes = vi.fn().mockResolvedValue([{ id: 'n1', title: 'Projektplan' }])
    const onResolveNoteHref = vi.fn().mockReturnValue('spote://n1')
    render(
      <LinkPopover
        position={{ x: 0, y: 0 }}
        onSubmitHref={onSubmit}
        onCancel={vi.fn()}
        onSearchNotes={onSearchNotes}
        onResolveNoteHref={onResolveNoteHref}
      />,
    )
    await userEvent.type(screen.getByRole('textbox'), 'projekt')
    await waitFor(() => expect(screen.getByText('Projektplan')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Projektplan'))
    expect(onResolveNoteHref).toHaveBeenCalledWith({ id: 'n1', title: 'Projektplan' })
    expect(onSubmit).toHaveBeenCalledWith('spote://n1')
  })

  it('Escape cancels', async () => {
    const onCancel = vi.fn()
    render(<LinkPopover position={{ x: 0, y: 0 }} onSubmitHref={vi.fn()} onCancel={onCancel} />)
    await userEvent.type(screen.getByRole('textbox'), '{Escape}')
    expect(onCancel).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run LinkPopover`
Expected: FAIL ("Cannot find module './LinkPopover'").

- [ ] **Step 3: Write `LinkPopover.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { NoteHit } from '../SpoteEditor.types'
import type { MenuPosition } from './useCommandMenu'

export interface LinkPopoverProps {
  position: MenuPosition
  onSubmitHref: (href: string) => void
  onCancel: () => void
  onSearchNotes?: (query: string) => Promise<NoteHit[]>
  onResolveNoteHref?: (note: NoteHit) => string
}

function looksLikeUrl(text: string): boolean {
  return /^(https?:\/\/|mailto:|\/)/i.test(text.trim()) || /^[\w-]+\.[\w.-]+/.test(text.trim())
}

export function LinkPopover({ position, onSubmitHref, onCancel, onSearchNotes, onResolveNoteHref }: LinkPopoverProps) {
  const [value, setValue] = useState('')
  const [hits, setHits] = useState<NoteHit[]>([])

  useEffect(() => {
    const text = value.trim()
    if (!onSearchNotes || !text || looksLikeUrl(text)) { setHits([]); return }
    let cancelled = false
    onSearchNotes(text).then((res) => { if (!cancelled) setHits(res) })
    return () => { cancelled = true }
  }, [value, onSearchNotes])

  function submitHit(hit: NoteHit) {
    const href = onResolveNoteHref ? onResolveNoteHref(hit) : hit.id
    onSubmitHref(href)
  }

  return createPortal(
    <div className="spote-link-popover" style={{ position: 'fixed', left: position.x, top: position.y }}>
      <input
        autoFocus
        type="text"
        className="spote-link-popover__input"
        placeholder="Klistra URL eller sök not…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); if (value.trim()) onSubmitHref(value.trim()) }
          else if (e.key === 'Escape') { e.preventDefault(); onCancel() }
        }}
      />
      {hits.length > 0 && (
        <ul className="spote-link-popover__hits">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); submitHit(hit) }}>
                {hit.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body,
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run LinkPopover`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SpoteEditor/command-core/LinkPopover.tsx src/components/SpoteEditor/command-core/LinkPopover.test.tsx
git commit -m "feat: LinkPopover with URL + note search"
```

---

## Task 6: wrap-on-type (pure logic + CM extension)

The wrap behavior is pure and testable without a DOM: given a document, a selection range, and a typed character, produce the new text + adjusted range. We test the pure function, then wrap it in a CodeMirror `inputHandler`.

**Files:**
- Create: `src/components/SpoteEditor/codemirror/wrapOnType.ts`
- Test: `src/components/SpoteEditor/codemirror/wrapOnType.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { EditorState, EditorSelection } from '@codemirror/state'
import { wrapTransactionFor, WRAP_CHARS } from './wrapOnType'

function stateWithSelection(doc: string, from: number, to: number) {
  return EditorState.create({ doc, selection: EditorSelection.single(from, to) })
}

describe('wrapOnType', () => {
  it('wraps a non-empty selection with the typed char', () => {
    const state = stateWithSelection('hello world', 0, 5) // "hello"
    const spec = wrapTransactionFor(state, '*')
    expect(spec).not.toBeNull()
    const next = state.update(spec!).state
    expect(next.doc.toString()).toBe('*hello* world')
    // selection still covers "hello"
    expect(next.selection.main.from).toBe(1)
    expect(next.selection.main.to).toBe(6)
  })

  it('re-wraps to ** when * is typed on an already *-wrapped selection', () => {
    const state = stateWithSelection('*hello* world', 1, 6) // inner "hello"
    const spec = wrapTransactionFor(state, '*')
    const next = state.update(spec!).state
    expect(next.doc.toString()).toBe('**hello** world')
  })

  it('returns null for empty selection (lets default insert happen)', () => {
    const state = stateWithSelection('hello', 2, 2)
    expect(wrapTransactionFor(state, '*')).toBeNull()
  })

  it('returns null for non-wrap chars', () => {
    const state = stateWithSelection('hello', 0, 5)
    expect(wrapTransactionFor(state, 'x')).toBeNull()
  })

  it('handles _, backtick and ~', () => {
    expect(WRAP_CHARS).toEqual(expect.arrayContaining(['*', '_', '`', '~']))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run wrapOnType`
Expected: FAIL ("Cannot find module './wrapOnType'").

- [ ] **Step 3: Write `wrapOnType.ts`**

```ts
import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export const WRAP_CHARS = ['*', '_', '`', '~'] as const
export type WrapChar = (typeof WRAP_CHARS)[number]

function isWrapChar(ch: string): ch is WrapChar {
  return (WRAP_CHARS as readonly string[]).includes(ch)
}

// Detect that the selection is already directly wrapped by `ch` so we can re-wrap
// (e.g. *sel* -> **sel**). Only meaningful for '*' and '~' but harmless for others.
function isAlreadyWrapped(state: EditorState, from: number, to: number, ch: string): boolean {
  if (from < 1 || to > state.doc.length - 1) return false
  return state.sliceDoc(from - 1, from) === ch && state.sliceDoc(to, to + 1) === ch
}

/**
 * Returns a TransactionSpec that wraps each non-empty selection range with `ch`,
 * preserving the selection. Returns null when there is nothing to wrap (empty
 * selection or non-wrap char) so the caller can fall back to default insertion.
 */
export function wrapTransactionFor(state: EditorState, ch: string): TransactionSpec | null {
  if (!isWrapChar(ch)) return null
  if (state.selection.ranges.every((r) => r.empty)) return null

  const marker = ch
  const changes = state.changeByRange((range) => {
    if (range.empty) {
      return { range, changes: { from: range.from, insert: ch } }
    }
    const reWrap = isAlreadyWrapped(state, range.from, range.to, ch)
    const insert = marker
    const startInsertAt = reWrap ? range.from - 1 : range.from
    const endInsertAt = reWrap ? range.to + 1 : range.to
    return {
      changes: [
        { from: startInsertAt, insert },
        { from: endInsertAt, insert },
      ],
      // Selection shifts right by one marker char on the left side.
      range: EditorSelection.range(range.from + insert.length, range.to + insert.length),
    }
  })
  return changes
}

/** CodeMirror input handler that applies wrap-on-type. */
export const wrapOnType = EditorView.inputHandler.of((view, _from, _to, text) => {
  if (text.length !== 1) return false
  const spec = wrapTransactionFor(view.state, text)
  if (!spec) return false
  view.dispatch(spec)
  return true
})
```

> Note for re-wrap test: when `*hello*` has inner selection `1..6` and `isAlreadyWrapped` is true, both inserts add a `*` immediately outside the existing markers, yielding `**hello**`. Verify the assertion in Step 1 passes; if the off-by-one differs in practice, adjust `startInsertAt`/`endInsertAt` and the returned range together and re-run.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run wrapOnType`
Expected: PASS. If the re-wrap case is off by one, fix offsets per the note above and re-run until green.

- [ ] **Step 5: Commit**

```bash
git add src/components/SpoteEditor/codemirror/wrapOnType.ts src/components/SpoteEditor/codemirror/wrapOnType.test.ts
git commit -m "feat: wrap-on-type for CodeMirror"
```

---

## Task 7: cmCommands (commandId -> CM6 edit)

Maps each command id to a CodeMirror edit on the raw markdown. Tested at the pure-transaction level using `EditorState`.

**Files:**
- Create: `src/components/SpoteEditor/codemirror/cmCommands.ts`
- Test: `src/components/SpoteEditor/codemirror/cmCommands.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { EditorState, EditorSelection } from '@codemirror/state'
import { applyCmCommand } from './cmCommands'

function run(doc: string, from: number, to: number, id: string) {
  const state = EditorState.create({ doc, selection: EditorSelection.single(from, to) })
  const spec = applyCmCommand(state, id)
  return state.update(spec).state.doc.toString()
}

describe('applyCmCommand', () => {
  it('h1 prefixes the line with "# "', () => {
    expect(run('title', 0, 0, 'h1')).toBe('# title')
  })
  it('bullet-list prefixes with "- "', () => {
    expect(run('item', 0, 0, 'bullet-list')).toBe('- item')
  })
  it('quote prefixes with "> "', () => {
    expect(run('q', 0, 0, 'quote')).toBe('> q')
  })
  it('bold wraps the selection with **', () => {
    expect(run('hello', 0, 5, 'bold')).toBe('**hello**')
  })
  it('code wraps the selection with backticks', () => {
    expect(run('x', 0, 1, 'code')).toBe('`x`')
  })
  it('divider inserts a horizontal rule on its own line', () => {
    expect(run('', 0, 0, 'divider')).toContain('---')
  })
  it('codeblock inserts a fenced block', () => {
    expect(run('', 0, 0, 'codeblock')).toContain('```')
  })
  it('link inserts a markdown link skeleton', () => {
    expect(run('text', 0, 4, 'link')).toBe('[text]()')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run cmCommands`
Expected: FAIL ("Cannot find module './cmCommands'").

- [ ] **Step 3: Write `cmCommands.ts`**

```ts
import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state'

function linePrefix(state: EditorState, prefix: string): TransactionSpec {
  const line = state.doc.lineAt(state.selection.main.from)
  return {
    changes: { from: line.from, insert: prefix },
    selection: EditorSelection.cursor(state.selection.main.from + prefix.length),
  }
}

function wrapSelection(state: EditorState, marker: string): TransactionSpec {
  const r = state.selection.main
  return {
    changes: [
      { from: r.from, insert: marker },
      { from: r.to, insert: marker },
    ],
    selection: EditorSelection.range(r.from + marker.length, r.to + marker.length),
  }
}

function insertBlock(state: EditorState, text: string): TransactionSpec {
  const r = state.selection.main
  return { changes: { from: r.from, to: r.to, insert: text }, selection: EditorSelection.cursor(r.from + text.length) }
}

function insertLink(state: EditorState): TransactionSpec {
  const r = state.selection.main
  const label = state.sliceDoc(r.from, r.to)
  const text = `[${label}]()`
  return {
    changes: { from: r.from, to: r.to, insert: text },
    // place cursor inside the parentheses
    selection: EditorSelection.cursor(r.from + text.length - 1),
  }
}

export function applyCmCommand(state: EditorState, id: string): TransactionSpec {
  switch (id) {
    case 'h1': return linePrefix(state, '# ')
    case 'h2': return linePrefix(state, '## ')
    case 'h3': return linePrefix(state, '### ')
    case 'bullet-list': return linePrefix(state, '- ')
    case 'ordered-list': return linePrefix(state, '1. ')
    case 'quote': return linePrefix(state, '> ')
    case 'bold': return wrapSelection(state, '**')
    case 'italic': return wrapSelection(state, '*')
    case 'code': return wrapSelection(state, '`')
    case 'codeblock': return insertBlock(state, '```\n\n```')
    case 'divider': return insertBlock(state, '\n---\n')
    case 'link': return insertLink(state)
    default: return { changes: [] }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run cmCommands`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SpoteEditor/codemirror/cmCommands.ts src/components/SpoteEditor/codemirror/cmCommands.test.ts
git commit -m "feat: cmCommands mapping commandId to CM6 edits"
```

---

## Task 8: slashExtension + CodeMirrorEditor

`slashExtension` is a `ViewPlugin` that watches document changes: when the last typed char is `/` at line start or after whitespace, it reports the caret coordinates via a callback so the parent opens `CommandMenu`. While open, typing after `/` updates the query; on selection the `/query` fragment is removed. `CodeMirrorEditor` is the React wrapper that mounts the CM6 instance, wires `value`/`onChange`, the slash extension, `wrapOnType`, and the selection bubble.

**Files:**
- Create: `src/components/SpoteEditor/codemirror/slashExtension.ts`
- Create: `src/components/SpoteEditor/codemirror/CodeMirrorEditor.tsx`
- Test: `src/components/SpoteEditor/codemirror/slashExtension.test.ts`

- [ ] **Step 1: Write the failing test for the trigger predicate**

```ts
import { describe, it, expect } from 'vitest'
import { shouldTriggerSlash } from './slashExtension'

describe('shouldTriggerSlash', () => {
  it('triggers at line start', () => {
    expect(shouldTriggerSlash('/', '')).toBe(true)
  })
  it('triggers after whitespace', () => {
    expect(shouldTriggerSlash('/', 'hello ')).toBe(true)
  })
  it('does not trigger mid-word', () => {
    expect(shouldTriggerSlash('/', 'http:/')).toBe(false)
  })
  it('does not trigger for non-slash input', () => {
    expect(shouldTriggerSlash('a', '')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run slashExtension`
Expected: FAIL ("Cannot find module './slashExtension'").

- [ ] **Step 3: Write `slashExtension.ts`**

```ts
import { ViewPlugin, type ViewUpdate, EditorView } from '@codemirror/view'

export interface SlashCallbacks {
  onOpen: (coords: { x: number; y: number }, at: number) => void
  onQuery: (query: string, at: number) => void
  onClose: () => void
}

/** `textBefore` is the text on the current line up to (not including) the typed char. */
export function shouldTriggerSlash(typed: string, textBefore: string): boolean {
  if (typed !== '/') return false
  if (textBefore.length === 0) return true
  return /\s$/.test(textBefore)
}

export function slashExtension(cb: SlashCallbacks) {
  let triggerPos: number | null = null

  return ViewPlugin.fromClass(
    class {
      update(u: ViewUpdate) {
        if (!u.docChanged && !u.selectionSet) return

        // Detect a freshly typed '/'
        if (u.docChanged) {
          u.changes.iterChanges((_fa, _ta, _fb, _tb, inserted) => {
            const text = inserted.toString()
            if (text !== '/') return
            const pos = u.state.selection.main.head
            const line = u.state.doc.lineAt(pos)
            const textBefore = u.state.sliceDoc(line.from, pos - 1)
            if (shouldTriggerSlash('/', textBefore)) {
              triggerPos = pos - 1
              const coords = u.view.coordsAtPos(pos)
              if (coords) cb.onOpen({ x: coords.left, y: coords.bottom }, triggerPos)
            }
          })
        }

        // While open, update query from text after the trigger.
        if (triggerPos != null) {
          const head = u.state.selection.main.head
          if (head <= triggerPos) { triggerPos = null; cb.onClose(); return }
          const query = u.state.sliceDoc(triggerPos + 1, head)
          if (/\s/.test(query)) { triggerPos = null; cb.onClose(); return }
          cb.onQuery(query, triggerPos)
        }
      }
    },
  )
}

/** Remove the `/query` fragment starting at `at` up to the current head. */
export function removeSlashFragment(view: EditorView, at: number) {
  const head = view.state.selection.main.head
  view.dispatch({ changes: { from: at, to: head } })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run slashExtension`
Expected: PASS.

- [ ] **Step 5: Write `CodeMirrorEditor.tsx`** (wrapper; verify CM6 imports against installed versions)

```tsx
import { useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { wrapOnType } from './wrapOnType'
import { applyCmCommand } from './cmCommands'
import { slashExtension, removeSlashFragment } from './slashExtension'
import { CommandMenu } from '../command-core/CommandMenu'
import { SelectionBubble } from '../command-core/SelectionBubble'
import { useCommandMenu } from '../command-core/useCommandMenu'
import type { Command, BubbleAction } from '../command-core/core.types'
import type { MenuPosition } from '../command-core/useCommandMenu'

export interface CodeMirrorEditorProps {
  value: string
  onChange: (md: string) => void
  commands: Command[]
  readOnly?: boolean
  autoFocus?: boolean
  onRequestLink: (position: MenuPosition, applyHref: (href: string) => void) => void
}

export function CodeMirrorEditor({ value, onChange, commands, readOnly, autoFocus, onRequestLink }: CodeMirrorEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const triggerPosRef = useRef<number>(0)
  const menu = useCommandMenu(commands)
  const [bubble, setBubble] = useState<MenuPosition | null>(null)

  // Keep latest handlers in refs so the (once-built) extension can call them.
  const menuRef = useRef(menu); menuRef.current = menu

  useEffect(() => {
    if (!hostRef.current) return
    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        wrapOnType,
        slashExtension({
          onOpen: (coords, at) => { triggerPosRef.current = at; menuRef.current.openAt(coords) },
          onQuery: (q) => menuRef.current.setQuery(q),
          onClose: () => menuRef.current.close(),
        }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChange(u.state.doc.toString())
          if (u.selectionSet) {
            const sel = u.state.selection.main
            if (!sel.empty) {
              const coords = u.view.coordsAtPos(sel.from)
              if (coords) setBubble({ x: coords.left, y: coords.top - 40 })
            } else {
              setBubble(null)
            }
          }
        }),
        EditorView.editable.of(!readOnly),
      ],
    })
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    if (autoFocus) view.focus()
    return () => view.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reconcile external value changes (controlled component).
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  function runCommand(id: string) {
    const view = viewRef.current
    if (!view) return
    removeSlashFragment(view, triggerPosRef.current)
    if (id === 'link') {
      const coords = view.coordsAtPos(view.state.selection.main.from)
      onRequestLink({ x: coords?.left ?? 0, y: coords?.bottom ?? 0 }, (href) => {
        const r = view.state.selection.main
        const label = view.state.sliceDoc(r.from, r.to) || 'länk'
        view.dispatch({ changes: { from: r.from, to: r.to, insert: `[${label}](${href})` } })
      })
    } else {
      view.dispatch(applyCmCommand(view.state, id))
    }
    view.focus()
    menu.close()
  }

  function runBubble(action: BubbleAction) {
    const view = viewRef.current
    if (!view) return
    if (action === 'link') {
      const r = view.state.selection.main
      const coords = view.coordsAtPos(r.from)
      onRequestLink({ x: coords?.left ?? 0, y: (coords?.top ?? 0) - 40 }, (href) => {
        const label = view.state.sliceDoc(r.from, r.to) || 'länk'
        view.dispatch({ changes: { from: r.from, to: r.to, insert: `[${label}](${href})` } })
      })
    } else {
      view.dispatch(applyCmCommand(view.state, action))
    }
    setBubble(null)
    view.focus()
  }

  return (
    <div className="spote-editor__cm" ref={hostRef}>
      {menu.open && (
        <CommandMenu
          results={menu.results}
          activeIndex={menu.activeIndex}
          position={menu.position}
          onSelect={runCommand}
          onClose={menu.close}
          onMove={menu.move}
        />
      )}
      {bubble && <SelectionBubble position={bubble} onAction={runBubble} />}
    </div>
  )
}
```

- [ ] **Step 6: Manual sanity check in the demo (deferred to Task 11)**

No unit test for the React wrapper (it needs a real layout engine for `coordsAtPos`, which jsdom lacks). It is exercised manually in the demo at Task 11. Confirm `npm run build` typechecks it now:

Run: `npm run build`
Expected: TypeScript compiles. Fix any import-name mismatches against the installed `@codemirror/*` versions (e.g. if `history`/`historyKeymap` moved). Do not change behavior — only correct import paths/names.

- [ ] **Step 7: Commit**

```bash
git add src/components/SpoteEditor/codemirror/slashExtension.ts src/components/SpoteEditor/codemirror/slashExtension.test.ts src/components/SpoteEditor/codemirror/CodeMirrorEditor.tsx
git commit -m "feat: CodeMirror raw editor with slash menu and bubble"
```

---

## Task 9: Milkdown adapter

The WYSIWYG editor. Milkdown is markdown-native (remark), so it parses `value` and serializes back to markdown on change. We add a slash plugin reporting caret coords and a selection-driven bubble, both opening the SAME shared `CommandMenu`/`SelectionBubble`. `milkdownCommands` maps a `commandId` to a ProseMirror transaction.

> **API verification required.** Before writing code, fetch current Milkdown v7 docs via context7 (`resolve-library-id` → `query-docs` for "milkdown react useEditor markdown getMarkdown listener slash"). Milkdown's exact API (`@milkdown/react` `useEditor`/`Milkdown`, `@milkdown/utils` `$command`, the listener/markdown ctx) must match the installed version. Use the doc result to fill in the calls below where marked `// VERIFY`.

**Files:**
- Create: `src/components/SpoteEditor/milkdown/milkdownCommands.ts`
- Create: `src/components/SpoteEditor/milkdown/slashPlugin.ts`
- Create: `src/components/SpoteEditor/milkdown/MilkdownEditor.tsx`

- [ ] **Step 1: Fetch Milkdown docs (context7)**

Use the context7 MCP tools to pull current Milkdown React + commands + listener docs. Record the exact import names you will use. No code committed in this step.

- [ ] **Step 2: Write `milkdownCommands.ts`**

Map command ids to Milkdown/ProseMirror command calls. Use the commonmark/gfm preset commands (toggle marks, wrap in heading/list/blockquote, insert hr, code fence). Structure:

```ts
import type { Ctx } from '@milkdown/ctx'
// VERIFY exact command keys from @milkdown/preset-commonmark / preset-gfm:
// e.g. toggleStrongCommand, toggleEmphasisCommand, wrapInHeadingCommand,
// wrapInBulletListCommand, wrapInOrderedListCommand, wrapInBlockquoteCommand,
// insertHrCommand, createCodeBlockCommand, toggleInlineCodeCommand
import { callCommand } from '@milkdown/utils' // VERIFY

type MilkdownHandler = (ctx: Ctx) => void

export const milkdownCommands: Record<string, MilkdownHandler> = {
  h1: (ctx) => callCommand(/* wrapInHeadingCommand.key */ undefined as any, 1)(ctx), // VERIFY signature
  h2: (ctx) => callCommand(undefined as any, 2)(ctx), // VERIFY
  h3: (ctx) => callCommand(undefined as any, 3)(ctx), // VERIFY
  bold: (ctx) => callCommand(/* toggleStrongCommand.key */ undefined as any)(ctx), // VERIFY
  italic: (ctx) => callCommand(undefined as any)(ctx), // VERIFY
  code: (ctx) => callCommand(undefined as any)(ctx), // VERIFY toggleInlineCode
  codeblock: (ctx) => callCommand(undefined as any)(ctx), // VERIFY createCodeBlock
  'bullet-list': (ctx) => callCommand(undefined as any)(ctx), // VERIFY wrapInBulletList
  'ordered-list': (ctx) => callCommand(undefined as any)(ctx), // VERIFY wrapInOrderedList
  quote: (ctx) => callCommand(undefined as any)(ctx), // VERIFY wrapInBlockquote
  divider: (ctx) => callCommand(undefined as any)(ctx), // VERIFY insertHr
  link: () => { /* handled by parent via LinkPopover; see MilkdownEditor */ },
}
```

Replace every `undefined as any` / `VERIFY` with the real command keys from Step 1. The `Record<string, ...>` keys MUST match the ids in `commands.ts` (h1, h2, h3, bold, italic, code, codeblock, bullet-list, ordered-list, quote, link, divider).

- [ ] **Step 3: Write `slashPlugin.ts`**

A ProseMirror plugin (via Milkdown's prose plugin slot) that, on a `/` typed at the start of a textblock or after whitespace, reports caret coords using `view.coordsAtPos(view.state.selection.from)`:

```ts
import { Plugin, PluginKey } from '@milkdown/prose/state' // VERIFY import path
import type { EditorView } from '@milkdown/prose/view'      // VERIFY

export interface MilkdownSlashCallbacks {
  onOpen: (coords: { x: number; y: number }) => void
  onQuery: (query: string) => void
  onClose: () => void
}

export const slashPluginKey = new PluginKey('spote-slash')

export function createSlashPlugin(cb: MilkdownSlashCallbacks) {
  return new Plugin({
    key: slashPluginKey,
    props: {
      handleTextInput(view: EditorView, _from, _to, text) {
        if (text !== '/') return false
        const { $from } = view.state.selection
        const before = $from.parent.textBetween(0, $from.parentOffset, undefined, ' ')
        const atStartOrWs = before.length === 0 || /\s$/.test(before)
        if (atStartOrWs) {
          const coords = view.coordsAtPos(view.state.selection.from)
          cb.onOpen({ x: coords.left, y: coords.bottom })
        }
        return false
      },
    },
  })
}
```

The query tracking after `/` mirrors the CM approach: read the text between the trigger position and the cursor in an `update`/`appendTransaction` hook. Implement the same close-on-whitespace/backspace-past-trigger rule as `slashExtension.ts`. (VERIFY plugin API names against Step 1 docs.)

- [ ] **Step 4: Write `MilkdownEditor.tsx`**

React wrapper mirroring `CodeMirrorEditor`'s public shape so `SpoteEditor` can render either interchangeably:

```tsx
import type { Command, BubbleAction } from '../command-core/core.types'
import type { MenuPosition } from '../command-core/useCommandMenu'

export interface MilkdownEditorProps {
  value: string
  onChange: (md: string) => void
  commands: Command[]
  readOnly?: boolean
  autoFocus?: boolean
  onRequestLink: (position: MenuPosition, applyHref: (href: string) => void) => void
}
```

Inside:
- Use `@milkdown/react` `useEditor` with commonmark + gfm presets + the listener plugin. // VERIFY
- Configure the listener so markdown updates call `onChange(markdown)`. // VERIFY (`listenerCtx.markdownUpdated`)
- On external `value` change, reconcile only when it differs from the current serialized markdown (same controlled-reconcile guard as CM). // VERIFY how to set content
- Add `createSlashPlugin` wired to a `useCommandMenu(commands)` instance; render the shared `CommandMenu` exactly as in `CodeMirrorEditor`.
- Track selection (PM `selectionSet`) to position the shared `SelectionBubble`; map actions through `milkdownCommands` via `ctx`, and route `link` to `onRequestLink` (insert/extend a link mark with the returned href). // VERIFY link mark command
- On command select: remove the `/query` text, then run `milkdownCommands[id](ctx)`.

Render JSX identical in shape to `CodeMirrorEditor`: the Milkdown root plus `{menu.open && <CommandMenu .../>}` and `{bubble && <SelectionBubble .../>}`.

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: compiles. Fix VERIFY placeholders until there are no `as any`/`undefined as any` left and types resolve.

- [ ] **Step 6: Commit**

```bash
git add src/components/SpoteEditor/milkdown/
git commit -m "feat: Milkdown WYSIWYG adapter with shared menu and bubble"
```

---

## Task 10: SpoteEditor shell

Ties it together: owns `value`/`onChange`, owns `mode` (internal state when `mode` prop is absent, controlled when present), renders a small mode-toggle button, renders the active engine, and owns the single `LinkPopover` instance shared by both engines (engines call `onRequestLink`).

**Files:**
- Modify: `src/components/SpoteEditor/SpoteEditor.tsx`
- Modify: `src/components/SpoteEditor/index.ts`
- Modify: `src/index.ts`
- Test: `src/components/SpoteEditor/SpoteEditor.test.tsx`

- [ ] **Step 1: Write the failing test (mode toggle + controlled value)**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpoteEditor } from './SpoteEditor'

// Stub both engines so the shell test does not depend on CM/Milkdown internals.
vi.mock('./codemirror/CodeMirrorEditor', () => ({
  CodeMirrorEditor: ({ value }: { value: string }) => <div data-testid="raw">{value}</div>,
}))
vi.mock('./milkdown/MilkdownEditor', () => ({
  MilkdownEditor: ({ value }: { value: string }) => <div data-testid="wysiwyg">{value}</div>,
}))

describe('SpoteEditor shell', () => {
  it('renders WYSIWYG by default and shows the value', () => {
    render(<SpoteEditor value="# hi" onChange={vi.fn()} />)
    expect(screen.getByTestId('wysiwyg')).toHaveTextContent('# hi')
  })

  it('toggles to raw mode with the built-in button', async () => {
    render(<SpoteEditor value="# hi" onChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /raw|markdown/i }))
    expect(screen.getByTestId('raw')).toBeInTheDocument()
  })

  it('respects a controlled mode prop and calls onModeChange', async () => {
    const onModeChange = vi.fn()
    render(<SpoteEditor value="x" onChange={vi.fn()} mode="raw" onModeChange={onModeChange} />)
    expect(screen.getByTestId('raw')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /wysiwyg|formaterad/i }))
    expect(onModeChange).toHaveBeenCalledWith('wysiwyg')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run SpoteEditor`
Expected: FAIL (shell renders `null` currently).

- [ ] **Step 3: Write `SpoteEditor.tsx`**

```tsx
import { useState, useCallback } from 'react'
import type { SpoteEditorProps, EditorMode } from './SpoteEditor.types'
import { DEFAULT_COMMANDS } from './command-core/commands'
import { CodeMirrorEditor } from './codemirror/CodeMirrorEditor'
import { MilkdownEditor } from './milkdown/MilkdownEditor'
import { LinkPopover } from './command-core/LinkPopover'
import type { MenuPosition } from './command-core/useCommandMenu'

interface LinkRequest {
  position: MenuPosition
  apply: (href: string) => void
}

export function SpoteEditor(props: SpoteEditorProps) {
  const {
    value, onChange, mode: modeProp, onModeChange,
    onSearchNotes, onResolveNoteHref, commands = DEFAULT_COMMANDS,
    readOnly, className, autoFocus,
  } = props

  const [internalMode, setInternalMode] = useState<EditorMode>('wysiwyg')
  const mode = modeProp ?? internalMode
  const [link, setLink] = useState<LinkRequest | null>(null)

  const setMode = useCallback((next: EditorMode) => {
    if (modeProp == null) setInternalMode(next)
    onModeChange?.(next)
  }, [modeProp, onModeChange])

  const onRequestLink = useCallback((position: MenuPosition, apply: (href: string) => void) => {
    setLink({ position, apply })
  }, [])

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
        commands={commands}
        readOnly={readOnly}
        autoFocus={autoFocus}
        onRequestLink={onRequestLink}
      />
      {link && (
        <LinkPopover
          position={link.position}
          onSearchNotes={onSearchNotes}
          onResolveNoteHref={onResolveNoteHref}
          onSubmitHref={(href) => { link.apply(href); setLink(null) }}
          onCancel={() => setLink(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Update `SpoteEditor/index.ts` and `src/index.ts`**

`src/components/SpoteEditor/index.ts`:
```ts
export { SpoteEditor } from './SpoteEditor'
export type { SpoteEditorProps, NoteHit, EditorMode } from './SpoteEditor.types'
```

`src/index.ts`:
```ts
export { SpoteEditor } from './components/SpoteEditor'
export type { SpoteEditorProps, NoteHit, EditorMode } from './components/SpoteEditor'
export { DEFAULT_COMMANDS } from './components/SpoteEditor/command-core/commands'
export type { Command, CommandGroup, BubbleAction } from './components/SpoteEditor/command-core/core.types'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- --run SpoteEditor`
Expected: PASS (all three cases).

- [ ] **Step 6: Run the whole suite + build**

Run: `npm test -- --run && npm run build`
Expected: all tests PASS, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/SpoteEditor/SpoteEditor.tsx src/components/SpoteEditor/index.ts src/index.ts src/components/SpoteEditor/SpoteEditor.test.tsx
git commit -m "feat: SpoteEditor shell with mode toggle and shared link popover"
```

---

## Task 11: Styling

CSS variables so the host app can theme the bubble, slash menu, and both modes consistently. Light/neutral defaults.

**Files:**
- Modify: `src/styles/index.css`

- [ ] **Step 1: Write `src/styles/index.css`**

```css
.spote-editor {
  --spote-bg: #ffffff;
  --spote-fg: #1a1a1a;
  --spote-border: #d8dce3;
  --spote-accent: #3b6df0;
  --spote-popover-bg: #ffffff;
  --spote-popover-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  --spote-radius: 10px;
  --spote-mono: ui-monospace, SFMono-Regular, Menlo, monospace;

  border: 1px solid var(--spote-border);
  border-radius: var(--spote-radius);
  background: var(--spote-bg);
  color: var(--spote-fg);
  overflow: hidden;
}

.spote-editor__toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 6px 8px;
  border-bottom: 1px solid var(--spote-border);
}

.spote-editor__mode-toggle {
  font-size: 12px;
  padding: 4px 10px;
  border: 1px solid var(--spote-border);
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.spote-editor__cm { padding: 12px; }
.spote-editor__cm .cm-editor { font-family: var(--spote-mono); font-size: 13px; outline: none; }

.spote-command-menu,
.spote-link-popover {
  z-index: 1000;
  min-width: 200px;
  background: var(--spote-popover-bg);
  border: 1px solid var(--spote-border);
  border-radius: 8px;
  box-shadow: var(--spote-popover-shadow);
  padding: 4px;
}

.spote-command-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.spote-command-menu__item.is-active { background: rgba(59, 109, 240, 0.12); }
.spote-command-menu__icon { width: 22px; font-family: var(--spote-mono); opacity: 0.7; }

.spote-bubble {
  z-index: 1000;
  display: flex;
  gap: 2px;
  padding: 4px;
  background: var(--spote-popover-bg);
  border: 1px solid var(--spote-border);
  border-radius: 8px;
  box-shadow: var(--spote-popover-shadow);
}
.spote-bubble__btn {
  min-width: 30px;
  padding: 4px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-family: var(--spote-mono);
}
.spote-bubble__btn:hover { background: rgba(59, 109, 240, 0.12); }

.spote-link-popover__input {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border: 1px solid var(--spote-border);
  border-radius: 6px;
  font-size: 13px;
}
.spote-link-popover__hits { list-style: none; margin: 4px 0 0; padding: 0; }
.spote-link-popover__hits button {
  width: 100%;
  text-align: left;
  padding: 6px 8px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.spote-link-popover__hits button:hover { background: rgba(59, 109, 240, 0.12); }
```

- [ ] **Step 2: Verify build emits the stylesheet**

Run: `npm run build`
Expected: build succeeds and `dist/style.css` (or the name from `package.json` `exports["./styles"]`) is produced.

- [ ] **Step 3: Commit**

```bash
git add src/styles/index.css
git commit -m "feat: editor styles with CSS variables"
```

---

## Task 12: Demo wiring and manual verification

Make the demo a real controlled harness so the two modes, slash menu, bubble, wrap-on-type, and link flow can be exercised by hand (the pieces jsdom cannot test).

**Files:**
- Modify: `demo/src/App.tsx`

- [ ] **Step 1: Write `demo/src/App.tsx`**

```tsx
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
```

> The demo imports the package by name (`spote-editor`); the existing `demo/vite.config.ts` already aliases this to `src`. If it does not, add an alias `{ 'spote-editor': resolve(__dirname, '../src/index.ts'), 'spote-editor/styles': resolve(__dirname, '../src/styles/index.css') }`.

- [ ] **Step 2: Manual verification checklist**

Run: `npm run dev`
Open the demo URL and confirm, in BOTH modes (toggle with the button):
1. Typing `/` at line start opens the same menu; typing filters; ArrowUp/Down moves; Enter inserts; Esc/click-outside closes.
2. Selecting/double-clicking a word shows the bubble; Bold/Italic/Code apply; the markdown source pane updates.
3. In raw mode: selecting a word and typing `*` wraps to `*word*`; typing `*` again makes `**word**`; `_`, `` ` ``, `~` also wrap.
4. Bubble → "Skapa länk": typing a URL + Enter inserts a link; typing "proj" lists "Projektplan"; selecting it inserts `spote://note/n1`.
5. Toggling modes preserves content (the source pane is unchanged across a toggle).
6. Raw mode shows literal markdown syntax (no hidden/rendered syntax).

Fix any issues found (most likely in the engine wrappers / VERIFY spots from Task 9) and re-run.

- [ ] **Step 3: Final full check**

Run: `npm test -- --run && npm run lint && npm run build`
Expected: tests PASS, lint clean, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add demo/src/App.tsx
git commit -m "feat: demo harness for SpoteEditor"
```

---

## Self-Review Notes (author)

- **Spec coverage:** raw=CM6 visible syntax (Tasks 6–8), WYSIWYG=Milkdown (Task 9), slash menu shared (Tasks 2,3,8,9), selection bubble incl. double-click (Tasks 4,8,9), link C-flow URL+note search (Tasks 5,10), wrap-on-type (Task 6), mode toggle preserving content (Task 10), controlled `value`/`onChange` (Tasks 8,10), optional callbacks with fallbacks (Tasks 5,10), CSS-variable theming (Task 11), tests on shared core (Tasks 1–7), packaging/exports (Task 10), demo (Task 12). Images/`onUpload` deliberately deferred — no task, matches spec.
- **Type consistency:** `commandId` strings are identical across `commands.ts`, `cmCommands.ts`, `milkdownCommands` keys, and tests (h1/h2/h3/bold/italic/code/codeblock/bullet-list/ordered-list/quote/link/divider). Engine wrappers share one prop shape (`value`, `onChange`, `commands`, `readOnly`, `autoFocus`, `onRequestLink`) so `SpoteEditor` swaps them freely. `MenuPosition` is the one position type used by menu, bubble, and popover.
- **Known soft spots flagged inline:** Milkdown v7 exact API (Task 9, VERIFY via context7); `coordsAtPos`-dependent wrappers are verified manually in the demo (Task 12), not in jsdom; wrap re-wrap offset has an explicit adjust-and-rerun note (Task 6).
```

# Image Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users add images (slash / paste / drop) in both editor modes; the host app owns storage via an `onUpload(file) => Promise<url>` callback while the editor inserts `![](url)`.

**Architecture:** A new surface-agnostic `uploadImage` plugin action plus a shell-owned hidden file input (`pickImage`). Each adapter (CodeMirror, Milkdown) owns an async `uploadAndInsert` routine that inserts a placeholder, awaits `onUpload`, then swaps in the final URL or removes the placeholder on failure. Pure helpers (id/placeholder/markdown/file-filter) live in one shared module so both adapters and the gate logic stay DRY.

**Tech Stack:** React 18, TypeScript, CodeMirror 6 (`@codemirror/*`), Milkdown / ProseMirror (`@milkdown/*`), Vitest + Testing Library.

## Global Constraints

- All new user-facing strings stay consistent with the existing UI (recent commits moved labels to English; the placeholder text "laddar…" is the one intentional Swedish string per the spec — keep it exactly `laddar…`).
- Markdown output is `![](url)` only — no alt text (empty), no HTML `<img>`, no title.
- The editor contains **no storage logic**. Without `onUpload`: the image slash plugin is hidden and image paste/drop are ignored (return `false`, let default happen).
- v1 has no progress bar, no `onError` hook, no resize/crop/caption/alt UI. Upload failure = silent placeholder removal.
- Handle each pasted/dropped image file independently (loop); mixed text+image paste prefers image.
- Run tests with `npx vitest run <path>`. Lint with `npm run lint`.

---

### Task 1: Public types — `onUpload`, `pickImage`, `uploadImage` action

**Files:**
- Modify: `src/components/SpoteEditor/SpoteEditor.types.ts`
- Modify: `src/components/SpoteEditor/command-core/plugin.types.ts`
- Modify: `src/components/SpoteEditor/codemirror/applyAction.ts`
- Modify: `src/components/SpoteEditor/milkdown/applyAction.ts`
- Test: `src/components/SpoteEditor/codemirror/applyAction.test.ts`
- Test (update mocks): `src/components/SpoteEditor/command-core/plugin.types.test.ts`

**Interfaces:**
- Produces: `PluginAction` gains `| { kind: 'uploadImage'; file: File }`. `PluginUI` gains `pickImage: () => Promise<File | null>`. `SpoteEditorProps` gains `onUpload?: (file: File) => Promise<string>`.
- The two `applyAction` functions throw on `uploadImage` (it is async, handled by adapters) — this also satisfies TS switch exhaustiveness once the union grows.

- [ ] **Step 1: Add the failing CM test for the new action**

In `src/components/SpoteEditor/codemirror/applyAction.test.ts`, add inside the `describe('applyAction (CM)', …)` block:

```ts
  it('uploadImage is rejected — it is handled async by the adapter, not applyAction', () => {
    const state = EditorState.create({ doc: 'x', selection: EditorSelection.single(0, 0) })
    const file = new File(['data'], 'a.png', { type: 'image/png' })
    expect(() => applyAction(state, { kind: 'uploadImage', file })).toThrow()
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/SpoteEditor/codemirror/applyAction.test.ts`
Expected: FAIL — type error / no `uploadImage` case (function returns `undefined`, does not throw).

- [ ] **Step 3: Extend the action and UI types**

In `src/components/SpoteEditor/command-core/plugin.types.ts`, change the `PluginAction` union and `PluginUI`:

```ts
export type PluginAction =
  | { kind: 'replaceSelection'; markdown: string }
  | { kind: 'insert'; markdown: string }
  | { kind: 'toggleMark'; mark: 'strong' | 'emphasis' | 'inlineCode' }
  | { kind: 'setBlock'; block: 'heading' | 'bulletList' | 'orderedList' | 'blockquote' | 'codeBlock'; attrs?: { level?: number } }
  | { kind: 'uploadImage'; file: File }

export interface PluginUI {
  /** Opens the link popover; resolves to an href, or null if cancelled. */
  requestLink: () => Promise<string | null>
  /** Opens a file picker (image/*); resolves to the chosen file, or null if cancelled. */
  pickImage: () => Promise<File | null>
}
```

- [ ] **Step 4: Add `onUpload` to the public props**

In `src/components/SpoteEditor/SpoteEditor.types.ts`, add inside `SpoteEditorProps` (after `onResolveNoteHref`):

```ts
  /** Receives a picked/pasted/dropped image file; returns the URL to embed. Absent → image features off. */
  onUpload?: (file: File) => Promise<string>
```

- [ ] **Step 5: Handle `uploadImage` in both `applyAction`s**

In `src/components/SpoteEditor/codemirror/applyAction.ts`, add a case at the end of the `switch` in `applyAction` (before the closing brace):

```ts
    case 'uploadImage':
      throw new Error('uploadImage is async; handled by the adapter, not applyAction')
```

In `src/components/SpoteEditor/milkdown/applyAction.ts`, add the same case at the end of the `switch`:

```ts
    case 'uploadImage':
      throw new Error('uploadImage is async; handled by the adapter, not applyAction')
```

- [ ] **Step 6: Fix the existing type mocks for the new `pickImage` member**

In `src/components/SpoteEditor/command-core/plugin.types.test.ts`, update the `ui` literal so it satisfies `PluginUI`:

```ts
    const action = await p.bubble!({ selectedText: 'hi', ui: { requestLink: async () => null, pickImage: async () => null } })
```

- [ ] **Step 7: Run the affected tests**

Run: `npx vitest run src/components/SpoteEditor/codemirror/applyAction.test.ts src/components/SpoteEditor/command-core/plugin.types.test.ts`
Expected: PASS (CM uploadImage test throws as expected; type-mock test compiles).

- [ ] **Step 8: Commit**

```bash
git add src/components/SpoteEditor/SpoteEditor.types.ts src/components/SpoteEditor/command-core/plugin.types.ts src/components/SpoteEditor/command-core/plugin.types.test.ts src/components/SpoteEditor/codemirror/applyAction.ts src/components/SpoteEditor/codemirror/applyAction.test.ts src/components/SpoteEditor/milkdown/applyAction.ts
git commit -m "feat: add uploadImage action, pickImage UI, and onUpload prop types"
```

---

### Task 2: Shared image-upload helpers (pure)

**Files:**
- Create: `src/components/SpoteEditor/command-core/imageUpload.ts`
- Test: `src/components/SpoteEditor/command-core/imageUpload.test.ts`

**Interfaces:**
- Produces:
  - `nextUploadId(): string` — unique per call.
  - `placeholderSrc(id: string): string` → `uploading:<id>` (used as the temporary image `src` / URL token).
  - `placeholderMarkdown(id: string): string` → `![laddar…](uploading:<id>)`.
  - `imageMarkdown(url: string): string` → `![](url)`.
  - `findPlaceholderRange(doc: string, id: string): { from: number; to: number } | null` — locates the raw-markdown placeholder.
  - `imageFilesFrom(list: FileList | null | undefined): File[]` — keeps only `image/*` files.

- [ ] **Step 1: Write the failing test**

Create `src/components/SpoteEditor/command-core/imageUpload.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  nextUploadId, placeholderSrc, placeholderMarkdown, imageMarkdown,
  findPlaceholderRange, imageFilesFrom,
} from './imageUpload'

describe('imageUpload helpers', () => {
  it('nextUploadId returns a fresh id each call', () => {
    expect(nextUploadId()).not.toBe(nextUploadId())
  })

  it('placeholder + markdown builders are consistent', () => {
    const id = 'abc'
    expect(placeholderSrc(id)).toBe('uploading:abc')
    expect(placeholderMarkdown(id)).toBe('![laddar…](uploading:abc)')
    expect(imageMarkdown('https://x/y.png')).toBe('![](https://x/y.png)')
  })

  it('findPlaceholderRange locates the placeholder substring', () => {
    const ph = placeholderMarkdown('abc')
    const doc = 'before ' + ph + ' after'
    const range = findPlaceholderRange(doc, 'abc')
    expect(range).toEqual({ from: 7, to: 7 + ph.length })
    expect(doc.slice(range!.from, range!.to)).toBe(ph)
  })

  it('findPlaceholderRange returns null when absent', () => {
    expect(findPlaceholderRange('nothing here', 'abc')).toBeNull()
  })

  it('imageFilesFrom keeps only image files and tolerates null', () => {
    const img = new File([''], 'a.png', { type: 'image/png' })
    const txt = new File([''], 'b.txt', { type: 'text/plain' })
    const list = [img, txt] as unknown as FileList
    expect(imageFilesFrom(list)).toEqual([img])
    expect(imageFilesFrom(null)).toEqual([])
    expect(imageFilesFrom(undefined)).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/SpoteEditor/command-core/imageUpload.test.ts`
Expected: FAIL — `Cannot find module './imageUpload'`.

- [ ] **Step 3: Implement the helpers**

Create `src/components/SpoteEditor/command-core/imageUpload.ts`:

```ts
let counter = 0

/** Unique id per upload, used to tag a placeholder so it can be found again after the async upload. */
export function nextUploadId(): string {
  counter += 1
  return `u${Date.now().toString(36)}${counter.toString(36)}`
}

/** Temporary src/URL token embedded in the placeholder while uploading. */
export const placeholderSrc = (id: string): string => `uploading:${id}`

/** Raw-markdown placeholder inserted at the cursor while the upload is in flight. */
export const placeholderMarkdown = (id: string): string => `![laddar…](${placeholderSrc(id)})`

/** Final embed markdown (alt empty in v1). */
export const imageMarkdown = (url: string): string => `![](${url})`

/** Locate the raw-markdown placeholder for `id`, or null if it is gone. */
export function findPlaceholderRange(doc: string, id: string): { from: number; to: number } | null {
  const ph = placeholderMarkdown(id)
  const from = doc.indexOf(ph)
  return from < 0 ? null : { from, to: from + ph.length }
}

/** Keep only image files from a FileList (clipboard or drop), tolerating null/undefined. */
export function imageFilesFrom(list: FileList | null | undefined): File[] {
  if (!list) return []
  return Array.from(list).filter((f) => f.type.startsWith('image/'))
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/components/SpoteEditor/command-core/imageUpload.test.ts`
Expected: PASS (all 5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/SpoteEditor/command-core/imageUpload.ts src/components/SpoteEditor/command-core/imageUpload.test.ts
git commit -m "feat: add shared image-upload helpers (id, placeholder, markdown, file filter)"
```

---

### Task 3: `image` built-in plugin + DEFAULT_PLUGINS + plugin gate

**Files:**
- Create: `src/components/SpoteEditor/command-core/plugins/image.ts`
- Modify: `src/components/SpoteEditor/command-core/plugins/index.ts`
- Modify: `src/components/SpoteEditor/command-core/pluginMenu.ts`
- Test: `src/components/SpoteEditor/command-core/plugins/plugins.test.ts`
- Test: `src/components/SpoteEditor/command-core/pluginMenu.test.ts`

**Interfaces:**
- Consumes: `PluginUI.pickImage`, `PluginAction.uploadImage` (Task 1).
- Produces:
  - `image: SpotePlugin` — slash-only; `slash` calls `ui.pickImage()` and returns `{ kind: 'uploadImage', file } | null`.
  - `DEFAULT_PLUGINS` includes `image`.
  - `withImageGate(plugins, hasUpload): SpotePlugin[]` in `pluginMenu.ts` — drops the `image` plugin when `hasUpload` is false.

- [ ] **Step 1: Write the failing plugin test**

In `src/components/SpoteEditor/command-core/plugins/plugins.test.ts`, update the shared `ui` mock and the `DEFAULT_PLUGINS` assertion, and add image cases.

Replace the mock line at the top:

```ts
const ui = { requestLink: async () => 'https://x', pickImage: async () => new File(['x'], 'a.png', { type: 'image/png' }) }
```

Update the import line to include `image`:

```ts
import { bold, italic, code, link, h1, bulletList, quote, codeBlock, divider, image, DEFAULT_PLUGINS } from './index'
```

Add a new test inside the `describe`:

```ts
  it('image (slash) picks a file and returns an uploadImage action', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const pickUi = { requestLink: async () => null, pickImage: async () => file }
    expect(image.slash).toBeDefined()
    expect(image.bubble).toBeUndefined()
    expect(await image.slash!({ ui: pickUi })).toEqual({ kind: 'uploadImage', file })
  })

  it('image (slash) returns null when the picker is cancelled', async () => {
    const cancelUi = { requestLink: async () => null, pickImage: async () => null }
    expect(await image.slash!({ ui: cancelUi })).toBeNull()
  })
```

Update the `DEFAULT_PLUGINS` id assertion to include `image`:

```ts
    expect(ids).toEqual(expect.arrayContaining(['bold','italic','code','link','h1','h2','h3','bulletList','orderedList','quote','codeBlock','divider','image']))
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/SpoteEditor/command-core/plugins/plugins.test.ts`
Expected: FAIL — `image` is not exported.

- [ ] **Step 3: Create the plugin**

Create `src/components/SpoteEditor/command-core/plugins/image.ts`:

```ts
import type { SpotePlugin } from '../plugin.types'

export const image: SpotePlugin = {
  id: 'image', label: 'Image', icon: '🖼️',
  slash: async ({ ui }) => {
    const file = await ui.pickImage()
    return file ? { kind: 'uploadImage', file } : null
  },
}
```

- [ ] **Step 4: Register it**

In `src/components/SpoteEditor/command-core/plugins/index.ts`, add the export and include it in `DEFAULT_PLUGINS`:

```ts
export * from './marks'
export * from './link'
export * from './blocks'
export * from './image'
import { bold, italic, code } from './marks'
import { link } from './link'
import { h1, h2, h3, bulletList, orderedList, quote, codeBlock, divider } from './blocks'
import { image } from './image'
import type { SpotePlugin } from '../plugin.types'

export const DEFAULT_PLUGINS: SpotePlugin[] = [
  h1, h2, h3, bold, italic, code, codeBlock, bulletList, orderedList, quote, link, image, divider,
]
```

- [ ] **Step 5: Run the plugin test**

Run: `npx vitest run src/components/SpoteEditor/command-core/plugins/plugins.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing gate test**

In `src/components/SpoteEditor/command-core/pluginMenu.test.ts`, add (adapt imports to the file's existing style):

```ts
import { withImageGate } from './pluginMenu'
import { DEFAULT_PLUGINS } from './plugins'

describe('withImageGate', () => {
  it('keeps the image plugin when upload is supported', () => {
    const ids = withImageGate(DEFAULT_PLUGINS, true).map((p) => p.id)
    expect(ids).toContain('image')
  })
  it('drops the image plugin when upload is not supported', () => {
    const ids = withImageGate(DEFAULT_PLUGINS, false).map((p) => p.id)
    expect(ids).not.toContain('image')
  })
  it('leaves other plugins untouched when gated off', () => {
    const before = DEFAULT_PLUGINS.filter((p) => p.id !== 'image').map((p) => p.id)
    expect(withImageGate(DEFAULT_PLUGINS, false).map((p) => p.id)).toEqual(before)
  })
})
```

> If `pluginMenu.test.ts` has no top-level `describe`/imports yet, add `import { describe, it, expect } from 'vitest'` at the top.

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run src/components/SpoteEditor/command-core/pluginMenu.test.ts`
Expected: FAIL — `withImageGate` is not exported.

- [ ] **Step 8: Implement the gate**

In `src/components/SpoteEditor/command-core/pluginMenu.ts`, add at the end:

```ts
/** Drop the image plugin when the host provides no upload handler (image features off). */
export const withImageGate = (plugins: readonly SpotePlugin[], hasUpload: boolean): SpotePlugin[] =>
  hasUpload ? [...plugins] : plugins.filter((p) => p.id !== 'image')
```

- [ ] **Step 9: Run both test files**

Run: `npx vitest run src/components/SpoteEditor/command-core/pluginMenu.test.ts src/components/SpoteEditor/command-core/plugins/plugins.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/components/SpoteEditor/command-core/plugins/image.ts src/components/SpoteEditor/command-core/plugins/index.ts src/components/SpoteEditor/command-core/plugins/plugins.test.ts src/components/SpoteEditor/command-core/pluginMenu.ts src/components/SpoteEditor/command-core/pluginMenu.test.ts
git commit -m "feat: add image slash plugin, register in defaults, add upload gate"
```

---

### Task 4: Shell — `onUpload` threading, `pickImage` hidden input, plugin gating

**Files:**
- Modify: `src/components/SpoteEditor/SpoteEditor.tsx`
- Test: `src/components/SpoteEditor/SpoteEditor.test.tsx`

**Interfaces:**
- Consumes: `withImageGate` (Task 3), `onUpload` prop (Task 1), adapter props `onUpload` + `pickImage` (added in Tasks 5/6 — declared here as passed props; the mocked adapters in the shell test capture them).
- Produces: passes `plugins={withImageGate(plugins, !!onUpload)}`, `onUpload={onUpload}`, and `pickImage={pickImage}` to `<Engine />`. Renders a hidden `<input type="file" accept="image/*">`; `pickImage(): Promise<File | null>`.

- [ ] **Step 1: Write the failing shell test**

In `src/components/SpoteEditor/SpoteEditor.test.tsx`, extend the mock capture to also record `onUpload`, and add gate tests.

Update the capture object and mock prop types near the top:

```ts
const captured: { plugins?: SpotePlugin[]; onUpload?: unknown } = {}
type MockEditorProps = { value: string; plugins: SpotePlugin[]; onUpload?: unknown }
vi.mock('./codemirror/CodeMirrorEditor', () => ({
  CodeMirrorEditor: ({ value, plugins, onUpload }: MockEditorProps) => { captured.plugins = plugins; captured.onUpload = onUpload; return <div data-testid="raw">{value}</div> },
}))
vi.mock('./milkdown/MilkdownEditor', () => ({
  MilkdownEditor: ({ value, plugins, onUpload }: MockEditorProps) => { captured.plugins = plugins; captured.onUpload = onUpload; return <div data-testid="wysiwyg">{value}</div> },
}))
```

Add tests inside the `describe('SpoteEditor shell', …)` block:

```ts
  it('hides the image plugin when no onUpload is given', () => {
    render(<SpoteEditor value="x" onChange={vi.fn()} />)
    expect(captured.plugins!.some((p) => p.id === 'image')).toBe(false)
  })

  it('keeps the image plugin and forwards onUpload when provided', () => {
    const onUpload = vi.fn(async () => 'https://x/y.png')
    render(<SpoteEditor value="x" onChange={vi.fn()} onUpload={onUpload} />)
    expect(captured.plugins!.some((p) => p.id === 'image')).toBe(true)
    expect(captured.onUpload).toBe(onUpload)
  })
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/SpoteEditor/SpoteEditor.test.tsx`
Expected: FAIL — image plugin still present / `onUpload` not forwarded.

- [ ] **Step 3: Wire the shell**

Edit `src/components/SpoteEditor/SpoteEditor.tsx`.

Add imports:

```ts
import { useState, useCallback, useRef } from 'react'
import { withImageGate } from './command-core/pluginMenu'
```

Destructure `onUpload`:

```ts
  const {
    value, onChange, mode: modeProp, onModeChange,
    onSearchNotes, onResolveNoteHref, plugins = DEFAULTS,
    readOnly, className, autoFocus, placeholder, onUpload,
  } = props
```

Add the picker state + handler after the `requestLink` definition:

```ts
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pickResolveRef = useRef<((file: File | null) => void) | null>(null)

  const settlePick = useCallback((file: File | null) => {
    pickResolveRef.current?.(file)
    pickResolveRef.current = null
  }, [])

  const pickImage = useCallback(() => new Promise<File | null>((resolve) => {
    const input = fileInputRef.current
    if (!input) { resolve(null); return }
    pickResolveRef.current = resolve
    input.value = ''
    input.click()
  }), [])

  const gatedPlugins = withImageGate(plugins, !!onUpload)
```

Pass the new props to `<Engine />` (add to the existing element):

```tsx
      <Engine
        value={value}
        onChange={onChange}
        plugins={gatedPlugins}
        readOnly={readOnly}
        autoFocus={autoFocus}
        placeholder={placeholder}
        requestLink={requestLink}
        onUpload={onUpload}
        pickImage={pickImage}
      />
```

Add the hidden input just before the closing `</div>` of the root:

```tsx
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => settlePick(e.target.files?.[0] ?? null)}
        onCancel={() => settlePick(null)}
      />
```

> Note: `<Engine />` does not yet declare `onUpload`/`pickImage` in its prop types — TypeScript will error until Tasks 5 and 6 add them. That is expected; the shell test uses mocked adapters and passes. Run `npm run lint`/`tsc` only after Task 6.

- [ ] **Step 4: Run the shell test**

Run: `npx vitest run src/components/SpoteEditor/SpoteEditor.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SpoteEditor/SpoteEditor.tsx src/components/SpoteEditor/SpoteEditor.test.tsx
git commit -m "feat: thread onUpload + pickImage through the shell and gate the image plugin"
```

---

### Task 5: CodeMirror adapter — upload pipeline, paste & drop

**Files:**
- Modify: `src/components/SpoteEditor/codemirror/CodeMirrorEditor.tsx`

**Interfaces:**
- Consumes: `onUpload`, `pickImage` props (from shell, Task 4); `imageFilesFrom`, `nextUploadId`, `placeholderMarkdown`, `imageMarkdown`, `findPlaceholderRange` (Task 2); `uploadImage` action + `PluginUI.pickImage` (Task 1).
- Produces: `CodeMirrorEditorProps` gains `onUpload?` and `pickImage`. Routes the `uploadImage` action and image paste/drop into `cmUploadAndInsert`.

This task is integration-level (CodeMirror DOM events); verified manually via the demo in Task 7. No new automated test.

- [ ] **Step 1: Add imports and a module-level upload routine**

In `src/components/SpoteEditor/codemirror/CodeMirrorEditor.tsx`, update the state import to include `EditorSelection`:

```ts
import { EditorState, EditorSelection } from '@codemirror/state'
```

Add helper imports:

```ts
import { imageFilesFrom, nextUploadId, placeholderMarkdown, imageMarkdown, findPlaceholderRange } from '../command-core/imageUpload'
```

Add a module-level function (after the imports, before the component):

```ts
/**
 * Two-phase image upload for CodeMirror: insert a raw-markdown placeholder at the
 * cursor now, await the host upload, then swap the placeholder for `![](url)` —
 * or remove it on failure. Located by unique placeholder text so concurrent
 * uploads and unrelated edits don't collide.
 */
async function cmUploadAndInsert(view: EditorView, file: File, onUpload: (file: File) => Promise<string>) {
  const id = nextUploadId()
  const ph = placeholderMarkdown(id)
  const r = view.state.selection.main
  view.dispatch({ changes: { from: r.from, to: r.to, insert: ph }, selection: EditorSelection.cursor(r.from + ph.length) })
  try {
    const url = await onUpload(file)
    const range = findPlaceholderRange(view.state.doc.toString(), id)
    if (range) view.dispatch({ changes: { from: range.from, to: range.to, insert: imageMarkdown(url) } })
  } catch {
    const range = findPlaceholderRange(view.state.doc.toString(), id)
    if (range) view.dispatch({ changes: { from: range.from, to: range.to, insert: '' } })
  }
}
```

- [ ] **Step 2: Extend props and add an `onUpload` ref**

Update `CodeMirrorEditorProps`:

```ts
export interface CodeMirrorEditorProps {
  value: string
  onChange: (md: string) => void
  plugins: SpotePlugin[]
  readOnly?: boolean
  autoFocus?: boolean
  placeholder?: string
  requestLink: (position: MenuPosition) => Promise<string | null>
  onUpload?: (file: File) => Promise<string>
  pickImage: () => Promise<File | null>
}
```

Update the destructure and add a ref (so the once-built extension sees the latest `onUpload`):

```ts
export function CodeMirrorEditor({ value, onChange, plugins, readOnly, autoFocus, placeholder, requestLink, onUpload, pickImage }: CodeMirrorEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const triggerPosRef = useRef<number>(0)
  const onUploadRef = useRef(onUpload); onUploadRef.current = onUpload
  const menu = useCommandMenu(slashPlugins(plugins))
  const [bubble, setBubble] = useState<MenuPosition | null>(null)
```

- [ ] **Step 3: Register paste/drop handlers in the extension list**

In the `extensions: [ … ]` array (inside `EditorState.create`), add after the `EditorView.updateListener.of(…)` block:

```ts
        EditorView.domEventHandlers({
          paste(event, view) {
            const onUpload = onUploadRef.current
            if (!onUpload) return false
            const files = imageFilesFrom(event.clipboardData?.files)
            if (files.length === 0) return false
            event.preventDefault()
            files.forEach((f) => { void cmUploadAndInsert(view, f, onUpload) })
            return true
          },
          drop(event, view) {
            const onUpload = onUploadRef.current
            if (!onUpload) return false
            const files = imageFilesFrom(event.dataTransfer?.files)
            if (files.length === 0) return false
            event.preventDefault()
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
            if (pos != null) view.dispatch({ selection: EditorSelection.cursor(pos) })
            files.forEach((f) => { void cmUploadAndInsert(view, f, onUpload) })
            return true
          },
        }),
```

- [ ] **Step 4: Add `pickImage` to the slash `ui` and route the `uploadImage` action**

In `runCommand`, update the `ui` literal and the action handling:

```ts
    const ui: PluginUI = {
      requestLink: () => requestLink({ x: coords?.left ?? 0, y: coords?.bottom ?? 0 }),
      pickImage,
    }
    const action = await plugin.slash({ ui })
    if (action?.kind === 'uploadImage') {
      if (onUploadRef.current) await cmUploadAndInsert(view, action.file, onUploadRef.current)
      view.focus()
      return
    }
    if (action) view.dispatch(applyAction(view.state, action))
    view.focus()
```

In `runBubble`, add `pickImage` to its `ui` literal so it satisfies `PluginUI` (bubble plugins never return `uploadImage`, so no routing needed there):

```ts
    const ui: PluginUI = {
      requestLink: () => requestLink({ x: coords?.left ?? 0, y: (coords?.top ?? 0) - 40 }),
      pickImage,
    }
```

- [ ] **Step 5: Type-check**

Run: `npx tsc -p tsconfig.build.json --noEmit`
Expected: still errors from `milkdown/MilkdownEditor` missing `onUpload`/`pickImage` props (fixed in Task 6), but **no** errors in `codemirror/CodeMirrorEditor.tsx` or `SpoteEditor.tsx`'s use of the CM engine. Confirm CM file is clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/SpoteEditor/codemirror/CodeMirrorEditor.tsx
git commit -m "feat: image upload pipeline (slash/paste/drop) in the CodeMirror adapter"
```

---

### Task 6: Milkdown adapter — upload pipeline, paste & drop

**Files:**
- Modify: `src/components/SpoteEditor/milkdown/MilkdownEditor.tsx`

**Interfaces:**
- Consumes: `onUpload`, `pickImage` props (Task 4); helpers from Task 2; `uploadImage` action + `PluginUI.pickImage` (Task 1).
- Produces: `MilkdownEditorProps` gains `onUpload?` and `pickImage`. Routes `uploadImage` action and image paste/drop into `mdUploadAndInsert` (ProseMirror image node placeholder → `setNodeMarkup` on success / `delete` on failure).

Integration-level; verified manually via the demo (Task 7). No new automated test.

- [ ] **Step 1: Add imports and the ProseMirror upload routine**

In `src/components/SpoteEditor/milkdown/MilkdownEditor.tsx`, add imports:

```ts
import { TextSelection } from '@milkdown/prose/state'
import type { EditorView as ProseView } from '@milkdown/prose/view'
import { imageFilesFrom, nextUploadId, placeholderSrc } from '../command-core/imageUpload'
```

Add module-level helpers (after imports, before `MilkdownEditorInner`):

```ts
function findImageBySrc(view: ProseView, src: string): { pos: number; nodeSize: number; attrs: Record<string, unknown> } | null {
  let hit: { pos: number; nodeSize: number; attrs: Record<string, unknown> } | null = null
  view.state.doc.descendants((node, pos) => {
    if (hit) return false
    if (node.type.name === 'image' && node.attrs.src === src) {
      hit = { pos, nodeSize: node.nodeSize, attrs: node.attrs }
      return false
    }
    return true
  })
  return hit
}

/**
 * Two-phase image upload for Milkdown/ProseMirror: insert an image node with a
 * temporary `uploading:<id>` src now, await the host upload, then point the node
 * at the real URL (and clear the placeholder alt) — or delete the node on failure.
 */
async function mdUploadAndInsert(view: ProseView, file: File, onUpload: (file: File) => Promise<string>) {
  const imageType = view.state.schema.nodes.image
  if (!imageType) return
  const id = nextUploadId()
  const src = placeholderSrc(id)
  view.dispatch(view.state.tr.replaceSelectionWith(imageType.create({ src, alt: 'laddar…' })))
  try {
    const url = await onUpload(file)
    const hit = findImageBySrc(view, src)
    if (hit) view.dispatch(view.state.tr.setNodeMarkup(hit.pos, undefined, { ...hit.attrs, src: url, alt: '' }))
  } catch {
    const hit = findImageBySrc(view, src)
    if (hit) view.dispatch(view.state.tr.delete(hit.pos, hit.pos + hit.nodeSize))
  }
}
```

- [ ] **Step 2: Extend props and add refs**

Update `MilkdownEditorProps`:

```ts
export interface MilkdownEditorProps {
  value: string
  onChange: (md: string) => void
  plugins: SpotePlugin[]
  readOnly?: boolean
  autoFocus?: boolean
  placeholder?: string
  requestLink: (position: MenuPosition) => Promise<string | null>
  onUpload?: (file: File) => Promise<string>
  pickImage: () => Promise<File | null>
}
```

Update the `MilkdownEditorInner` destructure and add refs alongside the others:

```ts
function MilkdownEditorInner({ value, onChange, plugins, readOnly, autoFocus, requestLink, onUpload, pickImage }: MilkdownEditorProps) {
```

Add after `readOnlyRef`:

```ts
  const onUploadRef = useRef(onUpload); onUploadRef.current = onUpload
  const pickImageRef = useRef(pickImage); pickImageRef.current = pickImage
```

- [ ] **Step 3: Add paste/drop handlers to the view options**

In the `.config((ctx) => { … })` block, update the `editorViewOptionsCtx` call:

```ts
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          editable: () => !readOnlyRef.current,
          handlePaste: (view, event) => {
            const onUpload = onUploadRef.current
            if (!onUpload) return false
            const files = imageFilesFrom((event as ClipboardEvent).clipboardData?.files)
            if (files.length === 0) return false
            files.forEach((f) => { void mdUploadAndInsert(view, f, onUpload) })
            return true
          },
          handleDrop: (view, event) => {
            const onUpload = onUploadRef.current
            if (!onUpload) return false
            const e = event as DragEvent
            const files = imageFilesFrom(e.dataTransfer?.files)
            if (files.length === 0) return false
            const at = view.posAtCoords({ left: e.clientX, top: e.clientY })
            if (at) view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at.pos)))
            files.forEach((f) => { void mdUploadAndInsert(view, f, onUpload) })
            return true
          },
        }))
```

- [ ] **Step 4: Add `pickImage` to `ui` and route `uploadImage`**

In `runSlash`, update the `ui` literal and action handling:

```ts
    const ui: PluginUI = {
      requestLink: () => requestLinkRef.current({ x: coords.left, y: coords.bottom }),
      pickImage: () => pickImageRef.current(),
    }
    const action = await plugin.slash({ ui })
    if (action?.kind === 'uploadImage') {
      const onUpload = onUploadRef.current
      if (onUpload) editor.action((ctx) => mdUploadAndInsert(ctx.get(editorViewCtx), action.file, onUpload))
      editor.action((ctx) => ctx.get(editorViewCtx).focus())
      return
    }
    if (action) editor.action((ctx) => applyAction(ctx, action))
    editor.action((ctx) => ctx.get(editorViewCtx).focus())
```

In `runBubble`, add `pickImage` to its `ui` literal:

```ts
    const ui: PluginUI = {
      requestLink: () => requestLinkRef.current({ x: coords.left, y: coords.top - 40 }),
      pickImage: () => pickImageRef.current(),
    }
```

- [ ] **Step 5: Type-check the whole build**

Run: `npx tsc -p tsconfig.build.json --noEmit`
Expected: PASS (no errors anywhere now).

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: PASS (all existing + new tests).

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: clean (no new errors).

- [ ] **Step 8: Commit**

```bash
git add src/components/SpoteEditor/milkdown/MilkdownEditor.tsx
git commit -m "feat: image upload pipeline (slash/paste/drop) in the Milkdown adapter"
```

---

### Task 7: Demo wiring + manual verification

**Files:**
- Modify: `demo/src/App.tsx`

**Interfaces:**
- Consumes: `onUpload` prop (Task 1).
- Produces: a dummy `onUpload` that returns an inline base64 data-URL so the flow works with no real storage.

- [ ] **Step 1: Add the dummy upload and wire it**

In `demo/src/App.tsx`, add the helper above the component:

```tsx
// Dummy onUpload: bakes the image into an inline data-URL (base64). No real
// storage — the image lives in the markdown text itself, so it survives reload.
function fakeUpload(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
```

Add the prop to `<SpoteEditor …>` (after `onResolveNoteHref`):

```tsx
        onUpload={fakeUpload}
```

- [ ] **Step 2: Manual verification — run the demo**

Run: `npm run dev`
Then in the browser, verify all three entry points in **both** modes (toggle with the Raw/WYSIWYG button):
1. Type `/` → choose **Image** → pick a file → it appears; the raw-markdown panel shows `![](data:image/...)`.
2. Copy an image to the clipboard → paste into the editor → image appears.
3. Drag an image file from the OS → drop into the editor → image appears at the drop point.

Also verify graceful degradation: temporarily remove `onUpload={fakeUpload}`, reload, and confirm the `/` menu has **no** Image entry and paste/drop of an image does nothing. Restore `onUpload` afterward.

- [ ] **Step 3: Commit**

```bash
git add demo/src/App.tsx
git commit -m "docs(demo): wire a dummy data-URL onUpload to demo image handling"
```

---

## Notes on resolved open questions (from the spec)

1. **`pickImage` ownership** → shell-owned hidden `<input>`, exposed via the existing `ui` plumbing (Task 4). *(spec rec)*
2. **Image plugin when `onUpload` absent** → hidden via `withImageGate` (Task 3/4). *(spec rec)*
3. **WYSIWYG placeholder representation** → a real image node with a temporary `uploading:<id>` src, swapped via `setNodeMarkup` (Task 6). Reliable to locate and replace.
4. **Mixed text+image paste** → prefer image: if any image file is present we handle it and `preventDefault`/return true; otherwise return false and let the default text paste happen (Tasks 5/6). *(spec rec)*

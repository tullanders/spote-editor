# Image Handling — Design Spec

Date: 2026-06-16
Status: Draft for review

## Goal

Let users add images to the editor in both modes, with the host app owning storage.
The editor handles the UX (pick / paste / drop) and inserts markdown (`![](url)`); the
app receives the file via a callback, stores it (e.g. Cloudflare R2), and returns the URL.

Standalone-component principle preserved: no storage logic in the editor. Without the
callback, image features degrade gracefully (no image command; paste/drop of images ignored).

## Public API

```ts
// SpoteEditorProps gains:
onUpload?: (file: File) => Promise<string>   // returns the URL/href to embed
```

- Returns the URL string (consistent with `onResolveNoteHref`). Throwing/rejecting →
  treated as upload failure (placeholder removed, see UX).
- When `onUpload` is absent: the "Bild" slash plugin is not shown, and image paste/drop
  is ignored (let the browser/engine do its default, i.e. nothing inserted).

## Entry points (three, one shared pipeline)

All three funnel into one adapter routine `uploadAndInsert(file)`:
1. **Slash → "Bild"** — a built-in plugin that opens a file dialog via `ctx.ui.pickImage()`,
   then yields the file to the pipeline.
2. **Paste** — adapter clipboard handler detects image files (CM: `EditorView.domEventHandlers.paste`; Milkdown/ProseMirror: `handlePaste`).
3. **Drag & drop** — adapter drop handler (CM: `domEventHandlers.drop`; ProseMirror: `handleDrop`).

Paste and drop are editor-level events, NOT menu interactions — they live in the adapters,
not as plugins. The slash plugin is the only menu-driven entry.

## Upload pipeline (placeholder-while-uploading)

`uploadAndInsert(file)` in each adapter:
1. Insert a placeholder at the cursor immediately, e.g. `![laddar…]()` (raw) or an
   equivalent node (WYSIWYG). Remember its position/range.
2. `const url = await onUpload(file)`.
3. On success: replace the placeholder with `![](url)`.
4. On failure (reject/throw): remove the placeholder. (v1: silent removal; optional
   `onError` hook is a future addition — out of scope.)

The async two-phase nature (insert now, replace later) is the main complexity and is why
this lives in the adapter, not in the synchronous `applyAction` interpreter.

## Plugin + action model integration

- New `ctx.ui.pickImage(): Promise<File | null>` — opens a hidden file input (`accept="image/*"`),
  resolves the chosen file or null. Generalizes `ctx.ui` (we deferred this earlier).
- New plugin action `{ kind: 'uploadImage'; file: File }`. The slash "Bild" plugin returns
  it; the adapter routes `uploadImage` to its async `uploadAndInsert(file)` path (NOT the
  sync `applyAction`, since it's two-phase async). Paste/drop call `uploadAndInsert` directly.
- `onUpload` is threaded shell → adapters (like `requestLink`): the adapter closure holds it.

Built-in plugin:
```ts
const image: SpotePlugin = {
  id: 'image', label: 'Bild', icon: '🖼️',
  slash: async ({ ui }) => {
    const file = await ui.pickImage()
    return file ? { kind: 'uploadImage', file } : null
  },
}
```
Included in `DEFAULT_PLUGINS` only conceptually — the adapter hides it when `onUpload`
is absent (filter at render: drop the image plugin if no `onUpload`). (Alternative: keep
it always and no-op without `onUpload` — decide in Open Questions.)

## What changes

- `SpoteEditor.types.ts`: add `onUpload?`.
- `plugin.types.ts`: add `pickImage` to `PluginUI`; add `uploadImage` to `PluginAction`.
- `command-core/plugins/`: new `image` plugin (+ export, + into DEFAULT_PLUGINS).
- Shell: thread `onUpload` to adapters; implement `ctx.ui.pickImage` (hidden file input,
  likely shell-owned like the link popover) OR per-adapter — decide.
- `codemirror/CodeMirrorEditor.tsx`: `uploadAndInsert`, paste/drop `domEventHandlers`, route
  `uploadImage` action.
- `milkdown/MilkdownEditor.tsx`: `uploadAndInsert`, `handlePaste`/`handleDrop`, route action.
- Demo: wire a fake `onUpload` (e.g. `URL.createObjectURL`) to show the flow.

## Scope guardrails / non-goals (v1)

- No resize/crop/captions UI; no alt-text prompt (alt empty for v1).
- No progress bar (just the text placeholder); no `onError` hook.
- No multi-file batch beyond "handle each dropped/pasted image file independently".
- Markdown `![](url)` only (no HTML `<img>` with attributes).

## Open questions

1. **`pickImage` ownership:** shell-owned hidden `<input>` (consistent with shell owning
   the link popover) vs per-adapter. *Rec: shell-owned, exposed via the same `ui` plumbing.*
2. **Image plugin when `onUpload` absent:** hide it (filter) vs show-but-no-op.
   *Rec: hide it* (don't offer an action that can't work).
3. **Placeholder representation in WYSIWYG:** a temporary image node with a data-URL/spinner
   vs a text placeholder. *Rec: simplest that reliably replaces — confirm during impl.*
4. **Paste that contains BOTH text and an image** (e.g. screenshot): treat as image if any
   image file present, else default text paste. *Rec: yes, prefer image.*

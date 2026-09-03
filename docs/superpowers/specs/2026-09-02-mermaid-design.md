# Mermaid Diagrams — Design Spec

Date: 2026-09-02
Status: Draft for review

## Goal

Render ` ```mermaid ` fenced code blocks as diagrams in the WYSIWYG editor. A block shows
the rendered diagram; putting the cursor in it reveals the code; moving the cursor out
re-renders. Raw markdown mode is unchanged — it stays plain markdown.

The document is never touched: a mermaid block remains an ordinary fenced code block in the
ProseMirror schema and in the serialized markdown. Round-trip and mode switching therefore
need no new code, and no parser/serializer bug can lose the user's content.

## Scope

In scope:
- Rendered diagrams in WYSIWYG, cursor-driven edit/preview switching.
- A `/mermaid` slash plugin.
- Light/dark diagram theming driven by a new `theme` prop.
- Click-to-enlarge overlay for diagrams too wide for the column.

Out of scope (deliberate):
- Diagram previews in raw (CodeMirror) mode.
- Pan/step zoom inside the overlay — fit-to-screen only.
- Syntax highlighting for code blocks generally.

## Public API

```ts
// SpoteEditorProps gains:
theme?: 'light' | 'dark' | 'auto'   // default: 'auto'
```

`'auto'` follows `matchMedia('(prefers-color-scheme: dark)')`, guarded — jsdom has no
`matchMedia` and the library must survive SSR. Maps to mermaid's `theme: 'default'` /
`'dark'`.

The prop exists rather than sniffing `--spote-bg` because that variable is set by the host
and may be any colour; inferring lightness from an arbitrary colour is magic that fails
silently. Documented as: controls diagram rendering only — the editor's own colours still
come from the `--spote-*` CSS variables.

Also exported: the `mermaid` plugin (added to `DEFAULT_PLUGINS`).

## Rendering module

`src/components/SpoteEditor/milkdown/mermaidRenderer.ts` — knows nothing about ProseMirror.

```ts
type MermaidTheme = 'light' | 'dark'
type RenderResult = { ok: true; svg: string } | { ok: false; message: string }

export function renderMermaid(code: string, theme: MermaidTheme): Promise<RenderResult>
export function parseMermaid(code: string): Promise<{ ok: true } | { ok: false; message: string }>
```

**Lazy load.** A module-level `let loading: Promise<Mermaid> | null`; the first call does
`import('mermaid')`, every later call reuses that promise. Notes without diagrams never pay
for mermaid — the whole point of shipping it as a dependency rather than a bundled import.

**Rendering.** `mermaid.initialize({ startOnLoad: false, theme, securityLevel: 'strict' })`
runs before each render. Mermaid's config is global, so re-initializing is how a runtime
theme switch is expressed; it is cheap. Then `await mermaid.render(uniqueId, code)`.

`securityLevel: 'strict'` is not configurable. The rendered SVG is injected as HTML into the
editor, mermaid has a history of XSS through diagram text, and in Spote a note may have come
from someone else via a share link. `strict` sanitizes labels and disables `htmlLabels`.

**Errors are data, not exceptions.** Invalid syntax is a normal state while typing, so
failures return `{ ok: false, message }`. Mermaid leaves an orphan `<div id="d…">` in
`document.body` when a render throws; the module removes it in a `finally`, otherwise the
DOM grows with every keystroke in a broken diagram.

**Stateless otherwise.** No caching, no debouncing here. Race handling belongs to the node
view, which knows which block it is rendering.

## Node view and interaction

A `$prose` plugin registering `props.nodeViews.code_block`, matching the idiom already used
by `slashPlugin.ts` and `taskCheckboxPlugin.ts`.

ProseMirror offers no way to decline a node view for a particular node, so the node view is
constructed for *every* code block and mirrors the commonmark preset's default DOM
(`pre > code`) when the language is not `mermaid` — a no-op in that case. The preset's actual
`toDOM` output must be checked during implementation and mirrored exactly.

**Edit state is derived, not stored.** The rule is: *a mermaid block shows its code when the
selection is inside it, and its diagram otherwise.* A companion plugin puts a node decoration
on the block containing the selection; the node view reads it in `update()`. No instance
field, no plugin state to keep in sync, nothing that can drift out of step. Three behaviours
fall out for free:

- Clicking the diagram dispatches a `TextSelection` into the block — code appears with the
  cursor already placed.
- Clicking away moves the selection, and the block re-renders. No "done" button.
- `/mermaid` inserts a block and the cursor lands inside it, so it opens in code mode.

**Render cycle.** On `update()` the node view compares the code text and theme against what
it last rendered. On a change it starts a render tagged with a monotonic token, and applies
the result only if that token is still current and the view has not been destroyed.

While the cursor is inside the block we do *not* re-render. Instead a debounced (~250 ms)
`parseMermaid()` drives a thin status line under the code (`⚠ line 3: …`). Cheap, and the
error shows up as you type rather than when you click away.

**Details that otherwise bite:**
- `ignoreMutation` returns `true` for mutations outside `contentDOM`, or ProseMirror tries to
  read our injected SVG as document content.
- `stopEvent` swallows events inside the preview container and its buttons.
- `destroy` invalidates any in-flight render token.
- Under `readOnly` the diagram is always shown and clicking it does nothing.

## Theme propagation

A theme change must reach already-rendered diagrams. The companion plugin holds a version
counter in plugin state; on a theme change `MilkdownEditor` dispatches an empty transaction
carrying a meta flag that bumps the counter. The counter is part of the node decoration spec,
so decorations change → `update()` runs → the node view sees a theme different from the one
it last rendered and re-renders. It reuses the path the selection already travels.

## Zoom overlay

A plain click is taken by editing, so enlarging gets its own `⤢` button in the top-right of
the preview container, revealed on hover and on focus so the keyboard can reach it. It works
under `readOnly` too.

The overlay is React, not node-view DOM: the node view factory takes `onZoom: (svg: string)
=> void`, `MilkdownEditor` holds a `useState<string | null>` and renders `<MermaidOverlay>`.
This is the same pattern `CommandMenu` and `SelectionBubble` already use to let prose plugins
talk to React.

Behaviour: dark scrim, SVG scaled to `max 90vw / 90vh`, Escape or a scrim click closes,
focus moves to the close button on open and back to the editor on close.

## Slash plugin

One line in `command-core/plugins/blocks.ts`; no new `PluginAction` variant:

```ts
export const mermaid: SpotePlugin = {
  id: 'mermaid', label: 'Diagram', icon: '⌗',
  slash: () => ({ kind: 'insert', markdown: '```mermaid\ngraph TD\n  A --> B\n```\n' }),
}
```

It travels the same route as `divider`, which means it works in both engines — raw mode
included — for free. It seeds a small valid diagram rather than an empty fence, because an
empty mermaid fence renders an error message, which is a poor first second.

## Packaging

`mermaid` goes in `dependencies` and is added to `rollupOptions.external` in
`vite.config.ts`. Today every dependency is bundled (only React is external), but mermaid is
~500 kB gzipped — larger than the whole library — and bundling it defeats the lazy import. As
an external, `import('mermaid')` is resolved by the consumer's bundler and becomes a chunk on
their side.

**Open risk.** Lazy loading needs the build to split code across files. ESM and CJS can do
that; UMD cannot, since a `<script>` tag is one file. The build currently emits ESM + UMD
from a single entry, so Vite forces `inlineDynamicImports`. Whether the ESM output keeps its
lazy chunk while the UMD format is still configured is unknown without trying it.

The first step of the implementation plan is therefore to run the real build and inspect
`dist/`. If ESM is forced inline, the resolution is to **replace the UMD format with CJS**:
`require('spote-editor')` keeps working, `main` still points at a `.cjs` file, and the only
capability lost is loading the library from a `<script>` tag — which is already theoretical
for a React component that needs React present as a separate global. Approved in advance; it
does not need to come back as a question.

## Testing

vitest + jsdom, with `vi.mock('mermaid')` — real SVG rendering does not work in jsdom.

- `mermaidRenderer`: imports mermaid once across calls; `ok: true` with svg; `ok: false` when
  mermaid throws; removes the orphan node after a failure.
- Node view: a mermaid block shows the SVG; a plain code block is untouched; a selection
  inside the block shows the code; a theme change triggers a re-render.
- Round-trip: markdown in equals markdown out for a document containing a mermaid block.
- Slash plugin: inserts the fence.
- Overlay: opens from the button, closes on Escape.

## Files

New: `milkdown/mermaidRenderer.ts`, `milkdown/mermaidNodeView.ts`,
`milkdown/MermaidOverlay.tsx`, plus tests.

Changed: `milkdown/MilkdownEditor.tsx`, `SpoteEditor.tsx`, `SpoteEditor.types.ts`,
`command-core/plugins/blocks.ts`, `command-core/plugins/index.ts`, `index.ts`,
`styles/index.css`, `vite.config.ts`, `package.json`, `AGENTS.md`, `README.md`, demo page.

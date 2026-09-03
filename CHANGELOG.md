# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-09-03

### Added

- **Mermaid diagrams.** Fenced `mermaid` code blocks render as diagrams in WYSIWYG mode.
  The source is revealed for editing when the cursor enters the block, and a diagram can be
  enlarged in a full-screen overlay. `mermaid` is a runtime dependency but is loaded lazily,
  so it only enters the bundle when a diagram is actually rendered.
- **`/mermaid` slash command**, exported as the `mermaid` plugin and included in `DEFAULT_PLUGINS`.
- **`theme` prop** (`'light' | 'dark' | 'auto'`, default `'auto'`) controlling diagram rendering.
  `'auto'` follows `prefers-color-scheme` and updates live. The editor's own colours continue to
  come from the `--spote-*` CSS variables. Exported as the `ThemePreference` type.
- **`defaultMode` prop** (`'wysiwyg' | 'raw'`, default `'wysiwyg'`) setting the mode an uncontrolled
  editor opens in. Ignored when the controlled `mode` prop is given.
- **Task checkboxes** in the WYSIWYG editor, with accompanying styles.
- **Escape closes the selection bubble** in the WYSIWYG editor.

### Changed

- The CommonJS build is emitted as a real CJS bundle (`dist/spote-editor.cjs`) instead of UMD.
  Consumers using `import`/`require` are unaffected; anyone loading the old UMD build through a
  `<script>` tag and reading a global will need to switch to a bundler or the ESM build.

### Fixed

- Mermaid edit mode is gated on a real selection transaction rather than focus alone, so the source
  no longer flashes open when the editor merely regains focus.
- The portaled zoom overlay has CSS fallbacks for environments without the newer sizing units.
- `useResolvedTheme` removes its `matchMedia` listener on unmount.
- CodeMirror layout reads are deferred to avoid synchronous reflow while the slash menu opens.

## [0.2.1] - 2026-06-18

### Fixed

- Deferred layout reads in `CodeMirrorEditor` and the slash extension.

### Added

- `AGENTS.md` with integration instructions for agents.

## [0.2.0] - 2026-06-18

### Added

- **Image upload pipeline** for both editors, covering the slash command, paste, and drop.
  Gated on the new `onUpload` prop — image features stay off when it is absent.
- Keyboard shortcuts for inline text formatting in the CodeMirror editor.
- Undo/redo in WYSIWYG via `@milkdown/plugin-history`.
- MIT license file and `license` field.

### Changed

- Labels and placeholders are in English throughout.

## [0.1.0] - 2026-06-16

### Added

- Initial release: `SpoteEditor`, a dual-mode markdown editor pairing a Milkdown WYSIWYG surface
  with a CodeMirror raw surface behind one mode toggle.
- Command plugin system (`SpotePlugin`, per-surface handlers, action union) with `DEFAULT_PLUGINS`.
- Shared slash command menu, selection bubble, and link popover with note search.
- Styling via `--spote-*` CSS variables.

[0.3.0]: https://github.com/tullanders/spote-editor/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/tullanders/spote-editor/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/tullanders/spote-editor/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/tullanders/spote-editor/releases/tag/v0.1.0

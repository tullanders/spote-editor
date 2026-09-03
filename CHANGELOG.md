# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0](https://github.com/tullanders/spote-editor/compare/spote-editor-v0.3.0...spote-editor-v0.4.0) (2026-09-03)


### Added

* add a /mermaid slash command ([7e7692d](https://github.com/tullanders/spote-editor/commit/7e7692da564dc6379d60993fdd434d55842bfcf0))
* add defaultMode prop to SpoteEditor for initial mode configuration ([9d6561f](https://github.com/tullanders/spote-editor/commit/9d6561f0ab425c1dca6596f71cc1db9e172d0b26))
* add Escape key handling for closing selection bubble in MilkdownEditor ([129115e](https://github.com/tullanders/spote-editor/commit/129115eb15ec1731b60801c37f80a530eb76f163))
* add image slash plugin, register in defaults, add upload gate ([5aecbba](https://github.com/tullanders/spote-editor/commit/5aecbba21603ec55dd31035fe7252eb7a5d68f1e))
* add lazily-loaded mermaid rendering module ([eb474a6](https://github.com/tullanders/spote-editor/commit/eb474a6deb15cb4c23f1605b3990384e16c02c68))
* add shared image-upload helpers (id, placeholder, markdown, file filter) ([95d41f1](https://github.com/tullanders/spote-editor/commit/95d41f10538f2ac033705e8d7788ef8a263b0e0a))
* add uploadImage action, pickImage UI, and onUpload prop types ([d83dc83](https://github.com/tullanders/spote-editor/commit/d83dc83c0825b56d4f8dfb654e6864832622eca6))
* built-in command plugins + DEFAULT_PLUGINS ([256a01d](https://github.com/tullanders/spote-editor/commit/256a01d130bf296f25d38371931bf4119fe28cdb))
* cmCommands mapping commandId to CM6 edits ([535bf7a](https://github.com/tullanders/spote-editor/commit/535bf7a64c02d9f5be3a7c1b16ac337f0f3a4514))
* CodeMirror action interpreter ([32efbf5](https://github.com/tullanders/spote-editor/commit/32efbf55d5a2f562f1b79a0b58c44a14ece3f9c5))
* CodeMirror raw editor with slash menu and bubble ([8394bec](https://github.com/tullanders/spote-editor/commit/8394bec917822588dd21ee3cda3e8212b5b2cb48))
* command metadata list with derived CommandId type ([578143a](https://github.com/tullanders/spote-editor/commit/578143a37cd02301e3e9aef1455050c2a66ddbbe))
* demo + docs for command plugins ([a7af77b](https://github.com/tullanders/spote-editor/commit/a7af77b8477fcb8c5d4a26ec8d21a2968d4d260f))
* demo harness for SpoteEditor ([4d14823](https://github.com/tullanders/spote-editor/commit/4d14823b0d52b837eb8f726193964206f19b1d2f))
* editor styles with CSS variables ([cc52267](https://github.com/tullanders/spote-editor/commit/cc522671d9275e7789695193cc3835547a1019ab))
* enlarge a diagram in a full-screen overlay ([fda1119](https://github.com/tullanders/spote-editor/commit/fda111948913dd69b08e3d3857fb09a4e2820542))
* image upload pipeline (slash/paste/drop) in the CodeMirror adapter ([541993b](https://github.com/tullanders/spote-editor/commit/541993b66343910c20255a0016fa0a7d9cf225d3))
* image upload pipeline (slash/paste/drop) in the Milkdown adapter ([1be1a48](https://github.com/tullanders/spote-editor/commit/1be1a48aa6468b64d757ab8d681ab67c9cca6d32))
* implement keyboard shortcuts for inline text formatting in CodeMirror editor ([3d72e3e](https://github.com/tullanders/spote-editor/commit/3d72e3ecd9c631c3164acb1ae0ee0333652db0b2))
* implement task checkbox functionality in Milkdown editor with associated styles and tests ([6179cb6](https://github.com/tullanders/spote-editor/commit/6179cb66cb852c017826def5acc9d3f9acf15e49))
* light/dark diagram theming via a theme prop ([b0c9c9c](https://github.com/tullanders/spote-editor/commit/b0c9c9c8d5f9566d8e48013a03fec8afb3740605))
* LinkPopover with URL + note search ([be2e7ec](https://github.com/tullanders/spote-editor/commit/be2e7ecd17785867264645b8783850b255d2d3e8))
* mermaid diagram support ([3951a54](https://github.com/tullanders/spote-editor/commit/3951a541f5dc270562f56f5f47c0836d9b440566))
* Milkdown WYSIWYG adapter with shared menu and bubble ([ab4ff03](https://github.com/tullanders/spote-editor/commit/ab4ff037286fa2df51739f1914e8185005b5fc7a))
* plugin menu filter helpers ([c20d9ff](https://github.com/tullanders/spote-editor/commit/c20d9ffaa8e216cdfefca300805729364650ddba))
* render mermaid code blocks as diagrams in wysiwyg ([9a8ada5](https://github.com/tullanders/spote-editor/commit/9a8ada57a1c572a9d68b4f828451ffbd3e1695a2))
* reveal mermaid source when the cursor enters the block ([19d9f26](https://github.com/tullanders/spote-editor/commit/19d9f26aedbd33edbe53c9c2bd4bfd624405b1f8))
* shared CommandMenu UI ([8156995](https://github.com/tullanders/spote-editor/commit/8156995036b5ad5febd812833b28e5d8f99c2408))
* shared SelectionBubble UI ([5c9edd5](https://github.com/tullanders/spote-editor/commit/5c9edd5a4d084623ba93a92d6cdf1aca8dc0a193))
* SpoteEditor shell with mode toggle and shared link popover ([69ace54](https://github.com/tullanders/spote-editor/commit/69ace54d25a712d30ea7a0eabf65246e852c45aa))
* SpotePlugin types (per-surface handlers + action union) ([2151191](https://github.com/tullanders/spote-editor/commit/215119120b1832fcb7f22c16daba8d3b26931577))
* thread onUpload + pickImage through the shell and gate the image plugin ([57ff240](https://github.com/tullanders/spote-editor/commit/57ff2407ed710d721dbc639cef6d38ff9ba6c7d2))
* useCommandMenu state hook ([e20d769](https://github.com/tullanders/spote-editor/commit/e20d7698fd78658d11d0569630d2d7447a6d4803))
* wire undo/redo into WYSIWYG via @milkdown/plugin-history ([186e7d1](https://github.com/tullanders/spote-editor/commit/186e7d1541b126fbb52af00a0e89c332ca79fe29))
* wrap-on-type for CodeMirror ([5a2a095](https://github.com/tullanders/spote-editor/commit/5a2a095237906ec3fb7084c0c4466774724b3f19))


### Fixed

* address final-review findings in the mermaid feature ([4c50654](https://github.com/tullanders/spote-editor/commit/4c506546c4b986aec89d8d899a7b0a128d241ae5))
* align CM slash upload with fire-and-forget pipeline; reset shared test state; note mode-switch limitation ([359a223](https://github.com/tullanders/spote-editor/commit/359a2238e23778fb41265ca55acfb607068f6207))
* declare @milkdown/plugin-listener as a direct dependency ([ddf386f](https://github.com/tullanders/spote-editor/commit/ddf386f3777110bffadbaff3f9eefcb4697aa84b))
* exclude test files from dts generation ([17bf508](https://github.com/tullanders/spote-editor/commit/17bf5089219a2a2cf0bfa31ff2dc4a1a54daa1e1))
* gate mermaid edit mode on a real selection transaction, not focus alone ([417c5ec](https://github.com/tullanders/spote-editor/commit/417c5ec859229d468f80d67cd5340c34886b5ba9))
* give the portaled zoom overlay CSS fallbacks and test its untested constraints ([50e0627](https://github.com/tullanders/spote-editor/commit/50e06276ced4cb31cbf8c80674854960b136f02d))
* provide global name for react/jsx-runtime in UMD build ([d7dcc91](https://github.com/tullanders/spote-editor/commit/d7dcc917bb92da51c2f0a15604b9ad1d9778eb1c))
* read Milkdown mark command keys lazily (were cached undefined at module load) ([3cfb7d9](https://github.com/tullanders/spote-editor/commit/3cfb7d92c6dc3476104101a9aebaf8a0f11b539c))
* repair lint script and eslint flat config (browser globals) ([c73b211](https://github.com/tullanders/spote-editor/commit/c73b2116b058acae408a94f83d04d3d42675e400))
* replace listener count-parity test with a real leak-detection unit test ([6041faf](https://github.com/tullanders/spote-editor/commit/6041faff51e707e74bcb1d07e8f20d5cc0f4be63))
* replace UMD with CJS format and add theme + mermaid tests ([c446eec](https://github.com/tullanders/spote-editor/commit/c446eec866cb934d7d2911b0b129c2f0c5e5c378))
* settle outstanding pickImage promise before starting a new pick ([25e9859](https://github.com/tullanders/spote-editor/commit/25e98592302942042676e9c85dad9060b7e9d20a))
* snapshot bubble link selection to survive async popover ([601b984](https://github.com/tullanders/spote-editor/commit/601b98414ec679be59855f50c0d39e6eb453452a))
* solid background and text color on portaled menus and bubble ([b1e77ce](https://github.com/tullanders/spote-editor/commit/b1e77ce2ad0a61d25faf9bf4f082370ce584043f))
* use ViewMutationRecord for ignoreMutation to satisfy tsc build ([be26966](https://github.com/tullanders/spote-editor/commit/be26966417299a37aa8c93ba765d38692350f1ae))


### Changed

* CodeMirror adapter uses plugins + action interpreter ([321515f](https://github.com/tullanders/spote-editor/commit/321515f3c1035b7d138e39f9b474809444231076))
* CommandMenu + useCommandMenu over plugins ([8290637](https://github.com/tullanders/spote-editor/commit/829063749ddb5d69ceafe1c7272238f85fb4f071))
* data-driven SelectionBubble from plugins ([2c44ff5](https://github.com/tullanders/spote-editor/commit/2c44ff585cee5690279b7e16167f07b98a67fce9))
* delete dead commands.ts/core.types.ts after plugin migration ([5075bc0](https://github.com/tullanders/spote-editor/commit/5075bc04451709f40d8a266454ce37a26ad7720d))
* Milkdown adapter uses plugins + action interpreter ([051bcea](https://github.com/tullanders/spote-editor/commit/051bcea757e1b66610c2239ae6888771a88e279f))
* SpoteEditor shell over plugins + ui.requestLink ([642c352](https://github.com/tullanders/spote-editor/commit/642c352e178653686f196cee3a3215c62ad90c58))
* update labels and placeholders to English across various components ([592b23e](https://github.com/tullanders/spote-editor/commit/592b23e8f7b86b8495ccf40ff28133398fdd355a))
* wire placeholder, compile-check CM command coverage, stabilize default commands ([0cc2381](https://github.com/tullanders/spote-editor/commit/0cc238179263d98fd5f6e1758be8bcd965eaf6d2))


### Documentation

* add agent instructions for spote-editor integration ([193a5d9](https://github.com/tullanders/spote-editor/commit/193a5d9ce8413f12cacf94cc143b1369c62e8052))
* add CHANGELOG and ship it in the npm tarball ([b26b1ff](https://github.com/tullanders/spote-editor/commit/b26b1fffcabffea869299e557af11d3c10139246))
* add image handling implementation plan ([4cf77c0](https://github.com/tullanders/spote-editor/commit/4cf77c044e7f3e03bacd49180ab2d4fdcddd52cc))
* add mermaid diagram design spec ([2e5c63a](https://github.com/tullanders/spote-editor/commit/2e5c63ad89b69e697cafb3b5f8efdb6d5a2c4909))
* add mermaid implementation plan ([9d70635](https://github.com/tullanders/spote-editor/commit/9d70635105cfdc8ca53adbb8bc493828ecb5416c))
* command-plugins design spec (per-surface handlers, action union, ctx.ui) ([a723438](https://github.com/tullanders/spote-editor/commit/a7234382022b3fc3eb8f0add7276307735a67bd7))
* correct README plugin icon type (ReactNode) and divider wording ([6acde46](https://github.com/tullanders/spote-editor/commit/6acde46d243f00ea3f8263ae0739bab1905bc3b2))
* **demo:** wire a dummy data-URL onUpload to demo image handling ([207030c](https://github.com/tullanders/spote-editor/commit/207030c4a2769714f363cbfd0343583dcc8c9b3b))
* design specs for image handling and undo/redo ([4fbcad2](https://github.com/tullanders/spote-editor/commit/4fbcad2ab89168a069857184eeb6ef8b077248bf))
* document mermaid diagram support ([2b2b697](https://github.com/tullanders/spote-editor/commit/2b2b69739ccc4fdd20d2d489329c97951ef670d3))
* enhance README with additional context about Spote and its integration with spote-editor ([4cf752c](https://github.com/tullanders/spote-editor/commit/4cf752c6ea7bcbe848e7ac8110820d36416a2c1d))
* extend CSS isolation note to cover content typography (li spacing etc.) ([e0a8d96](https://github.com/tullanders/spote-editor/commit/e0a8d9666d367ff41ecc34b8cf40dc72c0423b4b))
* fix plugin list order to match DEFAULT_PLUGINS ([060c29a](https://github.com/tullanders/spote-editor/commit/060c29aa5723eb2e46126012ee092d8fbb964457))
* note Milkdown + CodeMirror engines and bundle size in README ([2a633da](https://github.com/tullanders/spote-editor/commit/2a633dadf5e07d02c92c759925cad29b4a7f433c))
* note on CSS isolation from host styles (Tailwind) ([932f970](https://github.com/tullanders/spote-editor/commit/932f970d5c9374aa0dee8062d439b62f9c6dd9e0))
* plan for command-plugins refactor ([d2d0034](https://github.com/tullanders/spote-editor/commit/d2d003442ca6291fc2c7f250abe3b3a047fc107c))
* rewrite command-plugins implementation plan from approved spec ([3ca30a8](https://github.com/tullanders/spote-editor/commit/3ca30a8951666864bb48dfc7cd1ccac79c62465e))

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

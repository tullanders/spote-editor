# Note: CSS isolation from host styles (Tailwind etc.)

**Requirement:** The whole editor — including the portaled menus AND the rendered
text content — must be styleable by us and NOT disturbed by the host app's global CSS
(Tailwind Preflight, resets, utility leakage, source-order wins).

This is NOT part of the command-plugins refactor (that's menu items/actions). Content
typography lives here, with the menu/overlay isolation.

## In scope: content typography (both modes)
Today we ship almost no content CSS, so spacing/sizing is whatever Milkdown's default
theme or the browser gives — e.g. **`li` items in a `ul` have too much margin/padding**.
We must own a content stylesheet, scoped to the editor:
- **WYSIWYG (Milkdown renders real DOM):** style `h1..h6`, `p`, `ul/ol/li` (tighten the
  li spacing), `blockquote`, `pre/code`, `a`, `strong/em`, `hr`, tables. This both fixes
  default spacing AND counters Tailwind Preflight stripping.
- **Raw (CodeMirror):** editor chrome only — mono font, font-size, line-height, padding;
  optionally markdown token colors via the language theme. No "rendered" content there.
- Expose the key knobs as CSS custom properties (spacing, font sizes) so hosts can tune
  without overriding selectors.

**Current state (v1): NOT isolated.** The `spote-` class prefix prevents name
collisions only. Real exposure points:
- Tailwind **Preflight** resets bare `button`, `input`, `ul`, `li`, `h1..h6`, etc.
  globally. The menus use bare `<button>/<input>/<ul>`, and the WYSIWYG/raw content
  renders real `h1`, `strong`, `ul`… — Preflight strips heading sizes, list markers,
  button chrome inside the editor.
- The slash menu / link popover / selection bubble are `createPortal`ed to
  `document.body`, i.e. inside the host DOM where host CSS fully applies.
- Our rules are single-class (low specificity); host CSS loaded later can win on order.
- We already hit a related bug (themed CSS vars don't cascade to portals → fixed with
  fallbacks in `b1e77ce`). Same root cause: overlays live outside `.spote-editor`.

## Options

### A. Defensive scoped reset (recommended first step) — small/medium effort, ~95%
- Apply `all: revert` (or a thorough explicit reset) on the four roots: `.spote-editor`,
  `.spote-command-menu`, `.spote-link-popover`, `.spote-bubble`, then re-apply our styles.
- Explicitly style editor **content** elements (headings, lists, blockquote, code,
  strong, em, hr, links) so Preflight stripping is irrelevant — this is also where the
  default-spacing fixes live (e.g. tighter `li` margins). See "In scope: content
  typography" above.
- Use `:where()` for our base so our resets stay low-specificity *internally* but the
  reset value (`revert`) neutralizes inherited host values at the boundary.
- Limits: not bulletproof vs host `!important` or aggressive `* { }` rules. Good enough
  for the actual real-world offender (Tailwind Preflight).

### B. Shadow DOM — larger effort, ~100%
- Attach a shadow root at the editor root; inject `style.css` into it; render the editor
  AND the overlays inside the shadow root (portal into a shadow-root container, not
  `document.body`). Theme via CSS custom properties (they pierce the shadow boundary).
- Complications: portals must move into the shadow root; positioning stays via
  `position:fixed` + `coordsAtPos`. CodeMirror 6 supports shadow DOM (`getRootNode`);
  ProseMirror/Milkdown works but selection/focus/measuring need testing.
- Best when a host environment proves hostile despite option A.

## Recommendation
Ship **A** as the default (cheap, fixes Tailwind). Keep **B** as a documented opt-in /
escalation (e.g. a `shadow?: boolean` prop) if a real integration needs total isolation.

## Decision needed before implementing
- A first, or go straight to B? (Recommend A.)
- If A: also add a `shadow` opt-in now, or defer until needed? (Recommend defer — YAGNI.)

## Relation to other work
Independent of the command-plugins refactor; can land before or after. If both are
planned, do command-plugins first (smaller blast radius), then CSS isolation.

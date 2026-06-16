# Undo/Redo — Design Spec

Date: 2026-06-16
Status: Draft for review

## Goal

Working undo/redo via keyboard (Cmd/Ctrl+Z, redo via Shift+Cmd/Ctrl+Z and Ctrl+Y) in BOTH
modes. No visible toolbar buttons in v1.

## Current state (verified)

- **Raw (CodeMirror):** already works — `CodeMirrorEditor` wires `history()` +
  `historyKeymap` from `@codemirror/commands`. Nothing to do.
- **WYSIWYG (Milkdown):** NOT wired today. `MilkdownEditor` uses
  `.use(commonmark).use(gfm).use(listener)` only — no history plugin. So undo/redo does
  nothing in WYSIWYG.
- `@milkdown/plugin-history` is present (transitive) and exports `history`
  (`MilkdownPlugin[]`), `undoCommand`, `redoCommand`, `historyKeymap` (bindings for
  Undo/Redo). It is just not `.use`-d.

## Change

1. Add `@milkdown/plugin-history` as a **direct** dependency (it's only transitive now —
   importing it directly should be declared).
2. In `MilkdownEditor`, `.use(history)` (the plugin array, which bundles the history state
   + the Undo/Redo keymap). Place it alongside commonmark/gfm/listener.
3. Confirm the history keymap (Mod-z / Shift-Mod-z / Mod-y) is active and not shadowed by
   our slash `$prose` plugin or anything else.

That's essentially the whole feature — one dependency + one `.use`.

## Accepted limitation (per decision)

**Per-mode history.** Each engine keeps its own independent undo stack. Toggling
WYSIWYG⇄raw re-seeds the other editor from the shared markdown string, so the history does
NOT carry across the toggle — undo in raw won't revert edits made in WYSIWYG before the
switch. Accepted for v1. (A unified, string-level cross-mode history is a large effort and
explicitly out of scope.)

## Verification

- WYSIWYG: type, Cmd/Ctrl+Z reverts, Shift+Cmd/Ctrl+Z (and Ctrl+Y) re-applies.
- Raw: unchanged, still works.
- Slash menu and selection bubble still work (keymap not shadowed).
- Build/lint/tests green. (No new unit tests strictly required — this is engine-provided
  behavior verified manually; optionally assert the history plugin is included in the
  Milkdown editor config if cheaply testable.)

## Non-goals (v1)

- No toolbar buttons (keyboard only).
- No cross-mode unified history.
- No custom history depth / grouping config.

## Open questions

- Does Milkdown's `history` keymap conflict with anything we added? (Verify during impl;
  unlikely.) None otherwise — this is a small, low-risk change.

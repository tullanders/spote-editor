import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state'
import type { CommandId } from '../command-core/commands'

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

// Keyed by every CommandId so adding a command to commands.ts forces a CM handler
// here (a missing key is a compile error) — same guarantee the Milkdown adapter has.
const handlers: Record<CommandId, (state: EditorState) => TransactionSpec> = {
  h1: (state) => linePrefix(state, '# '),
  h2: (state) => linePrefix(state, '## '),
  h3: (state) => linePrefix(state, '### '),
  'bullet-list': (state) => linePrefix(state, '- '),
  'ordered-list': (state) => linePrefix(state, '1. '),
  quote: (state) => linePrefix(state, '> '),
  bold: (state) => wrapSelection(state, '**'),
  italic: (state) => wrapSelection(state, '*'),
  code: (state) => wrapSelection(state, '`'),
  codeblock: (state) => insertBlock(state, '```\n\n```'),
  divider: (state) => insertBlock(state, '\n---\n'),
  link: (state) => insertLink(state),
}

export function applyCmCommand(state: EditorState, id: string): TransactionSpec {
  const handler = (handlers as Record<string, (state: EditorState) => TransactionSpec>)[id]
  return handler ? handler(state) : { changes: [] }
}

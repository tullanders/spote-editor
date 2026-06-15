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

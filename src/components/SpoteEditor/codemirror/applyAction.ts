import { EditorSelection, type EditorState, type TransactionSpec } from '@codemirror/state'
import type { PluginAction } from '../command-core/plugin.types'

const MARK_MARKER: Record<'strong' | 'emphasis' | 'inlineCode', string> = {
  strong: '**', emphasis: '*', inlineCode: '`',
}

function replaceSelection(state: EditorState, text: string): TransactionSpec {
  const r = state.selection.main
  return { changes: { from: r.from, to: r.to, insert: text }, selection: EditorSelection.cursor(r.from + text.length) }
}

function toggleMark(state: EditorState, marker: string): TransactionSpec {
  const r = state.selection.main
  const len = marker.length
  const wrapped =
    r.from >= len && r.to + len <= state.doc.length &&
    state.sliceDoc(r.from - len, r.from) === marker &&
    state.sliceDoc(r.to, r.to + len) === marker
  if (wrapped) {
    return {
      changes: [
        { from: r.from - len, to: r.from },
        { from: r.to, to: r.to + len },
      ],
      selection: EditorSelection.range(r.from - len, r.to - len),
    }
  }
  return {
    changes: [
      { from: r.from, insert: marker },
      { from: r.to, insert: marker },
    ],
    selection: EditorSelection.range(r.from + len, r.to + len),
  }
}

function linePrefix(state: EditorState, prefix: string): TransactionSpec {
  const line = state.doc.lineAt(state.selection.main.from)
  return { changes: { from: line.from, insert: prefix }, selection: EditorSelection.cursor(state.selection.main.from + prefix.length) }
}

const BLOCK_PREFIX: Record<'bulletList' | 'orderedList' | 'blockquote', string> = {
  bulletList: '- ', orderedList: '1. ', blockquote: '> ',
}

export function applyAction(state: EditorState, action: PluginAction): TransactionSpec {
  switch (action.kind) {
    case 'replaceSelection': return replaceSelection(state, action.markdown)
    case 'insert': return replaceSelection(state, action.markdown) // same: replaces (possibly empty) selection at cursor
    case 'toggleMark': return toggleMark(state, MARK_MARKER[action.mark])
    case 'setBlock':
      if (action.block === 'heading') return linePrefix(state, '#'.repeat(action.attrs?.level ?? 1) + ' ')
      if (action.block === 'codeBlock') {
        const r = state.selection.main
        const body = state.sliceDoc(r.from, r.to)
        const text = '```\n' + body + '\n```'
        return { changes: { from: r.from, to: r.to, insert: text }, selection: EditorSelection.cursor(r.from + 4) }
      }
      return linePrefix(state, BLOCK_PREFIX[action.block])
    case 'uploadImage':
      throw new Error('uploadImage is async; handled by the adapter, not applyAction')
  }
}

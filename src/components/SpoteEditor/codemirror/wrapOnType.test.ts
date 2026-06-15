import { describe, it, expect } from 'vitest'
import { EditorState, EditorSelection } from '@codemirror/state'
import { wrapTransactionFor, WRAP_CHARS } from './wrapOnType'

function stateWithSelection(doc: string, from: number, to: number) {
  return EditorState.create({ doc, selection: EditorSelection.single(from, to) })
}

describe('wrapOnType', () => {
  it('wraps a non-empty selection with the typed char', () => {
    const state = stateWithSelection('hello world', 0, 5) // "hello"
    const spec = wrapTransactionFor(state, '*')
    expect(spec).not.toBeNull()
    const next = state.update(spec!).state
    expect(next.doc.toString()).toBe('*hello* world')
    // selection still covers "hello"
    expect(next.selection.main.from).toBe(1)
    expect(next.selection.main.to).toBe(6)
  })

  it('re-wraps to ** when * is typed on an already *-wrapped selection', () => {
    const state = stateWithSelection('*hello* world', 1, 6) // inner "hello"
    const spec = wrapTransactionFor(state, '*')
    const next = state.update(spec!).state
    expect(next.doc.toString()).toBe('**hello** world')
  })

  it('returns null for empty selection (lets default insert happen)', () => {
    const state = stateWithSelection('hello', 2, 2)
    expect(wrapTransactionFor(state, '*')).toBeNull()
  })

  it('returns null for non-wrap chars', () => {
    const state = stateWithSelection('hello', 0, 5)
    expect(wrapTransactionFor(state, 'x')).toBeNull()
  })

  it('handles _, backtick and ~', () => {
    expect(WRAP_CHARS).toEqual(expect.arrayContaining(['*', '_', '`', '~']))
  })
})

import { describe, it, expect } from 'vitest'
import { EditorState, EditorSelection } from '@codemirror/state'
import { applyAction } from './applyAction'
import type { PluginAction } from '../command-core/plugin.types'

function run(doc: string, from: number, to: number, action: PluginAction) {
  const state = EditorState.create({ doc, selection: EditorSelection.single(from, to) })
  return state.update(applyAction(state, action)).state.doc.toString()
}

describe('applyAction (CM)', () => {
  it('replaceSelection swaps the selection for markdown', () => {
    expect(run('hello world', 0, 5, { kind: 'replaceSelection', markdown: '[hello](u)' })).toBe('[hello](u) world')
  })
  it('insert puts markdown at the cursor', () => {
    expect(run('ab', 1, 1, { kind: 'insert', markdown: 'X' })).toBe('aXb')
  })
  it('toggleMark strong wraps the selection with **', () => {
    expect(run('hi', 0, 2, { kind: 'toggleMark', mark: 'strong' })).toBe('**hi**')
  })
  it('toggleMark strong unwraps when already wrapped', () => {
    expect(run('**hi**', 2, 4, { kind: 'toggleMark', mark: 'strong' })).toBe('hi')
  })
  it('setBlock heading prefixes the line', () => {
    expect(run('title', 0, 0, { kind: 'setBlock', block: 'heading', attrs: { level: 2 } })).toBe('## title')
  })
  it('setBlock bulletList prefixes with "- "', () => {
    expect(run('item', 0, 0, { kind: 'setBlock', block: 'bulletList' })).toBe('- item')
  })
  it('setBlock codeBlock fences the selection', () => {
    expect(run('x', 0, 1, { kind: 'setBlock', block: 'codeBlock' })).toContain('```')
  })
  it('uploadImage is rejected — it is handled async by the adapter, not applyAction', () => {
    const state = EditorState.create({ doc: 'x', selection: EditorSelection.single(0, 0) })
    const file = new File(['data'], 'a.png', { type: 'image/png' })
    expect(() => applyAction(state, { kind: 'uploadImage', file })).toThrow()
  })
})

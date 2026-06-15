import { describe, it, expect } from 'vitest'
import { EditorState, EditorSelection } from '@codemirror/state'
import { applyCmCommand } from './cmCommands'

function run(doc: string, from: number, to: number, id: string) {
  const state = EditorState.create({ doc, selection: EditorSelection.single(from, to) })
  const spec = applyCmCommand(state, id)
  return state.update(spec).state.doc.toString()
}

describe('applyCmCommand', () => {
  it('h1 prefixes the line with "# "', () => {
    expect(run('title', 0, 0, 'h1')).toBe('# title')
  })
  it('bullet-list prefixes with "- "', () => {
    expect(run('item', 0, 0, 'bullet-list')).toBe('- item')
  })
  it('quote prefixes with "> "', () => {
    expect(run('q', 0, 0, 'quote')).toBe('> q')
  })
  it('bold wraps the selection with **', () => {
    expect(run('hello', 0, 5, 'bold')).toBe('**hello**')
  })
  it('code wraps the selection with backticks', () => {
    expect(run('x', 0, 1, 'code')).toBe('`x`')
  })
  it('divider inserts a horizontal rule on its own line', () => {
    expect(run('', 0, 0, 'divider')).toContain('---')
  })
  it('codeblock inserts a fenced block', () => {
    expect(run('', 0, 0, 'codeblock')).toContain('```')
  })
  it('link inserts a markdown link skeleton', () => {
    expect(run('text', 0, 4, 'link')).toBe('[text]()')
  })
})

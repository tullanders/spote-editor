import { describe, it, expect } from 'vitest'
import { EditorState, EditorSelection, type TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { MARK_SHORTCUTS, markKeymapBindings } from './markKeymap'

/** Runs a binding's command against `doc`/`selection` and returns the resulting doc + selection. */
function run(key: string, doc: string, selection: { anchor: number; head: number }) {
  const binding = markKeymapBindings.find((b) => b.key === key)
  if (!binding?.run) throw new Error(`no binding for ${key}`)
  let state = EditorState.create({ doc, selection: EditorSelection.range(selection.anchor, selection.head) })
  const view = {
    get state() { return state },
    dispatch: (spec: TransactionSpec) => { state = state.update(spec).state },
  } as unknown as EditorView
  const handled = binding.run(view)
  return { handled, doc: state.doc.toString(), sel: state.selection.main }
}

describe('markKeymap', () => {
  it('binds bold, italic and code to Mod shortcuts', () => {
    expect(MARK_SHORTCUTS).toEqual([
      { key: 'Mod-b', mark: 'strong' },
      { key: 'Mod-i', mark: 'emphasis' },
      { key: 'Mod-e', mark: 'inlineCode' },
    ])
    for (const b of markKeymapBindings) expect(b.preventDefault).toBe(true)
  })

  it('wraps the selection in ** for Mod-b', () => {
    const { handled, doc, sel } = run('Mod-b', 'hello world', { anchor: 0, head: 5 })
    expect(handled).toBe(true)
    expect(doc).toBe('**hello** world')
    expect([sel.from, sel.to]).toEqual([2, 7])
  })

  it('wraps the selection in * for Mod-i', () => {
    const { doc } = run('Mod-i', 'hello', { anchor: 0, head: 5 })
    expect(doc).toBe('*hello*')
  })

  it('unwraps an already-bold selection (toggle off)', () => {
    const { doc } = run('Mod-b', '**hello**', { anchor: 2, head: 7 })
    expect(doc).toBe('hello')
  })

  it('inserts an empty pair at the cursor when nothing is selected', () => {
    const { doc, sel } = run('Mod-b', 'ab', { anchor: 1, head: 1 })
    expect(doc).toBe('a****b')
    expect(sel.from).toBe(3) // cursor lands between the markers
  })
})

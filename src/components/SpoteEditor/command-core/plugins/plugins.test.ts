import { describe, it, expect } from 'vitest'
import { bold, italic, code, link, h1, bulletList, quote, codeBlock, divider, DEFAULT_PLUGINS } from './index'

const ui = { requestLink: async () => 'https://x' }

describe('built-in plugins', () => {
  it('bold/italic/code are bubble-only toggleMark', () => {
    expect(bold.slash).toBeUndefined()
    expect(bold.bubble!({ selectedText: 'a', ui })).toEqual({ kind: 'toggleMark', mark: 'strong' })
    expect(italic.bubble!({ selectedText: 'a', ui })).toEqual({ kind: 'toggleMark', mark: 'emphasis' })
    expect(code.bubble!({ selectedText: 'a', ui })).toEqual({ kind: 'toggleMark', mark: 'inlineCode' })
  })

  it('link (bubble) wraps selection with the requested href', async () => {
    expect(await link.bubble!({ selectedText: 'Spote', ui })).toEqual({ kind: 'replaceSelection', markdown: '[Spote](https://x)' })
  })

  it('link (bubble) cancels to null', async () => {
    const cancelUi = { requestLink: async () => null }
    expect(await link.bubble!({ selectedText: 'Spote', ui: cancelUi })).toBeNull()
  })

  it('headings/lists/quote/codeblock are slash setBlock; divider inserts', () => {
    expect(h1.bubble).toBeUndefined()
    expect(h1.slash!({ ui })).toEqual({ kind: 'setBlock', block: 'heading', attrs: { level: 1 } })
    expect(bulletList.slash!({ ui })).toEqual({ kind: 'setBlock', block: 'bulletList' })
    expect(quote.slash!({ ui })).toEqual({ kind: 'setBlock', block: 'blockquote' })
    expect(codeBlock.slash!({ ui })).toEqual({ kind: 'setBlock', block: 'codeBlock' })
    expect(divider.slash!({ ui })).toEqual({ kind: 'insert', markdown: '\n---\n' })
  })

  it('DEFAULT_PLUGINS has unique ids and the v1 set', () => {
    const ids = DEFAULT_PLUGINS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining(['bold','italic','code','link','h1','h2','h3','bulletList','orderedList','quote','codeBlock','divider']))
  })
})

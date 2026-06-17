import { describe, it, expect } from 'vitest'
import type { SpotePlugin, PluginAction } from './plugin.types'

describe('plugin.types', () => {
  it('a plugin with only bubble is valid and callable', async () => {
    const p: SpotePlugin = {
      id: 'x', label: 'X', icon: 'x',
      bubble: ({ selectedText }) => ({ kind: 'replaceSelection', markdown: `**${selectedText}**` }),
    }
    const action = await p.bubble!({ selectedText: 'hi', ui: { requestLink: async () => null, pickImage: async () => null } })
    expect(action).toEqual({ kind: 'replaceSelection', markdown: '**hi**' })
  })

  it('action union shape', () => {
    const a: PluginAction = { kind: 'toggleMark', mark: 'strong' }
    expect(a.kind).toBe('toggleMark')
  })
})

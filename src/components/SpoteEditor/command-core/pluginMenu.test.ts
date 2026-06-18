import { describe, it, expect } from 'vitest'
import { slashPlugins, bubblePlugins, filterByQuery, pluginById, withImageGate } from './pluginMenu'
import { DEFAULT_PLUGINS } from './plugins'

describe('pluginMenu', () => {
  it('slashPlugins excludes bubble-only marks', () => {
    expect(slashPlugins(DEFAULT_PLUGINS).map((p) => p.id)).not.toContain('bold')
    expect(slashPlugins(DEFAULT_PLUGINS).map((p) => p.id)).toContain('h1')
  })
  it('bubblePlugins includes marks + link', () => {
    expect(bubblePlugins(DEFAULT_PLUGINS).map((p) => p.id)).toEqual(expect.arrayContaining(['bold', 'italic', 'code', 'link']))
  })
  it('filterByQuery matches label case-insensitively', () => {
    expect(filterByQuery(slashPlugins(DEFAULT_PLUGINS), 'heading').map((p) => p.id)).toContain('h1')
    expect(filterByQuery(DEFAULT_PLUGINS, '').length).toBe(DEFAULT_PLUGINS.length)
  })
  it('pluginById', () => {
    expect(pluginById(DEFAULT_PLUGINS, 'link')?.label).toBe('Link')
  })
})

describe('withImageGate', () => {
  it('keeps the image plugin when upload is supported', () => {
    const ids = withImageGate(DEFAULT_PLUGINS, true).map((p) => p.id)
    expect(ids).toContain('image')
  })
  it('drops the image plugin when upload is not supported', () => {
    const ids = withImageGate(DEFAULT_PLUGINS, false).map((p) => p.id)
    expect(ids).not.toContain('image')
  })
  it('leaves other plugins untouched when gated off', () => {
    const before = DEFAULT_PLUGINS.filter((p) => p.id !== 'image').map((p) => p.id)
    expect(withImageGate(DEFAULT_PLUGINS, false).map((p) => p.id)).toEqual(before)
  })
})

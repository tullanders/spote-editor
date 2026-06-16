import { describe, it, expect } from 'vitest'
import { slashPlugins, bubblePlugins, filterByQuery, pluginById } from './pluginMenu'
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
    expect(filterByQuery(slashPlugins(DEFAULT_PLUGINS), 'rubrik').map((p) => p.id)).toContain('h1')
    expect(filterByQuery(DEFAULT_PLUGINS, '').length).toBe(DEFAULT_PLUGINS.length)
  })
  it('pluginById', () => {
    expect(pluginById(DEFAULT_PLUGINS, 'link')?.label).toBe('Länk')
  })
})

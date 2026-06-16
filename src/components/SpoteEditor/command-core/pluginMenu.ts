import type { SpotePlugin } from './plugin.types'

export const slashPlugins = (plugins: SpotePlugin[]) => plugins.filter((p) => p.slash)
export const bubblePlugins = (plugins: SpotePlugin[]) => plugins.filter((p) => p.bubble)
export const pluginById = (plugins: SpotePlugin[], id: string) => plugins.find((p) => p.id === id)

// Label-based search for the slash menu (icons are ReactNode; no keywords in v-next).
export function filterByQuery(plugins: SpotePlugin[], query: string): SpotePlugin[] {
  const q = query.trim().toLowerCase()
  if (!q) return plugins
  return plugins.filter((p) => p.label.toLowerCase().includes(q))
}

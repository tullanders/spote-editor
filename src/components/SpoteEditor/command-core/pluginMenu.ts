import type { SpotePlugin } from './plugin.types'

export const slashPlugins = (plugins: readonly SpotePlugin[]) => plugins.filter((p) => p.slash)
export const bubblePlugins = (plugins: readonly SpotePlugin[]) => plugins.filter((p) => p.bubble)
export const pluginById = (plugins: readonly SpotePlugin[], id: string) => plugins.find((p) => p.id === id)

// Label-based search for the slash menu (icons are ReactNode; no keywords in v-next).
export function filterByQuery(plugins: readonly SpotePlugin[], query: string): SpotePlugin[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...plugins]
  return plugins.filter((p) => p.label.toLowerCase().includes(q))
}

/** Drop the image plugin when the host provides no upload handler (image features off). */
export const withImageGate = (plugins: readonly SpotePlugin[], hasUpload: boolean): SpotePlugin[] =>
  hasUpload ? [...plugins] : plugins.filter((p) => p.id !== 'image')

import type { SpotePlugin } from '../plugin.types'

export const link: SpotePlugin = {
  id: 'link', label: 'Link', icon: '🔗',
  bubble: async ({ selectedText, ui }) => {
    const href = await ui.requestLink()
    return href ? { kind: 'replaceSelection', markdown: `[${selectedText || 'link'}](${href})` } : null
  },
  slash: async ({ ui }) => {
    const href = await ui.requestLink()
    return href ? { kind: 'insert', markdown: `[link](${href})` } : null
  },
}

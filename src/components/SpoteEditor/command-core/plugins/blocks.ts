import type { SpotePlugin } from '../plugin.types'

export const h1: SpotePlugin = { id: 'h1', label: 'Rubrik 1', icon: 'H1', slash: () => ({ kind: 'setBlock', block: 'heading', attrs: { level: 1 } }) }
export const h2: SpotePlugin = { id: 'h2', label: 'Rubrik 2', icon: 'H2', slash: () => ({ kind: 'setBlock', block: 'heading', attrs: { level: 2 } }) }
export const h3: SpotePlugin = { id: 'h3', label: 'Rubrik 3', icon: 'H3', slash: () => ({ kind: 'setBlock', block: 'heading', attrs: { level: 3 } }) }
export const bulletList: SpotePlugin = { id: 'bulletList', label: 'Punktlista', icon: '•', slash: () => ({ kind: 'setBlock', block: 'bulletList' }) }
export const orderedList: SpotePlugin = { id: 'orderedList', label: 'Numrerad lista', icon: '1.', slash: () => ({ kind: 'setBlock', block: 'orderedList' }) }
export const quote: SpotePlugin = { id: 'quote', label: 'Citat', icon: '❝', slash: () => ({ kind: 'setBlock', block: 'blockquote' }) }
export const codeBlock: SpotePlugin = { id: 'codeBlock', label: 'Kodblock', icon: '{}', slash: () => ({ kind: 'setBlock', block: 'codeBlock' }) }
export const divider: SpotePlugin = { id: 'divider', label: 'Avdelare', icon: '―', slash: () => ({ kind: 'insert', markdown: '\n---\n' }) }

import type { SpotePlugin } from '../plugin.types'

export const h1: SpotePlugin = { id: 'h1', label: 'Heading 1', icon: 'H1', slash: () => ({ kind: 'setBlock', block: 'heading', attrs: { level: 1 } }) }
export const h2: SpotePlugin = { id: 'h2', label: 'Heading 2', icon: 'H2', slash: () => ({ kind: 'setBlock', block: 'heading', attrs: { level: 2 } }) }
export const h3: SpotePlugin = { id: 'h3', label: 'Heading 3', icon: 'H3', slash: () => ({ kind: 'setBlock', block: 'heading', attrs: { level: 3 } }) }
export const bulletList: SpotePlugin = { id: 'bulletList', label: 'Bullet list', icon: '•', slash: () => ({ kind: 'setBlock', block: 'bulletList' }) }
export const orderedList: SpotePlugin = { id: 'orderedList', label: 'Numbered list', icon: '1.', slash: () => ({ kind: 'setBlock', block: 'orderedList' }) }
export const quote: SpotePlugin = { id: 'quote', label: 'Quote', icon: '❝', slash: () => ({ kind: 'setBlock', block: 'blockquote' }) }
export const codeBlock: SpotePlugin = { id: 'codeBlock', label: 'Code block', icon: '{}', slash: () => ({ kind: 'setBlock', block: 'codeBlock' }) }
export const divider: SpotePlugin = { id: 'divider', label: 'Divider', icon: '―', slash: () => ({ kind: 'insert', markdown: '\n---\n' }) }

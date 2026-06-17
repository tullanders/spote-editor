import type { SpotePlugin } from '../plugin.types'

export const bold: SpotePlugin = { id: 'bold', label: 'Bold', icon: 'B', bubble: () => ({ kind: 'toggleMark', mark: 'strong' }) }
export const italic: SpotePlugin = { id: 'italic', label: 'Italic', icon: 'I', bubble: () => ({ kind: 'toggleMark', mark: 'emphasis' }) }
export const code: SpotePlugin = { id: 'code', label: 'Code', icon: '<>', bubble: () => ({ kind: 'toggleMark', mark: 'inlineCode' }) }

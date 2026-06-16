import type { SpotePlugin } from '../plugin.types'

export const bold: SpotePlugin = { id: 'bold', label: 'Fet', icon: 'B', bubble: () => ({ kind: 'toggleMark', mark: 'strong' }) }
export const italic: SpotePlugin = { id: 'italic', label: 'Kursiv', icon: 'I', bubble: () => ({ kind: 'toggleMark', mark: 'emphasis' }) }
export const code: SpotePlugin = { id: 'code', label: 'Kod', icon: '<>', bubble: () => ({ kind: 'toggleMark', mark: 'inlineCode' }) }

export * from './marks'
export * from './link'
export * from './blocks'
export * from './image'
import { bold, italic, code } from './marks'
import { link } from './link'
import { h1, h2, h3, bulletList, orderedList, quote, codeBlock, divider } from './blocks'
import { image } from './image'
import type { SpotePlugin } from '../plugin.types'

export const DEFAULT_PLUGINS: SpotePlugin[] = [
  h1, h2, h3, bold, italic, code, codeBlock, bulletList, orderedList, quote, link, image, divider,
]

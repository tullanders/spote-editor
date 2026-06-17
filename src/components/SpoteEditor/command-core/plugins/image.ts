import type { SpotePlugin } from '../plugin.types'

export const image: SpotePlugin = {
  id: 'image', label: 'Image', icon: '🖼️',
  slash: async ({ ui }) => {
    const file = await ui.pickImage()
    return file ? { kind: 'uploadImage', file } : null
  },
}

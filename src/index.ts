import './styles/index.css'

export { SpoteEditor } from './components/SpoteEditor'
export type { SpoteEditorProps, NoteHit, EditorMode } from './components/SpoteEditor'
export { DEFAULT_PLUGINS, bold, italic, code, link, h1, h2, h3, bulletList, orderedList, quote, codeBlock, divider } from './components/SpoteEditor/command-core/plugins'
export type { SpotePlugin, PluginAction, BubbleContext, SlashContext, PluginUI } from './components/SpoteEditor/command-core/plugin.types'

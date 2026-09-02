import { Plugin, PluginKey } from '@milkdown/prose/state'
import { CodeBlockNodeView } from './mermaidNodeView'
import type { MermaidTheme } from './mermaidRenderer'

export const mermaidPluginKey = new PluginKey<{ theme: MermaidTheme }>('spote-mermaid')

/** Transaction meta key used to push a new theme into the plugin's state. */
export const SET_MERMAID_THEME = 'spote-mermaid-set-theme'

export interface MermaidPluginOptions {
  initialTheme: MermaidTheme
  onZoom: (svg: string) => void
}

/**
 * Registers the code-block node view and holds the diagram theme.
 *
 * The theme lives in plugin state rather than a closure so a theme change is an
 * ordinary transaction — see Task 5 / `MilkdownEditor`.
 */
export function createMermaidPlugin(options: MermaidPluginOptions): Plugin<{ theme: MermaidTheme }> {
  let currentTheme = options.initialTheme
  return new Plugin<{ theme: MermaidTheme }>({
    key: mermaidPluginKey,
    state: {
      init: () => ({ theme: options.initialTheme }),
      apply: (tr, value) => {
        const next = tr.getMeta(SET_MERMAID_THEME) as MermaidTheme | undefined
        if (!next) return value
        currentTheme = next
        return { theme: next }
      },
    },
    props: {
      nodeViews: {
        code_block: (node, view, getPos) =>
          new CodeBlockNodeView(node, view, getPos, {
            getTheme: () => currentTheme,
            onZoom: options.onZoom,
          }),
      },
    },
  })
}

import type { ReactNode } from 'react'

export type PluginAction =
  | { kind: 'replaceSelection'; markdown: string }
  | { kind: 'insert'; markdown: string }
  | { kind: 'toggleMark'; mark: 'strong' | 'emphasis' | 'inlineCode' }
  | { kind: 'setBlock'; block: 'heading' | 'bulletList' | 'orderedList' | 'blockquote' | 'codeBlock'; attrs?: { level?: number } }

export interface PluginUI {
  /** Opens the link popover; resolves to an href, or null if cancelled. */
  requestLink: () => Promise<string | null>
}

export interface BubbleContext {
  selectedText: string
  ui: PluginUI
}

export interface SlashContext {
  ui: PluginUI
}

export type ActionResult = PluginAction | null

export type BubbleHandler = (ctx: BubbleContext) => ActionResult | Promise<ActionResult>
export type SlashHandler = (ctx: SlashContext) => ActionResult | Promise<ActionResult>

interface PluginBase {
  id: string
  label: string
  icon: ReactNode
}

// At least one surface handler required (a plugin with neither is a compile error).
export type SpotePlugin = PluginBase &
  ( { bubble: BubbleHandler; slash?: SlashHandler }
  | { bubble?: BubbleHandler; slash: SlashHandler } )

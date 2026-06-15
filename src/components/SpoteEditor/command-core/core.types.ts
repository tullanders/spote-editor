export type CommandGroup = 'heading' | 'inline' | 'block' | 'list'

export interface Command {
  id: string
  label: string
  icon: string          // short glyph/text, kept simple for v1
  group: CommandGroup
  keywords: string[]
}

// Selection-bubble actions are a fixed, small set in v1.
export type BubbleAction = 'bold' | 'italic' | 'code' | 'link'

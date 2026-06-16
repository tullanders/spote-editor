export type CommandGroup = 'heading' | 'inline' | 'block' | 'list'

export interface Command {
  id: string
  label: string
  icon: string          // short glyph/text, kept simple for v1
  group: CommandGroup
  keywords: string[]
}


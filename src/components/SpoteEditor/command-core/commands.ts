import type { Command } from './core.types'

export const DEFAULT_COMMANDS = [
  { id: 'h1', label: 'Rubrik 1', icon: 'H1', group: 'heading', keywords: ['heading', 'rubrik', 'titel'] },
  { id: 'h2', label: 'Rubrik 2', icon: 'H2', group: 'heading', keywords: ['heading', 'rubrik'] },
  { id: 'h3', label: 'Rubrik 3', icon: 'H3', group: 'heading', keywords: ['heading', 'rubrik'] },
  { id: 'bold', label: 'Fet', icon: 'B', group: 'inline', keywords: ['bold', 'fet', 'stark'] },
  { id: 'italic', label: 'Kursiv', icon: 'I', group: 'inline', keywords: ['italic', 'kursiv'] },
  { id: 'code', label: 'Kod', icon: '<>', group: 'inline', keywords: ['code', 'kod', 'inline'] },
  { id: 'codeblock', label: 'Kodblock', icon: '{}', group: 'block', keywords: ['code', 'kod', 'block', 'pre'] },
  { id: 'bullet-list', label: 'Punktlista', icon: '•', group: 'list', keywords: ['list', 'lista', 'punkt', 'bullet'] },
  { id: 'ordered-list', label: 'Numrerad lista', icon: '1.', group: 'list', keywords: ['list', 'lista', 'numrerad', 'ordered'] },
  { id: 'quote', label: 'Citat', icon: '❝', group: 'block', keywords: ['quote', 'citat', 'blockquote'] },
  { id: 'link', label: 'Länk', icon: '🔗', group: 'inline', keywords: ['link', 'länk', 'url'] },
  { id: 'divider', label: 'Avdelare', icon: '―', group: 'block', keywords: ['divider', 'avdelare', 'hr', 'rule'] },
] as const satisfies readonly Command[]

// Derive the command-id union from the default list so adapters can be type-checked
// against the exact same key set.
export type CommandId = (typeof DEFAULT_COMMANDS)[number]['id']

export function commandById(id: string, commands: readonly Command[] = DEFAULT_COMMANDS): Command | undefined {
  return commands.find((c) => c.id === id)
}

export function filterCommands(query: string, commands: readonly Command[] = DEFAULT_COMMANDS): Command[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...commands]
  return commands.filter(
    (c) => c.label.toLowerCase().includes(q) || c.keywords.some((k) => k.toLowerCase().includes(q)),
  )
}

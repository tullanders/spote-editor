import { describe, it, expect } from 'vitest'
import { DEFAULT_COMMANDS, commandById, filterCommands } from './commands'

describe('DEFAULT_COMMANDS', () => {
  it('has unique ids', () => {
    const ids = DEFAULT_COMMANDS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('includes the v1 baseline commands', () => {
    const ids = DEFAULT_COMMANDS.map((c) => c.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'h1', 'h2', 'h3', 'bold', 'italic', 'code', 'codeblock',
        'bullet-list', 'ordered-list', 'quote', 'link', 'divider',
      ]),
    )
  })

  it('looks up by id', () => {
    expect(commandById('h1')?.label).toBeTruthy()
    expect(commandById('nope')).toBeUndefined()
  })
})

describe('filterCommands', () => {
  it('returns all on empty query', () => {
    expect(filterCommands('').length).toBe(DEFAULT_COMMANDS.length)
  })
  it('matches label and keywords case-insensitively', () => {
    expect(filterCommands('FET').map((c) => c.id)).toContain('bold')
    expect(filterCommands('lista').map((c) => c.id)).toEqual(
      expect.arrayContaining(['bullet-list', 'ordered-list']),
    )
  })
})

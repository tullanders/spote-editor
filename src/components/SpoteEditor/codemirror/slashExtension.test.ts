import { describe, it, expect } from 'vitest'
import { shouldTriggerSlash } from './slashExtension'

describe('shouldTriggerSlash', () => {
  it('triggers at line start', () => {
    expect(shouldTriggerSlash('/', '')).toBe(true)
  })
  it('triggers after whitespace', () => {
    expect(shouldTriggerSlash('/', 'hello ')).toBe(true)
  })
  it('does not trigger mid-word', () => {
    expect(shouldTriggerSlash('/', 'http:/')).toBe(false)
  })
  it('does not trigger for non-slash input', () => {
    expect(shouldTriggerSlash('a', '')).toBe(false)
  })
})

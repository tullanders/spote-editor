import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useResolvedTheme } from './useResolvedTheme'

interface FakeQuery {
  matches: boolean
  addEventListener: (type: string, fn: () => void) => void
  removeEventListener: (type: string, fn: () => void) => void
}

function stubMatchMedia(matches: boolean) {
  const listeners: Array<() => void> = []
  const query: FakeQuery = {
    matches,
    addEventListener: (_t, fn) => { listeners.push(fn) },
    removeEventListener: () => {},
  }
  // jsdom has no matchMedia at all, so this both stubs and creates it.
  ;(window as unknown as { matchMedia: unknown }).matchMedia = () => query
  return {
    flipTo(next: boolean) { query.matches = next; listeners.forEach((fn) => fn()) },
  }
}

afterEach(() => {
  delete (window as unknown as { matchMedia?: unknown }).matchMedia
  vi.restoreAllMocks()
})

describe('useResolvedTheme', () => {
  it('returns an explicit preference unchanged', () => {
    stubMatchMedia(true)
    expect(renderHook(() => useResolvedTheme('light')).result.current).toBe('light')
    expect(renderHook(() => useResolvedTheme('dark')).result.current).toBe('dark')
  })

  it('follows the system preference when auto', () => {
    stubMatchMedia(true)
    expect(renderHook(() => useResolvedTheme('auto')).result.current).toBe('dark')
  })

  it('defaults to auto', () => {
    stubMatchMedia(true)
    expect(renderHook(() => useResolvedTheme()).result.current).toBe('dark')
  })

  it('updates when the system preference changes', () => {
    const mq = stubMatchMedia(false)
    const { result } = renderHook(() => useResolvedTheme('auto'))
    expect(result.current).toBe('light')
    act(() => { mq.flipTo(true) })
    expect(result.current).toBe('dark')
  })

  it('falls back to light when matchMedia is unavailable', () => {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia
    expect(renderHook(() => useResolvedTheme('auto')).result.current).toBe('light')
  })
})

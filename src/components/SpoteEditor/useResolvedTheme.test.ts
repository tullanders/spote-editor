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
    // Splice out the exact function reference, the way a real EventTarget would —
    // so a cleanup that removes a *different* function than the one it added
    // still leaves a stale listener behind and fails `listenerCount()`.
    removeEventListener: (_t, fn) => {
      const i = listeners.indexOf(fn)
      if (i !== -1) listeners.splice(i, 1)
    },
  }
  // jsdom has no matchMedia at all, so this both stubs and creates it.
  ;(window as unknown as { matchMedia: unknown }).matchMedia = () => query
  return {
    flipTo(next: boolean) { query.matches = next; listeners.forEach((fn) => fn()) },
    listenerCount() { return listeners.length },
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

  it('removes the media-query listener on unmount', () => {
    const mq = stubMatchMedia(false)
    const { unmount } = renderHook(() => useResolvedTheme('auto'))
    expect(mq.listenerCount()).toBe(1)
    unmount()
    expect(mq.listenerCount()).toBe(0)
  })

  it('removes the media-query listener when the preference moves away from auto', () => {
    const mq = stubMatchMedia(false)
    const { rerender } = renderHook(({ preference }) => useResolvedTheme(preference), {
      initialProps: { preference: 'auto' as const },
    })
    expect(mq.listenerCount()).toBe(1)
    rerender({ preference: 'dark' })
    expect(mq.listenerCount()).toBe(0)
  })
})

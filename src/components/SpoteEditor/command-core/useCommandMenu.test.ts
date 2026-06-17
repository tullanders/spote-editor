import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCommandMenu } from './useCommandMenu'
import { DEFAULT_PLUGINS } from './plugins'

describe('useCommandMenu', () => {
  it('starts closed', () => {
    const { result } = renderHook(() => useCommandMenu(DEFAULT_PLUGINS))
    expect(result.current.open).toBe(false)
  })

  it('opens at a position and resets index/query', () => {
    const { result } = renderHook(() => useCommandMenu(DEFAULT_PLUGINS))
    act(() => result.current.openAt({ x: 10, y: 20 }))
    expect(result.current.open).toBe(true)
    expect(result.current.position).toEqual({ x: 10, y: 20 })
    expect(result.current.activeIndex).toBe(0)
    expect(result.current.query).toBe('')
  })

  it('filters results by query', () => {
    const { result } = renderHook(() => useCommandMenu(DEFAULT_PLUGINS))
    act(() => result.current.openAt({ x: 0, y: 0 }))
    act(() => result.current.setQuery('heading'))
    expect(result.current.results.map((c) => c.id)).toContain('h1')
  })

  it('clamps active index to results length when navigating', () => {
    const { result } = renderHook(() => useCommandMenu(DEFAULT_PLUGINS))
    act(() => result.current.openAt({ x: 0, y: 0 }))
    act(() => result.current.move(-1)) // up from 0 stays at 0
    expect(result.current.activeIndex).toBe(0)
    act(() => result.current.move(1))
    expect(result.current.activeIndex).toBe(1)
  })

  it('close resets open flag', () => {
    const { result } = renderHook(() => useCommandMenu(DEFAULT_PLUGINS))
    act(() => result.current.openAt({ x: 0, y: 0 }))
    act(() => result.current.close())
    expect(result.current.open).toBe(false)
  })
})

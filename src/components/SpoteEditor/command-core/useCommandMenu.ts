import { useMemo, useState, useCallback } from 'react'
import type { SpotePlugin } from './plugin.types'
import { filterByQuery } from './pluginMenu'

export interface MenuPosition { x: number; y: number }

export function useCommandMenu(commands: readonly SpotePlugin[]) {
  const [open, setOpen] = useState(false)
  const [query, setQueryState] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 })

  const results = useMemo(() => filterByQuery(commands, query), [query, commands])

  const openAt = useCallback((pos: MenuPosition) => {
    setPosition(pos)
    setQueryState('')
    setActiveIndex(0)
    setOpen(true)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  const setQuery = useCallback((q: string) => {
    setQueryState(q)
    setActiveIndex(0)
  }, [])

  const move = useCallback(
    (delta: number) => {
      setActiveIndex((i) => {
        const max = Math.max(filterByQuery(commands, query).length - 1, 0)
        return Math.min(Math.max(i + delta, 0), max)
      })
    },
    [query, commands],
  )

  return { open, query, activeIndex, position, results, openAt, close, setQuery, move, setActiveIndex }
}

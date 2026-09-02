import { useEffect, useState } from 'react'
import type { MermaidTheme } from './milkdown/mermaidRenderer'

export type ThemePreference = 'light' | 'dark' | 'auto'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * Guarded everywhere: jsdom has no `matchMedia`, and the library must survive
 * server rendering where there is no `window` at all.
 */
function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.(DARK_QUERY).matches === true
}

/** Resolves the public `theme` prop to the concrete theme diagrams render with. */
export function useResolvedTheme(preference: ThemePreference = 'auto'): MermaidTheme {
  const [system, setSystem] = useState<MermaidTheme>(() => (systemPrefersDark() ? 'dark' : 'light'))

  useEffect(() => {
    if (preference !== 'auto') return
    if (typeof window === 'undefined') return
    const query = window.matchMedia?.(DARK_QUERY)
    if (!query) return
    const onChange = () => setSystem(query.matches ? 'dark' : 'light')
    onChange()
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [preference])

  return preference === 'auto' ? system : preference
}

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { SpotePlugin } from './plugin.types'
import type { MenuPosition } from './useCommandMenu'

export interface CommandMenuProps {
  results: readonly SpotePlugin[]
  activeIndex: number
  position: MenuPosition
  onSelect: (commandId: string) => void
  onClose: () => void
  onMove: (delta: number) => void
}

export function CommandMenu({ results, activeIndex, position, onSelect, onClose, onMove }: CommandMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); onMove(1) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); onMove(-1) }
      else if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = results[activeIndex]
        if (cmd) onSelect(cmd.id)
      } else if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [results, activeIndex, onSelect, onClose, onMove])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className="spote-command-menu"
      role="listbox"
      style={{ position: 'fixed', left: position.x, top: position.y }}
    >
      {results.map((cmd, i) => (
        <button
          key={cmd.id}
          type="button"
          role="option"
          aria-selected={i === activeIndex}
          className={'spote-command-menu__item' + (i === activeIndex ? ' is-active' : '')}
          onMouseDown={(e) => { e.preventDefault(); onSelect(cmd.id) }}
        >
          <span className="spote-command-menu__icon">{cmd.icon}</span>
          <span className="spote-command-menu__label">{cmd.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  )
}

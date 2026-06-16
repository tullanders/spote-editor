import { createPortal } from 'react-dom'
import type { SpotePlugin } from './plugin.types'
import type { MenuPosition } from './useCommandMenu'

export interface SelectionBubbleProps {
  plugins: SpotePlugin[]
  position: MenuPosition
  onSelect: (id: string) => void
}

export function SelectionBubble({ plugins, position, onSelect }: SelectionBubbleProps) {
  return createPortal(
    <div className="spote-bubble" style={{ position: 'fixed', left: position.x, top: position.y }}>
      {plugins.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-label={p.label}
          className="spote-bubble__btn"
          onMouseDown={(e) => { e.preventDefault(); onSelect(p.id) }}
        >
          {p.icon}
        </button>
      ))}
    </div>,
    document.body,
  )
}

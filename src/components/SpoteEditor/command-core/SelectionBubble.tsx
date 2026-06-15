import { createPortal } from 'react-dom'
import type { BubbleAction } from './core.types'
import type { MenuPosition } from './useCommandMenu'

export interface SelectionBubbleProps {
  position: MenuPosition
  onAction: (action: BubbleAction) => void
}

const ACTIONS: { action: BubbleAction; label: string; icon: string }[] = [
  { action: 'bold', label: 'Fet', icon: 'B' },
  { action: 'italic', label: 'Kursiv', icon: 'I' },
  { action: 'code', label: 'Kod', icon: '<>' },
  { action: 'link', label: 'Skapa länk', icon: '🔗' },
]

export function SelectionBubble({ position, onAction }: SelectionBubbleProps) {
  return createPortal(
    <div className="spote-bubble" style={{ position: 'fixed', left: position.x, top: position.y }}>
      {ACTIONS.map(({ action, label, icon }) => (
        <button
          key={action}
          type="button"
          aria-label={label}
          className="spote-bubble__btn"
          onMouseDown={(e) => { e.preventDefault(); onAction(action) }}
        >
          {icon}
        </button>
      ))}
    </div>,
    document.body,
  )
}

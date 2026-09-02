import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface MermaidOverlayProps {
  svg: string
  onClose: () => void
}

/**
 * Full-screen view of a rendered diagram, for diagrams too wide for the column.
 *
 * The SVG is injected as HTML. That is safe here because it comes from
 * `renderMermaid`, which always runs mermaid with `securityLevel: 'strict'` —
 * the same string is already in the editor DOM.
 */
export function MermaidOverlay({ svg, onClose }: MermaidOverlayProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { closeRef.current?.focus() }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div
      className="spote-mermaid-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Diagram"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <button
        ref={closeRef}
        type="button"
        className="spote-mermaid-overlay__close"
        aria-label="Close diagram"
        onClick={onClose}
      >
        ×
      </button>
      <div className="spote-mermaid-overlay__figure" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>,
    document.body,
  )
}

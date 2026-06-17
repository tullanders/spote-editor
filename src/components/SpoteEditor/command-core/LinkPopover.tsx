import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { NoteHit } from '../SpoteEditor.types'
import type { MenuPosition } from './useCommandMenu'

export interface LinkPopoverProps {
  position: MenuPosition
  onSubmitHref: (href: string) => void
  onCancel: () => void
  onSearchNotes?: (query: string) => Promise<NoteHit[]>
  onResolveNoteHref?: (note: NoteHit) => string
}

function looksLikeUrl(text: string): boolean {
  return /^(https?:\/\/|mailto:|\/)/i.test(text.trim()) || /^[\w-]+\.[\w.-]+/.test(text.trim())
}

export function LinkPopover({ position, onSubmitHref, onCancel, onSearchNotes, onResolveNoteHref }: LinkPopoverProps) {
  const [value, setValue] = useState('')
  const [hits, setHits] = useState<NoteHit[]>([])

  useEffect(() => {
    const text = value.trim()
    if (!onSearchNotes || !text || looksLikeUrl(text)) { setHits([]); return }
    let cancelled = false
    onSearchNotes(text).then((res) => { if (!cancelled) setHits(res) })
    return () => { cancelled = true }
  }, [value, onSearchNotes])

  function submitHit(hit: NoteHit) {
    const href = onResolveNoteHref ? onResolveNoteHref(hit) : hit.id
    onSubmitHref(href)
  }

  return createPortal(
    <div className="spote-link-popover" style={{ position: 'fixed', left: position.x, top: position.y }}>
      <input
        autoFocus
        type="text"
        className="spote-link-popover__input"
        placeholder="Paste URL or search notes…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); if (value.trim()) onSubmitHref(value.trim()) }
          else if (e.key === 'Escape') { e.preventDefault(); onCancel() }
        }}
      />
      {hits.length > 0 && (
        <ul className="spote-link-popover__hits">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); submitHit(hit) }}>
                {hit.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body,
  )
}

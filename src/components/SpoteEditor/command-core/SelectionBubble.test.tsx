import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SelectionBubble } from './SelectionBubble'

describe('SelectionBubble', () => {
  it('renders the four actions', () => {
    render(<SelectionBubble position={{ x: 0, y: 0 }} onAction={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Fet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kursiv' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kod' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skapa länk' })).toBeInTheDocument()
  })

  it('emits the action on click', async () => {
    const onAction = vi.fn()
    render(<SelectionBubble position={{ x: 0, y: 0 }} onAction={onAction} />)
    await userEvent.click(screen.getByRole('button', { name: 'Fet' }))
    expect(onAction).toHaveBeenCalledWith('bold')
    await userEvent.click(screen.getByRole('button', { name: 'Skapa länk' }))
    expect(onAction).toHaveBeenCalledWith('link')
  })
})

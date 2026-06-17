import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LinkPopover } from './LinkPopover'

describe('LinkPopover', () => {
  it('submits a URL on Enter', async () => {
    const onSubmit = vi.fn()
    render(<LinkPopover position={{ x: 0, y: 0 }} onSubmitHref={onSubmit} onCancel={vi.fn()} />)
    await userEvent.type(screen.getByRole('textbox'), 'https://spote.cloud{Enter}')
    expect(onSubmit).toHaveBeenCalledWith('https://spote.cloud')
  })

  it('searches notes for non-URL text and resolves a hit', async () => {
    const onSubmit = vi.fn()
    const onSearchNotes = vi.fn().mockResolvedValue([{ id: 'n1', title: 'Project plan' }])
    const onResolveNoteHref = vi.fn().mockReturnValue('spote://n1')
    render(
      <LinkPopover
        position={{ x: 0, y: 0 }}
        onSubmitHref={onSubmit}
        onCancel={vi.fn()}
        onSearchNotes={onSearchNotes}
        onResolveNoteHref={onResolveNoteHref}
      />,
    )
    await userEvent.type(screen.getByRole('textbox'), 'project')
    await waitFor(() => expect(screen.getByText('Project plan')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Project plan'))
    expect(onResolveNoteHref).toHaveBeenCalledWith({ id: 'n1', title: 'Project plan' })
    expect(onSubmit).toHaveBeenCalledWith('spote://n1')
  })

  it('Escape cancels', async () => {
    const onCancel = vi.fn()
    render(<LinkPopover position={{ x: 0, y: 0 }} onSubmitHref={vi.fn()} onCancel={onCancel} />)
    await userEvent.type(screen.getByRole('textbox'), '{Escape}')
    expect(onCancel).toHaveBeenCalled()
  })
})

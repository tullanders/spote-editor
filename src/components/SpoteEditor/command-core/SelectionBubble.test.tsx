import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SelectionBubble } from './SelectionBubble'
import { bubblePlugins } from './pluginMenu'
import { DEFAULT_PLUGINS } from './plugins'

describe('SelectionBubble', () => {
  it('renders one button per bubble plugin and emits id on click', async () => {
    const onSelect = vi.fn()
    render(
      <SelectionBubble
        plugins={bubblePlugins(DEFAULT_PLUGINS)}
        position={{ x: 0, y: 0 }}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Italic' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Code' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Link' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Bold' }))
    expect(onSelect).toHaveBeenCalledWith('bold')
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    render(
      <SelectionBubble
        plugins={bubblePlugins(DEFAULT_PLUGINS)}
        position={{ x: 0, y: 0 }}
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('stops listening for Escape once unmounted', async () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <SelectionBubble
        plugins={bubblePlugins(DEFAULT_PLUGINS)}
        position={{ x: 0, y: 0 }}
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    )
    unmount()
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })
})

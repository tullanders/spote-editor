import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SelectionBubble } from './SelectionBubble'
import { bubblePlugins } from './pluginMenu'
import { DEFAULT_PLUGINS } from './plugins'

describe('SelectionBubble', () => {
  it('renders one button per bubble plugin and emits id on click', async () => {
    const onSelect = vi.fn()
    render(<SelectionBubble plugins={bubblePlugins(DEFAULT_PLUGINS)} position={{ x: 0, y: 0 }} onSelect={onSelect} />)
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Italic' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Code' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Link' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Bold' }))
    expect(onSelect).toHaveBeenCalledWith('bold')
  })
})

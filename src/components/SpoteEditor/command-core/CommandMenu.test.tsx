import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommandMenu } from './CommandMenu'
import { slashPlugins } from './pluginMenu'
import { DEFAULT_PLUGINS } from './plugins'

const results = slashPlugins(DEFAULT_PLUGINS)

function setup(overrides = {}) {
  const onSelect = vi.fn()
  const onClose = vi.fn()
  render(
    <CommandMenu results={results} activeIndex={0} position={{ x: 0, y: 0 }}
      onSelect={onSelect} onClose={onClose} onMove={vi.fn()} {...overrides} />,
  )
  return { onSelect, onClose }
}

describe('CommandMenu', () => {
  it('renders slash plugin labels', () => {
    setup()
    expect(screen.getByText('Rubrik 1')).toBeInTheDocument()
    expect(screen.getByText('Citat')).toBeInTheDocument()
  })
  it('Enter selects the active plugin id', async () => {
    const { onSelect } = setup({ activeIndex: 0 })
    await userEvent.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith(results[0].id)
  })
  it('Escape closes', async () => {
    const { onClose } = setup()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
  it('clicking an item selects its id', async () => {
    const { onSelect } = setup()
    await userEvent.click(screen.getByText('Citat'))
    expect(onSelect).toHaveBeenCalledWith('quote')
  })
})

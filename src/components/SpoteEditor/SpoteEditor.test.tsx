import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpoteEditor } from './SpoteEditor'
import type { SpotePlugin } from './command-core/plugin.types'

const captured: { plugins?: SpotePlugin[] } = {}
vi.mock('./codemirror/CodeMirrorEditor', () => ({
  CodeMirrorEditor: ({ value, plugins }: any) => { captured.plugins = plugins; return <div data-testid="raw">{value}</div> },
}))
vi.mock('./milkdown/MilkdownEditor', () => ({
  MilkdownEditor: ({ value, plugins }: any) => { captured.plugins = plugins; return <div data-testid="wysiwyg">{value}</div> },
}))

describe('SpoteEditor shell', () => {
  it('renders WYSIWYG by default and shows the value', () => {
    render(<SpoteEditor value="# hi" onChange={vi.fn()} />)
    expect(screen.getByTestId('wysiwyg')).toHaveTextContent('# hi')
  })

  it('toggles to raw mode with the built-in button', async () => {
    render(<SpoteEditor value="# hi" onChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /raw|markdown/i }))
    expect(screen.getByTestId('raw')).toBeInTheDocument()
  })

  it('respects controlled mode and calls onModeChange', async () => {
    const onModeChange = vi.fn()
    render(<SpoteEditor value="x" onChange={vi.fn()} mode="raw" onModeChange={onModeChange} />)
    expect(screen.getByTestId('raw')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /wysiwyg|formaterad/i }))
    expect(onModeChange).toHaveBeenCalledWith('wysiwyg')
  })

  it('passes a custom plugins list to the engine', () => {
    const mine: SpotePlugin = { id: 'mine', label: 'Mine', icon: 'M', slash: () => ({ kind: 'insert', markdown: 'x' }) }
    render(<SpoteEditor value="x" onChange={vi.fn()} plugins={[mine]} />)
    expect(captured.plugins?.map((p) => p.id)).toEqual(['mine'])
  })
})

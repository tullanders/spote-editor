import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpoteEditor } from './SpoteEditor'

// Stub both engines so the shell test does not depend on CM/Milkdown internals.
vi.mock('./codemirror/CodeMirrorEditor', () => ({
  CodeMirrorEditor: ({ value }: { value: string }) => <div data-testid="raw">{value}</div>,
}))
vi.mock('./milkdown/MilkdownEditor', () => ({
  MilkdownEditor: ({ value }: { value: string }) => <div data-testid="wysiwyg">{value}</div>,
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

  it('respects a controlled mode prop and calls onModeChange', async () => {
    const onModeChange = vi.fn()
    render(<SpoteEditor value="x" onChange={vi.fn()} mode="raw" onModeChange={onModeChange} />)
    expect(screen.getByTestId('raw')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /wysiwyg|formaterad/i }))
    expect(onModeChange).toHaveBeenCalledWith('wysiwyg')
  })
})

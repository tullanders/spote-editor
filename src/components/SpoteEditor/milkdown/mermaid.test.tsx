import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MilkdownEditor } from './MilkdownEditor'

const h = vi.hoisted(() => ({
  mermaid: {
    initialize: vi.fn(),
    render: vi.fn(),
    parse: vi.fn(),
  },
}))

vi.mock('mermaid', () => ({ default: h.mermaid }))

const DIAGRAM = '```mermaid\ngraph TD\n  A --> B\n```'

function renderEditor(value: string, props: Record<string, unknown> = {}) {
  return render(
    <MilkdownEditor
      value={value}
      onChange={vi.fn()}
      plugins={[]}
      requestLink={async () => null}
      pickImage={async () => null}
      {...props}
    />,
  )
}

describe('mermaid node view', () => {
  beforeEach(() => {
    h.mermaid.initialize.mockReset()
    h.mermaid.render.mockReset().mockResolvedValue({ svg: '<svg data-testid="diagram"></svg>' })
    h.mermaid.parse.mockReset().mockResolvedValue(true)
  })

  it('renders a mermaid block as a diagram', async () => {
    const { container } = renderEditor(DIAGRAM)
    await waitFor(() => {
      expect(container.querySelector('.spote-mermaid__figure svg')).not.toBeNull()
    })
  })

  it('passes the block source to mermaid', async () => {
    renderEditor(DIAGRAM)
    await waitFor(() => {
      expect(h.mermaid.render).toHaveBeenCalledWith(expect.any(String), 'graph TD\n  A --> B')
    })
  })

  it('leaves a non-mermaid code block as a plain pre/code', async () => {
    const { container } = renderEditor('```js\nconst a = 1\n```')
    await waitFor(() => {
      expect(container.querySelector('pre[data-language="js"] > code')).not.toBeNull()
    })
    expect(container.querySelector('.spote-mermaid')).toBeNull()
    expect(h.mermaid.render).not.toHaveBeenCalled()
  })

  it('leaves a code block with no language as a plain pre/code', async () => {
    const { container } = renderEditor('```\nplain\n```')
    await waitFor(() => { expect(container.querySelector('pre > code')).not.toBeNull() })
    expect(container.querySelector('pre')?.hasAttribute('data-language')).toBe(false)
  })

  it('shows the error message when the diagram is invalid', async () => {
    h.mermaid.render.mockRejectedValue(new Error('Parse error on line 2'))
    const { container } = renderEditor('```mermaid\n???\n```')
    await waitFor(() => {
      const figure = container.querySelector('.spote-mermaid__figure')
      expect(figure?.textContent).toContain('Parse error on line 2')
      expect(figure?.classList.contains('is-error')).toBe(true)
    })
  })

  it('does not load mermaid for a document without diagrams', async () => {
    const { container } = renderEditor('# just a heading')
    await waitFor(() => { expect(container.querySelector('h1')).not.toBeNull() })
    expect(h.mermaid.render).not.toHaveBeenCalled()
  })
})

describe('mermaid edit mode', () => {
  beforeEach(() => {
    h.mermaid.initialize.mockReset()
    h.mermaid.render.mockReset().mockResolvedValue({ svg: '<svg></svg>' })
    h.mermaid.parse.mockReset().mockResolvedValue(true)
  })

  const block = (container: HTMLElement) => container.querySelector<HTMLElement>('.spote-mermaid')

  it('starts in preview state', async () => {
    const { container } = renderEditor(DIAGRAM)
    await waitFor(() => { expect(block(container)).not.toBeNull() })
    expect(block(container)?.dataset.state).toBe('preview')
  })

  it('switches to edit state when the preview is clicked', async () => {
    const { container } = renderEditor(DIAGRAM)
    await waitFor(() => { expect(block(container)).not.toBeNull() })
    const preview = container.querySelector<HTMLElement>('.spote-mermaid__preview')!
    preview.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    await waitFor(() => { expect(block(container)?.dataset.state).toBe('edit') })
  })

  it('stays in preview when read-only', async () => {
    const { container } = renderEditor(DIAGRAM, { readOnly: true })
    await waitFor(() => { expect(block(container)).not.toBeNull() })
    const preview = container.querySelector<HTMLElement>('.spote-mermaid__preview')!
    preview.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    await new Promise((r) => setTimeout(r, 20))
    expect(block(container)?.dataset.state).toBe('preview')
  })

  it('shows a syntax status line while editing', async () => {
    h.mermaid.parse.mockRejectedValue(new Error('Expecting NODE_STRING'))
    const { container } = renderEditor(DIAGRAM)
    await waitFor(() => { expect(block(container)).not.toBeNull() })
    container.querySelector<HTMLElement>('.spote-mermaid__preview')!
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    await waitFor(() => {
      expect(container.querySelector('.spote-mermaid__status')?.textContent)
        .toContain('Expecting NODE_STRING')
    }, { timeout: 2000 })
  })

  it('keeps the source in the document verbatim', async () => {
    const { container } = renderEditor(DIAGRAM)
    await waitFor(() => { expect(block(container)).not.toBeNull() })
    expect(container.querySelector('.spote-mermaid > pre > code')?.textContent)
      .toBe('graph TD\n  A --> B')
  })

  it('serializes back to a plain mermaid fence after an edit', async () => {
    // The round-trip guarantee: the node view is a rendering layer only, so an edit
    // inside the block serializes as an ordinary fenced code block.
    const onChange = vi.fn()
    const { container } = renderEditor(DIAGRAM, { onChange })
    await waitFor(() => { expect(block(container)).not.toBeNull() })
    container.querySelector<HTMLElement>('.spote-mermaid__preview')!
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    await waitFor(() => { expect(block(container)?.dataset.state).toBe('edit') })
    await userEvent.type(container.querySelector('.spote-mermaid > pre > code')!, ' --> C')
    // Milkdown's listener debounces serialization by 200ms, so onChange lags.
    await waitFor(() => {
      const md = onChange.mock.calls.at(-1)?.[0] as string | undefined
      expect(md).toContain('```mermaid')
      expect(md).toContain('graph TD')
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
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

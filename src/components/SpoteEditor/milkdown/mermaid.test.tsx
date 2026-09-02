import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TextSelection } from '@milkdown/prose/state'
import type { EditorView } from '@milkdown/prose/view'
import { MilkdownEditor } from './MilkdownEditor'
import { MermaidOverlay } from './MermaidOverlay'
import { isMermaidBlock } from './mermaidNodeView'

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

  it('does not open the block just because autoFocus focused the editor', async () => {
    // Regression: `autoFocus` calls `view.focus()` right after setup, while
    // ProseMirror's own default selection (`Selection.atStart(doc)`) still sits
    // inside this sole block — focus alone must not be enough to open it.
    const { container } = renderEditor(DIAGRAM, { autoFocus: true })
    await waitFor(() => { expect(block(container)).not.toBeNull() })
    await waitFor(() => {
      expect(document.activeElement).toBe(container.querySelector('.ProseMirror'))
    })
    expect(block(container)?.dataset.state).toBe('preview')
    await waitFor(() => {
      expect(container.querySelector('.spote-mermaid__figure svg')).not.toBeNull()
    })
  })

  it('reverts to preview when the editor loses focus', async () => {
    const { container } = renderEditor(DIAGRAM)
    await waitFor(() => { expect(block(container)).not.toBeNull() })
    container.querySelector<HTMLElement>('.spote-mermaid__preview')!
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    await waitFor(() => { expect(block(container)?.dataset.state).toBe('edit') })
    container.querySelector<HTMLElement>('.ProseMirror')!.dispatchEvent(new FocusEvent('blur'))
    await waitFor(() => { expect(block(container)?.dataset.state).toBe('preview') })
  })

  it('moves edit state between blocks from the decoration alone, without a click', async () => {
    const TWO_DIAGRAMS = '```mermaid\ngraph TD\n  A --> B\n```\n\n```mermaid\ngraph TD\n  C --> D\n```'
    const { container } = renderEditor(TWO_DIAGRAMS)
    await waitFor(() => {
      expect(container.querySelectorAll('.spote-mermaid')).toHaveLength(2)
    })
    const [first, second] = Array.from(container.querySelectorAll<HTMLElement>('.spote-mermaid'))
    first.querySelector<HTMLElement>('.spote-mermaid__preview')!
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    await waitFor(() => { expect(first.dataset.state).toBe('edit') })

    // Reach the real EditorView via ProseMirror's own DOM back-reference
    // (`dom.pmViewDesc.spec` is the node view instance — see `CustomNodeViewDesc`
    // in prosemirror-view — which holds `view`). This dispatches a transaction
    // directly on the view, the way the design intends, with no click on the
    // second block — DOM focus never changes — so a correct outcome here proves
    // the decoration's `update()`-firing mechanism drives the transition, not the
    // focus listener (which fires only once, for the first click, in this test).
    const viewDesc = (first as unknown as { pmViewDesc?: { spec?: { view?: EditorView } } }).pmViewDesc
    const view = viewDesc?.spec?.view
    expect(view).toBeTruthy()
    if (!view) throw new Error('could not reach the EditorView via pmViewDesc')

    let secondPos: number | null = null
    let seen = 0
    view.state.doc.descendants((node, pos) => {
      if (!isMermaidBlock(node)) return true
      seen += 1
      if (seen === 2) secondPos = pos
      return false
    })
    expect(secondPos).not.toBeNull()

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, secondPos! + 1)))

    await waitFor(() => {
      expect(first.dataset.state).toBe('preview')
      expect(second.dataset.state).toBe('edit')
    })
  })
})

describe('mermaid theming', () => {
  beforeEach(() => {
    h.mermaid.initialize.mockReset()
    h.mermaid.render.mockReset().mockResolvedValue({ svg: '<svg></svg>' })
    h.mermaid.parse.mockReset().mockResolvedValue(true)
  })

  it('renders with the dark theme when asked', async () => {
    renderEditor(DIAGRAM, { theme: 'dark' })
    await waitFor(() => {
      expect(h.mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }))
    })
  })

  it('re-renders already-rendered diagrams when the theme changes', async () => {
    const { rerender } = render(
      <MilkdownEditor
        value={DIAGRAM}
        onChange={vi.fn()}
        plugins={[]}
        theme="light"
        requestLink={async () => null}
        pickImage={async () => null}
      />,
    )
    await waitFor(() => { expect(h.mermaid.render).toHaveBeenCalledTimes(1) })
    rerender(
      <MilkdownEditor
        value={DIAGRAM}
        onChange={vi.fn()}
        plugins={[]}
        theme="dark"
        requestLink={async () => null}
        pickImage={async () => null}
      />,
    )
    await waitFor(() => {
      expect(h.mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }))
      expect(h.mermaid.render).toHaveBeenCalledTimes(2)
    })
  })
})

describe('mermaid zoom overlay', () => {
  beforeEach(() => {
    h.mermaid.initialize.mockReset()
    h.mermaid.render.mockReset().mockResolvedValue({ svg: '<svg data-testid="big"></svg>' })
    h.mermaid.parse.mockReset().mockResolvedValue(true)
  })

  async function openOverlay() {
    const { container } = renderEditor(DIAGRAM)
    await waitFor(() => { expect(container.querySelector('.spote-mermaid__figure svg')).not.toBeNull() })
    const zoom = container.querySelector<HTMLButtonElement>('.spote-mermaid__zoom')!
    // Wrapped in act: this is a native click (the real interaction path), not an
    // RTL-simulated one, so React doesn't auto-batch the resulting setState.
    act(() => { zoom.click() })
    await waitFor(() => { expect(document.querySelector('.spote-mermaid-overlay')).not.toBeNull() })
    return container
  }

  it('opens the overlay with the rendered diagram', async () => {
    await openOverlay()
    expect(document.querySelector('.spote-mermaid-overlay__figure svg')).not.toBeNull()
  })

  it('closes on Escape', async () => {
    await openOverlay()
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    await waitFor(() => { expect(document.querySelector('.spote-mermaid-overlay')).toBeNull() })
  })

  it('closes when the scrim is clicked', async () => {
    await openOverlay()
    const scrim = document.querySelector<HTMLElement>('.spote-mermaid-overlay')!
    act(() => { scrim.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) })
    await waitFor(() => { expect(document.querySelector('.spote-mermaid-overlay')).toBeNull() })
  })

  it('does not enter edit mode when the zoom button is clicked', async () => {
    const { container } = renderEditor(DIAGRAM)
    await waitFor(() => { expect(container.querySelector('.spote-mermaid__figure svg')).not.toBeNull() })
    const zoom = container.querySelector<HTMLButtonElement>('.spote-mermaid__zoom')!
    // The real interaction path: mousedown reaches the preview first and would enter
    // edit mode, so the button must stop it. Firing only `click` would not test that.
    act(() => { zoom.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })) })
    act(() => { zoom.click() })
    await waitFor(() => { expect(document.querySelector('.spote-mermaid-overlay')).not.toBeNull() })
    expect(container.querySelector<HTMLElement>('.spote-mermaid')?.dataset.state).toBe('preview')
  })

  it('offers zoom in read-only mode', async () => {
    const { container } = renderEditor(DIAGRAM, { readOnly: true })
    await waitFor(() => { expect(container.querySelector('.spote-mermaid__zoom')).not.toBeNull() })
  })

  it('opens via keyboard activation, not just a pointer click', async () => {
    const { container } = renderEditor(DIAGRAM)
    await waitFor(() => { expect(container.querySelector('.spote-mermaid__figure svg')).not.toBeNull() })
    const zoom = container.querySelector<HTMLButtonElement>('.spote-mermaid__zoom')!
    zoom.focus()
    expect(document.activeElement).toBe(zoom)
    // A native button's default action fires a click on Enter when it has focus;
    // user-event reproduces that default so this exercises real keyboard activation,
    // not a synthetic call to onClick.
    await userEvent.keyboard('{Enter}')
    await waitFor(() => { expect(document.querySelector('.spote-mermaid-overlay')).not.toBeNull() })
  })

  it('stops listening for Escape once it is closed', () => {
    // Tested as a unit, directly, with an injected onClose: only this shape makes a
    // leaked listener observable. Going through MilkdownEditor's onClose
    // (setZoomSvg(null) + refocus) can't distinguish a real cleanup from a leak — a
    // second call is a React state bail-out either way, so nothing would fail.
    const onClose = vi.fn()
    const { unmount } = render(<MermaidOverlay svg="<svg></svg>" onClose={onClose} />)

    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(onClose).toHaveBeenCalledTimes(1)

    unmount()
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('returns focus to the editor when the overlay closes', async () => {
    const container = await openOverlay()
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    await waitFor(() => { expect(document.querySelector('.spote-mermaid-overlay')).toBeNull() })
    await waitFor(() => { expect(document.activeElement).toBe(container.querySelector('.ProseMirror')) })
  })
})

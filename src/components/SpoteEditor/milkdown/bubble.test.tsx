import { describe, it, expect, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MilkdownEditor } from './MilkdownEditor'
import { DEFAULT_PLUGINS } from '../command-core/plugins'

/**
 * The selection bubble in WYSIWYG mode. ProseMirror — unlike CodeMirror, whose
 * default keymap collapses the selection on Escape — leaves a non-empty selection
 * alone, so the bubble needs its own Escape handling to close here.
 */
async function renderWithSelectedWord() {
  const { container } = render(
    <MilkdownEditor
      value="hello world"
      onChange={vi.fn()}
      plugins={DEFAULT_PLUGINS}
      requestLink={async () => null}
      pickImage={async () => null}
    />,
  )
  await waitFor(() => { expect(container.querySelector('p')).not.toBeNull() })

  // Select "hello" the way the browser does on a double click: move the DOM
  // selection and let ProseMirror's observer pick it up. It only listens while
  // the editor holds focus.
  const editable = container.querySelector<HTMLElement>('.ProseMirror')!
  editable.focus()
  const text = container.querySelector('p')!.firstChild!
  const range = document.createRange()
  range.setStart(text, 0)
  range.setEnd(text, 5)
  const selection = window.getSelection()!
  act(() => {
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })

  await waitFor(() => { expect(document.querySelector('.spote-bubble')).not.toBeNull() })
  return container
}

describe('MilkdownEditor selection bubble', () => {
  it('opens on a non-empty selection', async () => {
    await renderWithSelectedWord()
    expect(document.querySelector('.spote-bubble')).not.toBeNull()
  })

  it('closes on Escape', async () => {
    await renderWithSelectedWord()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => { expect(document.querySelector('.spote-bubble')).toBeNull() })
  })
})

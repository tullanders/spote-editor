import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { MilkdownEditor } from './MilkdownEditor'

/**
 * Milkdown is headless: the GFM preset renders a task item as a bare
 * `<li data-item-type="task" data-checked="…">` with no checkbox element. We
 * supply the checkbox ourselves as a widget decoration and style it from our
 * stylesheet, so these tests pin all three halves — the markup contract, the
 * fact that our CSS targets it, and that clicking actually toggles.
 */

let styleEl: HTMLStyleElement

beforeAll(() => {
  styleEl = document.createElement('style')
  // vitest runs from the repo root, so resolve the shipped stylesheet from there.
  styleEl.textContent = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8')
  document.head.appendChild(styleEl)
})

afterAll(() => { styleEl.remove() })

async function renderMarkdown(value: string, props: { readOnly?: boolean } = {}) {
  const onChange = vi.fn()
  const { container } = render(
    <MilkdownEditor
      value={value}
      onChange={onChange}
      plugins={[]}
      requestLink={async () => null}
      pickImage={async () => null}
      {...props}
    />,
  )
  await waitFor(() => { expect(container.querySelector('li')).not.toBeNull() })
  return { container, onChange }
}

const boxes = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))

/** Milkdown's listener debounces serialization by 200ms, so onChange lags. */
const expectMarkdown = (onChange: ReturnType<typeof vi.fn>, fragment: string) =>
  waitFor(() => { expect(onChange).toHaveBeenCalledWith(expect.stringContaining(fragment)) })

describe('WYSIWYG task lists', () => {
  it('parses GFM checkboxes into task list items', async () => {
    const { container } = await renderMarkdown('* [ ] todo\n* [x] done\n* plain')
    const items = Array.from(container.querySelectorAll('li'))
    expect(items.map((li) => li.dataset.itemType)).toEqual(['task', 'task', undefined])
    expect(items.map((li) => li.dataset.checked)).toEqual(['false', 'true', undefined])
  })

  it('styles task items as checkboxes instead of plain bullets', async () => {
    const { container } = await renderMarkdown('* [ ] todo\n* plain')
    const [task, plain] = Array.from(container.querySelectorAll('li'))
    expect(getComputedStyle(task).listStyle).toBe('none')
    expect(getComputedStyle(plain).listStyle).not.toBe('none')
  })

  it('renders a checkbox for task items only', async () => {
    const { container } = await renderMarkdown('* [ ] todo\n* [x] done\n* plain')
    expect(boxes(container).map((b) => b.checked)).toEqual([false, true])
  })

  it('checks an item when its checkbox is clicked', async () => {
    const { container, onChange } = await renderMarkdown('* [ ] todo')
    await userEvent.click(boxes(container)[0])
    expect(boxes(container)[0].checked).toBe(true)
    await expectMarkdown(onChange, '[x] todo')
  })

  it('unchecks an item when its checkbox is clicked', async () => {
    const { container, onChange } = await renderMarkdown('* [x] done')
    await userEvent.click(boxes(container)[0])
    expect(boxes(container)[0].checked).toBe(false)
    await expectMarkdown(onChange, '[ ] done')
  })

  it('leaves the surrounding text alone when toggling', async () => {
    const { container, onChange } = await renderMarkdown('* [ ] first\n* [ ] second')
    await userEvent.click(boxes(container)[1])
    await waitFor(() => {
      const md = onChange.mock.calls.at(-1)?.[0] as string | undefined
      expect(md).toContain('[ ] first')
      expect(md).toContain('[x] second')
    })
  })

  it('disables checkboxes in read-only mode', async () => {
    const { container } = await renderMarkdown('* [ ] todo', { readOnly: true })
    const box = boxes(container)[0]
    expect(box.disabled).toBe(true)
    await userEvent.click(box)
    expect(container.querySelector('li')?.dataset.checked).toBe('false')
  })
})

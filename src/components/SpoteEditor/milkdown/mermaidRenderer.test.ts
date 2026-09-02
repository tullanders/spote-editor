import { describe, it, expect, vi, beforeEach } from 'vitest'

// `vi.hoisted` lets the mock factory touch these — the factory is hoisted above imports.
// `loads` counts factory invocations, which is how we prove the module is imported once.
const h = vi.hoisted(() => ({
  loads: 0,
  // When true, the next `import('mermaid')` throws instead of resolving — used to
  // simulate a failed chunk load without permanently poisoning the module mock.
  failImport: false,
  mermaid: {
    initialize: vi.fn(),
    render: vi.fn(),
    parse: vi.fn(),
  },
}))

vi.mock('mermaid', () => {
  h.loads++
  if (h.failImport) throw new Error('chunk load failed')
  return { default: h.mermaid }
})

import { renderMermaid, parseMermaid } from './mermaidRenderer'

describe('mermaidRenderer', () => {
  beforeEach(() => {
    h.mermaid.initialize.mockReset()
    h.mermaid.render.mockReset()
    h.mermaid.parse.mockReset()
    h.failImport = false
    document.body.innerHTML = ''
  })

  it('returns the rendered svg', async () => {
    h.mermaid.render.mockResolvedValue({ svg: '<svg id="ok"></svg>' })
    const result = await renderMermaid('graph TD\n A-->B', 'light')
    expect(result).toEqual({ ok: true, svg: '<svg id="ok"></svg>' })
  })

  it('initializes with the light theme mapped to mermaid "default"', async () => {
    h.mermaid.render.mockResolvedValue({ svg: '<svg></svg>' })
    await renderMermaid('graph TD\n A-->B', 'light')
    expect(h.mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ startOnLoad: false, theme: 'default', securityLevel: 'strict' }),
    )
  })

  it('initializes with the dark theme', async () => {
    h.mermaid.render.mockResolvedValue({ svg: '<svg></svg>' })
    await renderMermaid('graph TD\n A-->B', 'dark')
    expect(h.mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }))
  })

  it('loads mermaid only once across renders', async () => {
    h.mermaid.render.mockResolvedValue({ svg: '<svg></svg>' })
    await renderMermaid('graph TD\n A-->B', 'light')
    await renderMermaid('graph TD\n B-->C', 'light')
    expect(h.loads).toBe(1)
  })

  it('reports a failed render as data instead of throwing', async () => {
    h.mermaid.render.mockRejectedValue(new Error('Parse error on line 3'))
    const result = await renderMermaid('nonsense', 'light')
    expect(result).toEqual({ ok: false, message: 'Parse error on line 3' })
  })

  it('removes the orphan node mermaid leaves behind on failure', async () => {
    h.mermaid.render.mockImplementation((id: string) => {
      // Mermaid appends a `d`-prefixed working node to the body and abandons it on error.
      const orphan = document.createElement('div')
      orphan.id = `d${id}`
      document.body.appendChild(orphan)
      return Promise.reject(new Error('boom'))
    })
    await renderMermaid('nonsense', 'light')
    expect(document.querySelector('[id^="dspote-mermaid-"]')).toBeNull()
  })

  it('uses a fresh id for every render', async () => {
    h.mermaid.render.mockResolvedValue({ svg: '<svg></svg>' })
    await renderMermaid('a', 'light')
    await renderMermaid('b', 'light')
    const ids = h.mermaid.render.mock.calls.map((c) => c[0] as string)
    expect(ids[0]).not.toBe(ids[1])
    expect(ids[0]).toMatch(/^spote-mermaid-\d+$/)
  })

  it('reports invalid syntax from parseMermaid', async () => {
    h.mermaid.parse.mockRejectedValue(new Error('Expecting NODE_STRING'))
    expect(await parseMermaid('nonsense')).toEqual({ ok: false, message: 'Expecting NODE_STRING' })
  })

  it('reports valid syntax from parseMermaid', async () => {
    h.mermaid.parse.mockResolvedValue(true)
    expect(await parseMermaid('graph TD\n A-->B')).toEqual({ ok: true })
  })

  // Placed last: it uses `vi.resetModules()` to get a fresh `loading` memo (isolated
  // from the module instance every earlier test shares via the static import above),
  // and its extra `import('mermaid')` calls would otherwise perturb `h.loads` for
  // the "loads mermaid only once" assertion above.
  it('retries the import after a rejected load instead of caching the failure', async () => {
    vi.resetModules()
    h.failImport = true
    const fresh = await import('./mermaidRenderer')

    const first = await fresh.renderMermaid('graph TD\n A-->B', 'light')
    expect(first.ok).toBe(false)

    h.failImport = false
    h.mermaid.render.mockResolvedValue({ svg: '<svg id="retried"></svg>' })
    const second = await fresh.renderMermaid('graph TD\n A-->B', 'light')
    expect(second).toEqual({ ok: true, svg: '<svg id="retried"></svg>' })
  })
})

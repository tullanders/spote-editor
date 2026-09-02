export type MermaidTheme = 'light' | 'dark'
export type MermaidResult = { ok: true; svg: string } | { ok: false; message: string }

type MermaidModule = typeof import('mermaid')['default']

// One in-flight/settled import shared by every caller: notes without diagrams never
// load mermaid at all, and notes with ten diagrams load it once.
let loading: Promise<MermaidModule> | null = null

function load(): Promise<MermaidModule> {
  loading ??= import('mermaid').then((m) => m.default)
  return loading
}

let idCounter = 0
const nextId = () => `spote-mermaid-${++idCounter}`

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Mermaid renders into a detached working node named `d<id>` and appends it to the
 * body. On success it cleans up after itself; on failure it abandons the node, so a
 * diagram that is invalid while you type would otherwise leak one node per keystroke.
 */
function removeOrphan(id: string): void {
  document.getElementById(`d${id}`)?.remove()
}

/**
 * Renders mermaid source to an SVG string.
 *
 * `securityLevel: 'strict'` is deliberate and not configurable: the SVG is injected as
 * HTML into the editor, and a note may have arrived from someone else through a share
 * link. Strict sanitizes labels and disables `htmlLabels`.
 *
 * Invalid syntax is a normal state while typing, not an exception — hence the result
 * object rather than a rejected promise.
 */
export async function renderMermaid(code: string, theme: MermaidTheme): Promise<MermaidResult> {
  const id = nextId()
  try {
    const mermaid = await load()
    // Mermaid's config is global, so re-initializing is how a runtime theme switch is
    // expressed. It is cheap.
    mermaid.initialize({ startOnLoad: false, theme: theme === 'dark' ? 'dark' : 'default', securityLevel: 'strict' })
    const { svg } = await mermaid.render(id, code)
    return { ok: true, svg }
  } catch (error) {
    return { ok: false, message: messageOf(error) }
  } finally {
    removeOrphan(id)
  }
}

/** Syntax check only — no DOM, no rendering. Drives the status line while editing. */
export async function parseMermaid(code: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const mermaid = await load()
    await mermaid.parse(code)
    return { ok: true }
  } catch (error) {
    return { ok: false, message: messageOf(error) }
  }
}

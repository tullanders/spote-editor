import { Plugin, PluginKey } from '@milkdown/prose/state'
import type { EditorState } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
import type { EditorView } from '@milkdown/prose/view'

export const taskCheckboxPluginKey = new PluginKey('spote-task-checkbox')

/** Walk up from a document position to the `list_item` node that encloses it. */
function taskItemPosAt(state: EditorState, pos: number): number | null {
  const $pos = state.doc.resolve(pos)
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).type.name === 'list_item') return $pos.before(depth)
  }
  return null
}

function toggleTaskAt(view: EditorView, widgetPos: number) {
  const itemPos = taskItemPosAt(view.state, widgetPos)
  if (itemPos == null) return
  const item = view.state.doc.nodeAt(itemPos)
  // A null `checked` means a plain bullet, which has no checkbox to toggle.
  if (!item || item.attrs.checked == null) return
  view.dispatch(
    view.state.tr.setNodeMarkup(itemPos, undefined, { ...item.attrs, checked: !item.attrs.checked }),
  )
}

function renderCheckbox(checked: boolean) {
  return (view: EditorView, getPos: () => number | undefined) => {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.className = 'spote-task-checkbox'
    input.checked = checked
    input.contentEditable = 'false'
    // Reflects editability at creation time. A readOnly flip after mount won't
    // re-render existing widgets, so the click handler re-checks it too.
    input.disabled = !view.editable
    input.addEventListener('click', (event) => {
      // The doc is the source of truth: block the native toggle and let the
      // transaction re-render the widget with the new state.
      event.preventDefault()
      if (!view.editable) return
      const pos = getPos()
      if (pos != null) toggleTaskAt(view, pos)
    })
    return input
  }
}

/**
 * Renders a real, clickable checkbox in front of every GFM task item.
 *
 * The GFM preset only marks task items with `data-item-type`/`data-checked` and
 * leaves the checkbox to the theme, but a CSS-only marker can't take clicks. A
 * widget decoration gives us an actual `<input>` without touching the document
 * — it stays view-only, so serialization is unaffected.
 */
export function createTaskCheckboxPlugin(): Plugin {
  return new Plugin({
    key: taskCheckboxPluginKey,
    props: {
      decorations(state) {
        const decorations: Decoration[] = []
        state.doc.descendants((node, pos) => {
          const { checked } = node.attrs
          if (node.type.name !== 'list_item' || checked == null) return true
          // Step inside the item, then inside its first block, so the box flows
          // with the first line of text. If that block can't hold inline content
          // (a nested list, say), sit in front of it instead.
          const at = node.firstChild?.isTextblock ? pos + 2 : pos + 1
          decorations.push(
            Decoration.widget(at, renderCheckbox(checked), {
              side: -1,
              // Distinguishes the two states so ProseMirror rebuilds the widget
              // on toggle rather than reusing the stale DOM.
              key: `spote-task-${checked}`,
              ignoreSelection: true,
              stopEvent: () => true,
            }),
          )
          return true
        })
        return DecorationSet.create(state.doc, decorations)
      },
    },
  })
}

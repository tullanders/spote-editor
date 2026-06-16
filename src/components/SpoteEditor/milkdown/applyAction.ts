import type { Ctx } from '@milkdown/ctx'
import { callCommand, insert } from '@milkdown/utils'
import {
  wrapInHeadingCommand,
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  createCodeBlockCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  wrapInBlockquoteCommand,
} from '@milkdown/preset-commonmark'
import type { PluginAction } from '../command-core/plugin.types'

// NOTE: a $Command's `.key` is assigned lazily — only after the editor has run the
// plugin — so it must be read at call time, NOT cached at module load (where it is
// still undefined). Keep these as a getter map, not precomputed keys.
const MARK_COMMAND = {
  strong: toggleStrongCommand,
  emphasis: toggleEmphasisCommand,
  inlineCode: toggleInlineCodeCommand,
} as const

/**
 * Interprets a surface-agnostic {@link PluginAction} against a Milkdown `Ctx`.
 *
 * Marks/blocks dispatch the matching `@milkdown/preset-commonmark` commands.
 * `replaceSelection`/`insert` parse the markdown fragment and splice it in via
 * Milkdown's `insert` macro (parses to a ProseMirror slice, then dispatches a
 * transaction on the editor view). `inline: true` keeps `[text](href)`-style
 * fragments inline; `inline: false` lets a block fragment (e.g. `---`) land as a
 * standalone block.
 */
export function applyAction(ctx: Ctx, action: PluginAction): void {
  switch (action.kind) {
    case 'toggleMark':
      callCommand(MARK_COMMAND[action.mark].key)(ctx)
      return
    case 'setBlock':
      switch (action.block) {
        case 'heading':
          callCommand(wrapInHeadingCommand.key, action.attrs?.level ?? 1)(ctx)
          return
        case 'bulletList':
          callCommand(wrapInBulletListCommand.key)(ctx)
          return
        case 'orderedList':
          callCommand(wrapInOrderedListCommand.key)(ctx)
          return
        case 'blockquote':
          callCommand(wrapInBlockquoteCommand.key)(ctx)
          return
        case 'codeBlock':
          callCommand(createCodeBlockCommand.key)(ctx)
          return
      }
      return
    case 'replaceSelection':
      insert(action.markdown, true)(ctx)
      return
    case 'insert':
      insert(action.markdown, false)(ctx)
      return
  }
}

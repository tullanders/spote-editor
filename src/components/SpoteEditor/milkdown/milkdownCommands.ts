import type { Ctx } from '@milkdown/ctx'
import { callCommand } from '@milkdown/utils'
import {
  wrapInHeadingCommand,
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  createCodeBlockCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  wrapInBlockquoteCommand,
  insertHrCommand,
} from '@milkdown/preset-commonmark'
import type { CommandId } from '../command-core/commands'

/**
 * Maps each slash/bubble command id to a Milkdown action that runs against a `Ctx`.
 *
 * Command keys are taken from `@milkdown/preset-commonmark` (verified against the
 * installed 7.21.2 type definitions). Each `$Command` exposes a `.key` (`CmdKey`)
 * that `callCommand(key, payload)` dispatches through Milkdown's command manager.
 *
 * `link` is intentionally omitted from this record: it is handled by the React
 * wrapper through the link popover (`onRequestLink`), not by a single command call.
 */
export type MilkdownCommandId = Exclude<CommandId, 'link'>

export const milkdownCommands: Record<MilkdownCommandId, (ctx: Ctx) => void> = {
  h1: (ctx) => { callCommand(wrapInHeadingCommand.key, 1)(ctx) },
  h2: (ctx) => { callCommand(wrapInHeadingCommand.key, 2)(ctx) },
  h3: (ctx) => { callCommand(wrapInHeadingCommand.key, 3)(ctx) },
  bold: (ctx) => { callCommand(toggleStrongCommand.key)(ctx) },
  italic: (ctx) => { callCommand(toggleEmphasisCommand.key)(ctx) },
  code: (ctx) => { callCommand(toggleInlineCodeCommand.key)(ctx) },
  codeblock: (ctx) => { callCommand(createCodeBlockCommand.key)(ctx) },
  'bullet-list': (ctx) => { callCommand(wrapInBulletListCommand.key)(ctx) },
  'ordered-list': (ctx) => { callCommand(wrapInOrderedListCommand.key)(ctx) },
  quote: (ctx) => { callCommand(wrapInBlockquoteCommand.key)(ctx) },
  divider: (ctx) => { callCommand(insertHrCommand.key)(ctx) },
}

/** Whether a given command id is dispatched via {@link milkdownCommands}. */
export function isMilkdownCommandId(id: string): id is MilkdownCommandId {
  return id in milkdownCommands
}

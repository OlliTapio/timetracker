/** @file The command bodies. The entry point wires in the real sampler, model and transport. */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Command } from '../adapters/argv.ts'
import { compilePatterns } from '../infra/config-file.ts'
import type { Chat } from '../infra/ollama.ts'
import type { Sampler } from '../infra/sampler.ts'
import { every, type Repeating } from '../infra/schedule.ts'
import { accuracyText, reviewLines } from '../views/report.ts'
import { USAGE } from '../views/usage.ts'
import type { Context } from './context.ts'
import { acceptDay, correct, modelAccuracy, reviewRows } from './entries.ts'
import { createMcpServer } from './mcp-server.ts'
import { recordSample, summarizePending } from './track.ts'

export interface CliDeps {
  readonly print: (text: string) => unknown
  /** Diagnostics; stdout belongs to the MCP protocol while `mcp` runs. */
  readonly warn: (text: string) => unknown
  readonly now: () => number
  readonly sampler: () => Sampler
  readonly chat: Chat
  readonly serve: (server: McpServer) => Promise<unknown>
}

const SUMMARIZE_EVERY_MS = 60_000

const startTracking = (ctx: Context, deps: CliDeps): readonly Repeating[] => {
  const sample = deps.sampler()
  const patterns = compilePatterns(ctx.config.redact)
  const report = (err: unknown) => deps.warn(err instanceof Error ? err.message : String(err))
  return [
    every(
      ctx.config.sampleSeconds * 1000,
      () => recordSample(ctx, deps.now(), sample(), patterns),
      report,
    ),
    every(
      SUMMARIZE_EVERY_MS,
      async () => {
        const written = await summarizePending(ctx, deps.chat, deps.now())
        if (written > 0) deps.warn(`Wrote ${String(written)} entries.`)
      },
      report,
    ),
  ]
}

/** Resolves when a one-shot command is done; `run` keeps going on its timers. */
export const runCommand = async (
  command: Command,
  ctx: Context,
  deps: CliDeps,
): Promise<unknown> => {
  switch (command.kind) {
    case 'help':
      return deps.print(USAGE)
    case 'run':
      deps.warn(`Tracking every ${String(ctx.config.sampleSeconds)} s; Ctrl+C to stop.`)
      return startTracking(ctx, deps)
    case 'summarize':
      return deps.print(
        `Wrote ${String(await summarizePending(ctx, deps.chat, deps.now()))} entries.`,
      )
    case 'review': {
      const lines = reviewLines(reviewRows(ctx, command.day))
      return deps.print(lines.length > 0 ? lines.join('\n') : `No entries on ${command.day}.`)
    }
    case 'label':
      return correct(ctx, command)
    case 'accept':
      return deps.print(`Accepted ${String(acceptDay(ctx, command.day))} entries.`)
    case 'eval':
      return deps.print(accuracyText(modelAccuracy(ctx)))
    case 'mcp':
      return deps.serve(createMcpServer(ctx))
  }
}

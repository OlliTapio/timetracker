/** @file Recording samples, and turning finished blocks into entries. */
import { guessFrom } from '../adapters/guess.ts'
import { blockStart, evidence, IDLE_GUESS } from '../domain/blocks.ts'
import { choices } from '../domain/config.ts'
import { redact } from '../domain/redact.ts'
import type { Guess, Snapshot } from '../domain/types.ts'
import { parseJson } from '../infra/json.ts'
import type { Chat } from '../infra/ollama.ts'
import { inOrder } from '../infra/sequence.ts'
import { evidenceText } from '../views/evidence.ts'
import { buildMessages } from '../views/prompt.ts'
import type { Context } from './context.ts'

/** Corrections shown to the model as examples; more costs context on a small model. */
const EXAMPLES = 4

export const recordSample = (
  { store }: Context,
  ts: number,
  snapshot: Snapshot,
  patterns: readonly RegExp[],
): number => store.insertSample(ts, redact(snapshot, patterns))

const ask = async ({ config, store }: Context, chat: Chat, text: string): Promise<Guess> => {
  const messages = buildMessages(
    text,
    choices(config),
    config.blockMinutes,
    store.recentCorrections(EXAMPLES),
  )
  const reply = await chat(messages)
  return guessFrom(parseJson(reply), reply, choices(config))
}

const summarizeBlock = async (ctx: Context, chat: Chat, start: number): Promise<number> => {
  const { config, store } = ctx
  const samples = store.samplesBetween(start, start + config.blockMinutes * 60)
  const ev = evidence(samples, config.sampleSeconds, config.idleAfterSeconds)
  const text = evidenceText(ev)
  const guess = ev.activeS === 0 ? IDLE_GUESS : await ask(ctx, chat, text)
  store.insertEntry({ blockStart: start, ...guess, model: config.model, evidence: text })
  return start
}

/** Writes an entry for every finished block that has samples and no entry; returns how many. */
export const summarizePending = async (ctx: Context, chat: Chat, now: number): Promise<number> => {
  const { config, store } = ctx
  const current = blockStart(now, config.blockMinutes)
  const pending = store.unsummarizedBlocks(config.blockMinutes, current)
  const written = await inOrder(pending, (start) => summarizeBlock(ctx, chat, start))
  return written.length
}

import { expect, test } from 'vitest'
import { recordSample, summarizePending } from '../../src/app/track.ts'
import { blockStart } from '../../src/domain/blocks.ts'
import type { ChatMessage } from '../../src/domain/types.ts'
import type { Chat } from '../../src/infra/ollama.ts'
import { context, snapshot, T0 } from '../support/context.ts'

const fakeModel =
  (seen: string[]): Chat =>
  async (messages: readonly ChatMessage[]) => {
    const evidence = messages.at(-1)?.content ?? ''
    seen.push(evidence)
    const project = evidence.includes('booking') ? 'Sono' : 'Job search'
    return JSON.stringify({ project, activity: 'work', confidence: 0.9 })
  }

const projects = (ctx: ReturnType<typeof context>): readonly string[] =>
  ctx.store.entriesBetween(0, Infinity).map((e) => e.project)

test('summarizes finished blocks only, once each', async () => {
  const ctx = context()
  Array.from({ length: 10 }, (_, i) => recordSample(ctx, T0 + i * 5, snapshot('booking.py'), []))
  Array.from({ length: 10 }, (_, i) => recordSample(ctx, T0 + 900 + i * 5, snapshot('Nebius'), []))
  recordSample(ctx, T0 + 1800, snapshot('LinkedIn'), [])
  const seen: string[] = []

  expect(await summarizePending(ctx, fakeModel(seen), T0 + 1810)).toBe(2)
  expect(await summarizePending(ctx, fakeModel(seen), T0 + 1810)).toBe(0)
  expect(projects(ctx)).toEqual(['Sono', 'Job search'])
  expect(seen[0]).toContain('- 0.8  app.exe | booking.py')
})

test('an idle block skips the model', async () => {
  const ctx = context()
  recordSample(ctx, T0, snapshot('x', { idleS: 999 }), [])
  const boom: Chat = async () => {
    throw new Error('model called for an idle block')
  }
  expect(await summarizePending(ctx, boom, T0 + 900)).toBe(1)
  expect(projects(ctx)).toEqual(['Idle'])
})

test('a failed block is retried on the next run, and later blocks wait for it', async () => {
  const ctx = context()
  recordSample(ctx, T0, snapshot('booking.py'), [])
  recordSample(ctx, T0 + 900, snapshot('Nebius'), [])
  const failsFirstBlock: Chat = async (messages) => {
    if (messages.at(-1)?.content.includes('booking') === true) throw new Error('Ollama is down')
    return fakeModel([])(messages)
  }
  await expect(summarizePending(ctx, failsFirstBlock, T0 + 1800)).rejects.toThrow('Ollama is down')
  expect(ctx.store.entriesBetween(0, Infinity)).toEqual([])
  expect(await summarizePending(ctx, fakeModel([]), T0 + 1800)).toBe(2)
})

test('a sample older than the newest entry is not summarized', async () => {
  const ctx = context()
  recordSample(ctx, T0 + 900, snapshot('booking.py'), [])
  expect(await summarizePending(ctx, fakeModel([]), T0 + 1800)).toBe(1)
  recordSample(ctx, T0, snapshot('booking.py'), [])
  expect(await summarizePending(ctx, fakeModel([]), T0 + 1800)).toBe(0)
})

test('blocks of any whole length match the domain alignment, fractional times included', async () => {
  const ctx = context({ blockMinutes: 60 })
  const times = [T0 - 0.001, T0, T0 + 0.25, T0 + 3599.999, T0 + 3600]
  times.forEach((ts) => recordSample(ctx, ts, snapshot('booking.py'), []))
  const starts = [...new Set(times.map((ts) => blockStart(ts, 60)))]
  expect(ctx.store.unsummarizedBlocks(60, T0 + 7200)).toEqual(starts)
  expect(ctx.store.unsummarizedBlocks(1, T0 + 7200)).toEqual([
    ...new Set(times.map((ts) => blockStart(ts, 1))),
  ])
})

test('corrections are shown to the model as examples', async () => {
  const ctx = context()
  recordSample(ctx, T0, snapshot('booking.py'), [])
  await summarizePending(ctx, fakeModel([]), T0 + 900)
  ctx.store.setLabel(T0, { project: 'Job search', activity: 'cv' })
  recordSample(ctx, T0 + 900, snapshot('booking.py'), [])
  const prompts: (readonly ChatMessage[])[] = []
  await summarizePending(ctx, async (m) => (prompts.push(m), '{}'), T0 + 1800)
  expect(prompts[0]?.[2]?.content).toBe('{"project":"Job search","activity":"cv","confidence":1}')
})

test('titles are redacted before they are stored', () => {
  const ctx = context()
  recordSample(ctx, T0, snapshot('Inbox - a@b.fi'), [/\S+@\S+/g])
  expect(ctx.store.samplesBetween(T0, T0 + 1)[0]?.fgTitle).toBe('Inbox - [redacted]')
})

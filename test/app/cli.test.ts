import { afterEach, expect, test, vi } from 'vitest'
import { runCommand, type CliDeps } from '../../src/app/cli.ts'
import type { Command } from '../../src/adapters/argv.ts'
import type { Repeating } from '../../src/infra/schedule.ts'
import { context, DAY, entries, hhmm, snapshot, T0 } from '../support/context.ts'

afterEach(() => {
  vi.useRealTimers()
})

const harness = () => {
  const ctx = context()
  entries(ctx, [['Sono', 'PR review']])
  const out: string[] = []
  const err: string[] = []
  const deps: CliDeps = {
    print: (text) => out.push(text),
    warn: (text) => err.push(text),
    now: () => Date.now() / 1000,
    sampler: () => () => snapshot('booking.py'),
    chat: async () => '{"project": "Sono", "activity": "work", "confidence": 1}',
    serve: async () => 'served',
  }
  const run = (command: Command) => runCommand(command, ctx, deps)
  return { ctx, out, err, deps, run }
}

test('one-shot commands print their result', async () => {
  const { out, run } = harness()
  await run({ kind: 'help' })
  await run({ kind: 'review', day: DAY })
  await run({ kind: 'label', day: DAY, time: hhmm(0), project: 'Job search', activity: 'CV' })
  await run({ kind: 'accept', day: DAY })
  await run({ kind: 'eval' })
  await run({ kind: 'summarize' })
  await run({ kind: 'review', day: '2000-01-01' })
  expect(out[0]).toMatch(/^Usage: timetracker/)
  expect(out.slice(1)).toEqual([
    expect.stringMatching(/Sono +PR review {2}\(0\.8\)$/),
    'Accepted 0 entries.',
    expect.stringMatching(/^Accuracy 0% over 1 labelled blocks/),
    'Wrote 0 entries.',
    'No entries on 2000-01-01.',
  ])
})

test('mcp hands the server to the transport', async () => {
  expect(await harness().run({ kind: 'mcp' })).toBe('served')
})

/** Five seconds before a block ends, so the summary a minute later has one finished block. */
const fakeClock = () => vi.useFakeTimers({ now: (T0 + 1795) * 1000 })

test('run samples on a timer and summarizes finished blocks', async () => {
  fakeClock()
  const { ctx, err, run } = harness()
  const timers = (await run({ kind: 'run' })) as readonly Repeating[]
  await vi.advanceTimersByTimeAsync(61_000)
  timers.forEach((t) => {
    t.stop()
  })
  expect(ctx.store.samplesBetween(0, Infinity)).toHaveLength(13)
  expect(err[0]).toMatch(/^Tracking every 5 s/)
  expect(err).toContain('Wrote 1 entries.')
})

test('run reports a failing model and keeps going', async () => {
  fakeClock()
  const { err, deps, ctx } = harness()
  const failing: CliDeps = {
    ...deps,
    chat: async () => Promise.reject(new Error('Ollama is down')),
  }
  const timers = (await runCommand({ kind: 'run' }, ctx, failing)) as readonly Repeating[]
  await vi.advanceTimersByTimeAsync(121_000)
  timers.forEach((t) => {
    t.stop()
  })
  expect(err.filter((line) => line === 'Ollama is down')).toHaveLength(2)
  expect(ctx.store.samplesBetween(0, Infinity)).toHaveLength(25)
})

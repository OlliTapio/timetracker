import { describe, expect, test } from 'vitest'
import { blockStart, evidence } from '../../src/domain/blocks.ts'
import { checkProject, DEFAULT_CONFIG } from '../../src/domain/config.ts'
import { redact } from '../../src/domain/redact.ts'
import { accuracy, timesheet, totals } from '../../src/domain/report.ts'
import type { EffectiveEntry, Sample } from '../../src/domain/types.ts'
import { snapshot } from '../support/context.ts'

const sample = (fg: string, extra: Partial<Sample> = {}): Sample => ({
  ts: 0,
  ...snapshot(fg),
  ...extra,
})

describe('evidence', () => {
  test('counts focus, cursor-only windows and idle time', () => {
    const ev = evidence(
      [
        sample('pr.py', { fgProcess: 'code.exe', cursorProcess: 'code.exe', cursorTitle: 'pr.py' }),
        sample('pr.py', {
          fgProcess: 'code.exe',
          cursorProcess: 'chrome.exe',
          cursorTitle: 'Docs',
        }),
        sample('pr.py', { fgProcess: 'code.exe', idleS: 500 }),
      ],
      5,
      120,
    )
    expect(ev.activeS).toBe(10)
    expect(ev.idleS).toBe(5)
    expect(ev.focus).toEqual([{ process: 'code.exe', title: 'pr.py', seconds: 10 }])
    expect(ev.cursorOnly).toEqual([{ process: 'chrome.exe', title: 'Docs', seconds: 5 }])
  })

  test('orders windows by time, ties by first appearance', () => {
    const ev = evidence([sample('a'), sample('b'), sample('b'), sample('c')], 5, 120)
    expect(ev.focus.map((w) => w.title)).toEqual(['b', 'a', 'c'])
  })
})

test('blockStart aligns down to the block', () => {
  expect(blockStart(1_760_000_400 + 899.5, 15)).toBe(1_760_000_400)
})

test('checkProject accepts Idle and names the choices otherwise', () => {
  const config = { ...DEFAULT_CONFIG, projects: ['Sono'] }
  expect(checkProject('Idle', config)).toEqual({ ok: true, value: 'Idle' })
  expect(checkProject('Golf', config)).toEqual({
    ok: false,
    error: 'Unknown project "Golf". Use one of: Sono, Idle.',
  })
})

test('redact strips every match from both titles', () => {
  const out = redact(snapshot('mail a@b.fi and c@d.fi', { cursorTitle: 'x@y.z' }), [/\S+@\S+/g])
  expect(out.fgTitle).toBe('mail [redacted] and [redacted]')
  expect(out.cursorTitle).toBe('[redacted]')
})

const entry = (day: string, project: string, activity: string): EffectiveEntry => ({
  day,
  time: '09:00',
  project,
  activity,
  confidence: 1,
  corrected: false,
})

test('totals and timesheet count blocks as hours', () => {
  const rows = [
    entry('2026-10-02', 'Sono', 'review'),
    entry('2026-10-01', 'Sono', 'review'),
    entry('2026-10-01', 'Sono', ''),
    entry('2026-10-01', 'Job search', 'CV'),
  ]
  expect(totals(rows, 15)).toEqual([
    { project: 'Sono', hours: 0.75 },
    { project: 'Job search', hours: 0.25 },
  ])
  expect(timesheet(rows, 'Sono', 15)).toEqual([
    { day: '2026-10-01', hours: 0.5, activities: ['review'] },
    { day: '2026-10-02', hours: 0.25, activities: ['review'] },
  ])
})

test('accuracy counts hits and ranks mix-ups', () => {
  expect(accuracy([])).toEqual({ blocks: 0, accuracy: null, topErrors: [] })
  const result = accuracy([
    { predicted: 'Sono', actual: 'Sono' },
    { predicted: 'Sono', actual: 'Job search' },
    { predicted: 'Idle', actual: 'Sono' },
    { predicted: 'Sono', actual: 'Job search' },
  ])
  expect(result.accuracy).toBe(0.25)
  expect(result.topErrors).toEqual([
    { actual: 'Job search', predicted: 'Sono', count: 2 },
    { actual: 'Sono', predicted: 'Idle', count: 1 },
  ])
})

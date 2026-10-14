import { expect, test } from 'vitest'
import {
  acceptDay,
  blockEvidence,
  correct,
  effectiveEntries,
  hoursByProject,
  modelAccuracy,
  reviewRows,
  timesheetFor,
} from '../../src/app/entries.ts'
import { context, DAY, entries, hhmm } from '../support/context.ts'

const setup = () => {
  const ctx = context()
  entries(ctx, [
    ['Sono', 'PR review'],
    ['Sono', 'PR review'],
    ['Sono', 'standup'],
    ['Job search', 'CV'],
  ])
  return ctx
}

test('a range correction overrides entries and totals', () => {
  const ctx = setup()
  expect(hoursByProject(ctx, DAY, DAY)).toEqual([
    { project: 'Sono', hours: 0.75 },
    { project: 'Job search', hours: 0.25 },
  ])
  const relabelled = correct(ctx, {
    day: DAY,
    time: hhmm(2),
    until: hhmm(3),
    project: 'Job search',
    activity: 'Nebius prep',
  })
  expect(relabelled).toBe(1)
  expect(hoursByProject(ctx, DAY, DAY)).toEqual([
    { project: 'Sono', hours: 0.5 },
    { project: 'Job search', hours: 0.5 },
  ])
  const rows = effectiveEntries(ctx, DAY, DAY)
  expect(rows.map((r) => r.corrected)).toEqual([false, false, true, false])
  expect(rows[2]?.activity).toBe('Nebius prep')
})

test('a label without an activity keeps the model activity', () => {
  const ctx = setup()
  correct(ctx, { day: DAY, time: hhmm(0), project: 'Job search', activity: '' })
  expect(effectiveEntries(ctx, DAY, DAY)[0]).toMatchObject({
    project: 'Job search',
    activity: 'PR review',
  })
  expect(reviewRows(ctx, DAY)[0]?.label).toEqual({ project: 'Job search', activity: '' })
})

test('corrections reject unknown projects', () => {
  expect(() =>
    correct(setup(), { day: DAY, time: hhmm(0), project: 'Golf', activity: '' }),
  ).toThrow(/Unknown project "Golf"/)
})

test('accept labels the rest as the model had them, and feeds eval', () => {
  const ctx = setup()
  correct(ctx, { day: DAY, time: hhmm(3), project: 'Sono', activity: '' })
  expect(acceptDay(ctx, DAY)).toBe(3)
  expect(modelAccuracy(ctx)).toEqual({
    blocks: 4,
    accuracy: 0.75,
    topErrors: [{ actual: 'Sono', predicted: 'Job search', count: 1 }],
  })
})

test('timesheet and evidence', () => {
  const ctx = setup()
  expect(timesheetFor(ctx, DAY, DAY, 'Sono')).toBe(
    `date,hours,activities\r\n${DAY},0.75,PR review; standup\r\n`,
  )
  expect(blockEvidence(ctx, DAY, hhmm(1))).toBe('evidence 1')
  expect(blockEvidence(ctx, DAY, '23:59')).toBe('No entry for that block.')
})

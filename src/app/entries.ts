/** @file Reading and correcting entries: the review commands and the MCP tools share these. */
import { blockStart } from '../domain/blocks.ts'
import { checkProject } from '../domain/config.ts'
import { accuracy, timesheet, totals, type Accuracy, type ProjectHours } from '../domain/report.ts'
import type { EffectiveEntry, ReviewRow } from '../domain/types.ts'
import { dayRange, localParts, localTs } from '../infra/time.ts'
import { unwrap } from '../infra/unwrap.ts'
import { timesheetCsv } from '../views/report.ts'
import type { Context } from './context.ts'

export const reviewRows = ({ store }: Context, day: string): readonly ReviewRow[] =>
  store.entriesBetween(...dayRange(day, day)).map((e) => ({
    time: localParts(e.blockStart).time,
    project: e.project,
    activity: e.activity,
    confidence: e.confidence,
    label: e.labelProject === null ? null : { project: e.labelProject, activity: e.labelActivity },
  }))

/** Entries with labels applied: a label's project wins, and its activity when it has one. */
export const effectiveEntries = (
  { store }: Context,
  from: string,
  to: string,
): readonly EffectiveEntry[] =>
  store.entriesBetween(...dayRange(from, to)).map((e) => ({
    ...localParts(e.blockStart),
    project: e.labelProject ?? e.project,
    activity: e.labelActivity === '' ? e.activity : e.labelActivity,
    confidence: e.confidence,
    corrected: e.labelProject !== null,
  }))

const blockAt = (ctx: Context, day: string, time: string): number =>
  blockStart(localTs(day, time), ctx.config.blockMinutes)

export const blockEvidence = (ctx: Context, day: string, time: string): string =>
  ctx.store.evidenceAt(blockAt(ctx, day, time)) ?? 'No entry for that block.'

/** A correction for the block at `time`, or, with `until`, every entry up to (not including) it. */
export interface Correcting {
  readonly day: string
  readonly time: string
  readonly until?: string
  readonly project: string
  readonly activity: string
}

/** Returns how many blocks were labelled. */
export const correct = (ctx: Context, c: Correcting): number => {
  const label = { project: unwrap(checkProject(c.project, ctx.config)), activity: c.activity }
  const start = blockAt(ctx, c.day, c.time)
  return c.until === undefined
    ? ctx.store.setLabel(start, label)
    : ctx.store.labelRange(start, localTs(c.day, c.until), label)
}

export const acceptDay = ({ store }: Context, day: string): number =>
  store.acceptRange(...dayRange(day, day))

export const modelAccuracy = ({ store }: Context): Accuracy => accuracy(store.predictions())

export const hoursByProject = (ctx: Context, from: string, to: string): readonly ProjectHours[] =>
  totals(effectiveEntries(ctx, from, to), ctx.config.blockMinutes)

export const timesheetFor = (ctx: Context, from: string, to: string, project: string): string =>
  timesheetCsv(timesheet(effectiveEntries(ctx, from, to), project, ctx.config.blockMinutes))

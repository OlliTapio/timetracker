/** @file Hours, timesheets and model accuracy, from entries with their labels applied. */
import type { EffectiveEntry, Prediction } from './types.ts'

export interface ProjectHours {
  readonly project: string
  readonly hours: number
}

const hours = (blocks: number, blockMinutes: number): number => (blocks * blockMinutes) / 60

/** Hours per project, most first. */
export const totals = (
  entries: readonly EffectiveEntry[],
  blockMinutes: number,
): readonly ProjectHours[] =>
  [...new Set(entries.map((e) => e.project))]
    .map((project) => ({
      project,
      hours: hours(entries.filter((e) => e.project === project).length, blockMinutes),
    }))
    .toSorted((a, b) => b.hours - a.hours)

export interface TimesheetDay {
  readonly day: string
  readonly hours: number
  /** Distinct activities, in the order they happened. */
  readonly activities: readonly string[]
}

export const timesheet = (
  entries: readonly EffectiveEntry[],
  project: string,
  blockMinutes: number,
): readonly TimesheetDay[] => {
  const mine = entries.filter((e) => e.project === project)
  return [...new Set(mine.map((e) => e.day))].toSorted().map((day) => {
    const ofDay = mine.filter((e) => e.day === day)
    return {
      day,
      hours: hours(ofDay.length, blockMinutes),
      activities: [...new Set(ofDay.map((e) => e.activity).filter((a) => a !== ''))],
    }
  })
}

interface MixUp {
  readonly actual: string
  readonly predicted: string
  readonly count: number
}

export interface Accuracy {
  readonly blocks: number
  /** Share of labelled blocks where the model named the right project; null with no labels. */
  readonly accuracy: number | null
  readonly topErrors: readonly MixUp[]
}

export const accuracy = (predictions: readonly Prediction[], top = 5): Accuracy => {
  const wrong = predictions.filter((p) => p.predicted !== p.actual)
  const firstOfEach = wrong.filter(
    (p, i) => wrong.findIndex((q) => q.actual === p.actual && q.predicted === p.predicted) === i,
  )
  const mixUps = firstOfEach
    .map((p) => ({
      actual: p.actual,
      predicted: p.predicted,
      count: wrong.filter((q) => q.actual === p.actual && q.predicted === p.predicted).length,
    }))
    .toSorted((a, b) => b.count - a.count)
  const blocks = predictions.length
  return {
    blocks,
    accuracy: blocks === 0 ? null : (blocks - wrong.length) / blocks,
    topErrors: mixUps.slice(0, top),
  }
}

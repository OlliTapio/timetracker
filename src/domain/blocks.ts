/** @file Fixed-length blocks, and the evidence a block's samples add up to. */
import { IDLE } from './config.ts'
import type { Guess, Sample } from './types.ts'

export const blockStart = (ts: number, minutes: number): number => ts - (ts % (minutes * 60))

/** The blocks that times sorted oldest first fall in, each once, oldest first. */
export const blockStarts = (sortedTimes: readonly number[], minutes: number): readonly number[] =>
  sortedTimes
    .map((ts) => blockStart(ts, minutes))
    .filter((start, i, starts) => i === 0 || starts[i - 1] !== start)

export interface WindowTime {
  readonly process: string
  readonly title: string
  readonly seconds: number
}

export interface Evidence {
  readonly activeS: number
  readonly idleS: number
  /** Where typing went, most time first. */
  readonly focus: readonly WindowTime[]
  /** The cursor over a different window, usually reading or scrolling on another screen. */
  readonly cursorOnly: readonly WindowTime[]
}

interface Window {
  readonly process: string
  readonly title: string
}

const same = (a: Window, b: Window): boolean => a.process === b.process && a.title === b.title

/** Seconds per window, most first; ties keep the order windows first appeared. */
const tally = (windows: readonly Window[], secondsEach: number): readonly WindowTime[] =>
  windows
    .filter((w, i) => windows.findIndex((other) => same(other, w)) === i)
    .map((w) => ({
      process: w.process,
      title: w.title,
      seconds: windows.filter((other) => same(other, w)).length * secondsEach,
    }))
    .toSorted((a, b) => b.seconds - a.seconds)

const cursorElsewhere = (s: Sample): boolean =>
  s.cursorProcess !== '' && (s.cursorProcess !== s.fgProcess || s.cursorTitle !== s.fgTitle)

export const evidence = (
  samples: readonly Sample[],
  sampleSeconds: number,
  idleAfter: number,
): Evidence => {
  const active = samples.filter((s) => s.idleS < idleAfter)
  return {
    activeS: active.length * sampleSeconds,
    idleS: (samples.length - active.length) * sampleSeconds,
    focus: tally(
      active.map((s) => ({ process: s.fgProcess, title: s.fgTitle })),
      sampleSeconds,
    ),
    cursorOnly: tally(
      active
        .filter(cursorElsewhere)
        .map((s) => ({ process: s.cursorProcess, title: s.cursorTitle })),
      sampleSeconds,
    ),
  }
}

/** A block with no activity is recorded without asking the model. */
export const IDLE_GUESS: Guess = { project: IDLE, activity: 'away', confidence: 1 }

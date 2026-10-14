/** @file SQLite rows (unknown records) → domain types. A row of the wrong shape is a bug, reported. */
import type { Correction, Prediction, Sample } from '../domain/types.ts'
import { isRecord } from '../shared/collections.ts'
import { collect, fail, ok, type Result } from '../shared/result.ts'

type Rec = Readonly<Record<string, unknown>>

const num = (r: Rec, key: string): number | null => {
  const v = r[key]
  return typeof v === 'number' ? v : null
}

/** NULL text reads as empty: the tracker never distinguishes the two. */
const str = (r: Rec, key: string): string | null => {
  const v = r[key]
  return typeof v === 'string' ? v : v === null ? '' : null
}

const rows = <T>(
  records: readonly unknown[],
  what: string,
  read: (r: Rec) => T | null,
): Result<readonly T[]> =>
  collect(
    records.map((r) => {
      const value = isRecord(r) ? read(r) : null
      return value === null
        ? fail(`Unexpected ${what} row in the database: ${JSON.stringify(r)}`)
        : ok(value)
    }),
  )

const sample = (r: Rec): Sample | null => {
  const [ts, idleS] = [num(r, 'ts'), num(r, 'idle_s')]
  const [fgProcess, fgTitle] = [str(r, 'fg_process'), str(r, 'fg_title')]
  const [cursorProcess, cursorTitle] = [str(r, 'cursor_process'), str(r, 'cursor_title')]
  return ts === null || idleS === null || fgProcess === null || fgTitle === null
    ? null
    : cursorProcess === null || cursorTitle === null
      ? null
      : { ts, fgProcess, fgTitle, cursorProcess, cursorTitle, idleS }
}

export const samplesFrom = (records: readonly unknown[]): Result<readonly Sample[]> =>
  rows(records, 'sample', sample)

export interface StoredEntry {
  readonly blockStart: number
  readonly project: string
  readonly activity: string
  readonly confidence: number
  /** The label's project and activity, or null where nobody labelled the block. */
  readonly labelProject: string | null
  readonly labelActivity: string
}

const storedEntry = (r: Rec): StoredEntry | null => {
  const [blockStart, confidence] = [num(r, 'block_start'), num(r, 'confidence')]
  const [project, activity] = [str(r, 'project'), str(r, 'activity')]
  const labelProject = typeof r['label_project'] === 'string' ? r['label_project'] : null
  const labelActivity = str(r, 'label_activity') ?? ''
  return blockStart === null || confidence === null || project === null || activity === null
    ? null
    : { blockStart, project, activity, confidence, labelProject, labelActivity }
}

export const entriesFrom = (records: readonly unknown[]): Result<readonly StoredEntry[]> =>
  rows(records, 'entry', storedEntry)

const correction = (r: Rec): Correction | null => {
  const [evidence, project, activity] = [str(r, 'evidence'), str(r, 'project'), str(r, 'activity')]
  return evidence === null || project === null || activity === null
    ? null
    : { evidence, project, activity }
}

export const correctionsFrom = (records: readonly unknown[]): Result<readonly Correction[]> =>
  rows(records, 'correction', correction)

const prediction = (r: Rec): Prediction | null => {
  const [predicted, actual] = [str(r, 'predicted'), str(r, 'actual')]
  return predicted === null || actual === null ? null : { predicted, actual }
}

export const predictionsFrom = (records: readonly unknown[]): Result<readonly Prediction[]> =>
  rows(records, 'prediction', prediction)

/** The numbers SQL computes (block starts, counts); node:sqlite may return bigint. */
export const numbersFrom = (records: readonly unknown[], key: string): Result<readonly number[]> =>
  rows(records, key, (r) => {
    const v = r[key]
    return typeof v === 'number' ? v : typeof v === 'bigint' ? Number(v) : null
  })

/** @file The SQLite database: samples, the model's entries, and people's labels. */
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import {
  correctionsFrom,
  entriesFrom,
  numbersFrom,
  predictionsFrom,
  samplesFrom,
  type StoredEntry,
} from '../adapters/rows.ts'
import type { Correction, Entry, Labelled, Prediction, Sample, Snapshot } from '../domain/types.ts'
import { unwrap } from './unwrap.ts'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS samples (
  ts REAL NOT NULL,
  fg_process TEXT, fg_title TEXT,
  cursor_process TEXT, cursor_title TEXT,
  idle_s REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS samples_ts ON samples(ts);
CREATE TABLE IF NOT EXISTS entries (
  block_start REAL PRIMARY KEY,
  project TEXT, activity TEXT, confidence REAL, model TEXT, evidence TEXT
);
CREATE TABLE IF NOT EXISTS labels (
  block_start REAL PRIMARY KEY,
  project TEXT NOT NULL, activity TEXT
);
`

/** Same alignment as domain blockStart; blocks are summarized in order, so only newer ones can be missing. */
const UNSUMMARIZED = `
SELECT DISTINCT CAST(ts AS INTEGER) - CAST(ts AS INTEGER) % :size AS block_start FROM samples
WHERE ts >= COALESCE((SELECT MAX(block_start) FROM entries), 0) AND ts < :before
  AND CAST(ts AS INTEGER) - CAST(ts AS INTEGER) % :size NOT IN (SELECT block_start FROM entries)
ORDER BY block_start`

const ENTRIES = `
SELECT e.block_start, e.project, e.activity, e.confidence,
       l.project AS label_project, l.activity AS label_activity
FROM entries e LEFT JOIN labels l USING (block_start)
WHERE e.block_start >= :from AND e.block_start < :to ORDER BY e.block_start`

const CORRECTIONS = `
SELECT e.evidence, l.project, l.activity FROM labels l JOIN entries e USING (block_start)
WHERE e.project != l.project ORDER BY l.block_start DESC LIMIT :limit`

export interface Store {
  /** Writes return how many rows they changed. */
  readonly insertSample: (ts: number, s: Snapshot) => number
  readonly unsummarizedBlocks: (blockSeconds: number, before: number) => readonly number[]
  readonly samplesBetween: (from: number, to: number) => readonly Sample[]
  readonly insertEntry: (entry: Entry) => number
  readonly recentCorrections: (limit: number) => readonly Correction[]
  readonly entriesBetween: (from: number, to: number) => readonly StoredEntry[]
  readonly evidenceAt: (blockStart: number) => string | null
  readonly setLabel: (blockStart: number, label: Labelled) => number
  /** Labels every entry in [from, to). */
  readonly labelRange: (from: number, to: number, label: Labelled) => number
  /** Labels the unlabelled entries in [from, to) as the model had them. */
  readonly acceptRange: (from: number, to: number) => number
  readonly predictions: () => readonly Prediction[]
  readonly close: () => undefined
}

type Params = Readonly<Record<string, SQLInputValue>>

const LABEL_RANGE = `INSERT OR REPLACE INTO labels SELECT block_start, :project, :activity FROM entries
WHERE block_start >= :from AND block_start < :to`

const ACCEPT_RANGE = `INSERT OR IGNORE INTO labels SELECT block_start, project, activity FROM entries
WHERE block_start >= :from AND block_start < :to`

const PREDICTIONS = `SELECT e.project AS predicted, l.project AS actual
FROM entries e JOIN labels l USING (block_start)`

export const openStore = (path: string): Store => {
  const db = new DatabaseSync(path)
  db.exec(SCHEMA)
  const run = (sql: string, params: Params): number => Number(db.prepare(sql).run(params).changes)
  const all = (sql: string, params: Params = {}): readonly unknown[] => db.prepare(sql).all(params)
  return {
    insertSample: (ts, s) =>
      run('INSERT INTO samples VALUES (:ts, :fgp, :fgt, :cp, :ct, :idle)', {
        ts,
        fgp: s.fgProcess,
        fgt: s.fgTitle,
        cp: s.cursorProcess,
        ct: s.cursorTitle,
        idle: s.idleS,
      }),
    unsummarizedBlocks: (size, before) =>
      unwrap(numbersFrom(all(UNSUMMARIZED, { size, before }), 'block_start')),
    samplesBetween: (from, to) =>
      unwrap(
        samplesFrom(
          all('SELECT * FROM samples WHERE ts >= :from AND ts < :to ORDER BY ts', { from, to }),
        ),
      ),
    insertEntry: (e) =>
      run(
        'INSERT INTO entries VALUES (:start, :project, :activity, :confidence, :model, :evidence)',
        {
          start: e.blockStart,
          project: e.project,
          activity: e.activity,
          confidence: e.confidence,
          model: e.model,
          evidence: e.evidence,
        },
      ),
    recentCorrections: (limit) => unwrap(correctionsFrom(all(CORRECTIONS, { limit }))),
    entriesBetween: (from, to) => unwrap(entriesFrom(all(ENTRIES, { from, to }))),
    evidenceAt: (start) => {
      const row = db.prepare('SELECT evidence FROM entries WHERE block_start = ?').get(start)
      return typeof row?.['evidence'] === 'string' ? row['evidence'] : null
    },
    setLabel: (start, label) =>
      run('INSERT OR REPLACE INTO labels VALUES (:start, :project, :activity)', {
        start,
        ...label,
      }),
    labelRange: (from, to, label) => run(LABEL_RANGE, { from, to, ...label }),
    acceptRange: (from, to) => run(ACCEPT_RANGE, { from, to }),
    predictions: () => unwrap(predictionsFrom(all(PREDICTIONS))),
    close: () => {
      db.close()
      return undefined
    },
  }
}

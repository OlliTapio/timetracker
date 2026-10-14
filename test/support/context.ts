/** @file An in-memory database and config, plus helpers to fill it. */
import type { Context } from '../../src/app/context.ts'
import { DEFAULT_CONFIG, type Config } from '../../src/domain/config.ts'
import type { Snapshot } from '../../src/domain/types.ts'
import { openStore } from '../../src/infra/store.ts'
import { localParts } from '../../src/infra/time.ts'

/** Block-aligned (divisible by 900). */
export const T0 = 1_760_000_400

export const context = (overrides: Partial<Config> = {}): Context => ({
  config: { ...DEFAULT_CONFIG, projects: ['Sono', 'Job search'], ...overrides },
  store: openStore(':memory:'),
})

export const snapshot = (fg: string, extra: Partial<Snapshot> = {}): Snapshot => ({
  fgProcess: 'app.exe',
  fgTitle: fg,
  cursorProcess: '',
  cursorTitle: '',
  idleS: 0,
  ...extra,
})

/** Model entries, one per block from T0, with the given project and activity. */
export const entries = (ctx: Context, rows: readonly (readonly [string, string])[]): void => {
  rows.forEach(([project, activity], i) => {
    ctx.store.insertEntry({
      blockStart: T0 + i * 900,
      project,
      activity,
      confidence: 0.8,
      model: 'm',
      evidence: `evidence ${String(i)}`,
    })
  })
}

export const DAY = localParts(T0).day
export const hhmm = (block: number): string => localParts(T0 + block * 900).time

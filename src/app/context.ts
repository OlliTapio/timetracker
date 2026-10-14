/** @file What every command works against: the settings and the open database. */
import type { Config } from '../domain/config.ts'
import type { Store } from '../infra/store.ts'

export interface Context {
  readonly config: Config
  readonly store: Store
}

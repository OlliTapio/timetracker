/** @file config.toml (snake_case, already parsed) → Config. Unknown keys are errors, not ignored. */
import { DEFAULT_CONFIG, type Config } from '../domain/config.ts'
import { isRecord } from '../shared/collections.ts'
import { fail, ok, type Result } from '../shared/result.ts'

type Kind = 'string' | 'number' | 'integer' | 'strings'

const KEYS: Readonly<Record<string, readonly [keyof Config, Kind]>> = {
  projects: ['projects', 'strings'],
  db_path: ['dbPath', 'string'],
  sample_seconds: ['sampleSeconds', 'number'],
  idle_after_seconds: ['idleAfterSeconds', 'number'],
  /** Whole minutes keep every block start a whole second, as the database stores them. */
  block_minutes: ['blockMinutes', 'integer'],
  ollama_url: ['ollamaUrl', 'string'],
  model: ['model', 'string'],
  redact: ['redact', 'strings'],
}

const FITS: Readonly<Record<Kind, (value: unknown) => boolean>> = {
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && v > 0,
  integer: (v) => Number.isInteger(v) && typeof v === 'number' && v > 0,
  strings: (v) => Array.isArray(v) && v.every((s) => typeof s === 'string'),
}

const fits = (value: unknown, kind: Kind): boolean => FITS[kind](value)

const KIND_TEXT: Readonly<Record<Kind, string>> = {
  string: 'a string',
  number: 'a positive number',
  integer: 'a positive whole number',
  strings: 'a list of strings',
}

const problem = ([key, value]: readonly [string, unknown]): string | null => {
  const spec = KEYS[key]
  if (spec === undefined) return `Unknown setting "${key}". Known: ${Object.keys(KEYS).join(', ')}.`
  return fits(value, spec[1]) ? null : `Setting "${key}" must be ${KIND_TEXT[spec[1]]}.`
}

export const configFrom = (raw: unknown): Result<Config> => {
  if (!isRecord(raw)) return fail('The config file must be a TOML table of settings.')
  const entries = Object.entries(raw)
  const firstProblem = entries.map(problem).find((p) => p !== null)
  if (firstProblem !== undefined) return fail(firstProblem)
  return ok(
    entries.reduce<Config>((config, [key, value]) => {
      const spec = KEYS[key]
      return spec === undefined ? config : { ...config, [spec[0]]: value }
    }, DEFAULT_CONFIG),
  )
}

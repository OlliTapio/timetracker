/** @file Settings, their defaults, and the projects an entry may name. */
import { fail, ok, type Result } from '../shared/result.ts'

export interface Config {
  readonly projects: readonly string[]
  readonly dbPath: string
  readonly sampleSeconds: number
  readonly idleAfterSeconds: number
  readonly blockMinutes: number
  readonly ollamaUrl: string
  readonly model: string
  /** Regexes removed from window titles before they are stored. */
  readonly redact: readonly string[]
}

export const DEFAULT_CONFIG: Config = {
  projects: ['Work', 'Personal', 'Break'],
  dbPath: 'timetracker.db',
  sampleSeconds: 5,
  idleAfterSeconds: 120,
  blockMinutes: 15,
  ollamaUrl: 'http://localhost:11434',
  model: 'qwen2.5:7b-instruct',
  redact: [],
}

export const IDLE = 'Idle'
export const UNKNOWN = 'Unknown'

/** Every project an entry may name, `Idle` included. */
export const choices = (config: Config): readonly string[] => [...config.projects, IDLE]

export const checkProject = (project: string, config: Config): Result<string> =>
  choices(config).includes(project)
    ? ok(project)
    : fail(`Unknown project "${project}". Use one of: ${choices(config).join(', ')}.`)

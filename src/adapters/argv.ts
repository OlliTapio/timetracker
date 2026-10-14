/** @file Command-line arguments → the command to run. `today` comes in from the shell. */
import { fail, ok, type Result } from '../shared/result.ts'

export type Command =
  | { readonly kind: 'help' }
  | { readonly kind: 'run' }
  | { readonly kind: 'summarize' }
  | { readonly kind: 'review'; readonly day: string }
  | {
      readonly kind: 'label'
      readonly day: string
      readonly time: string
      readonly project: string
      readonly activity: string
    }
  | { readonly kind: 'accept'; readonly day: string }
  | { readonly kind: 'eval' }
  | { readonly kind: 'mcp' }

export interface Invocation {
  /** Null when not given: TIMETRACKER_CONFIG, then config.toml. */
  readonly configPath: string | null
  readonly command: Command
}

export const DAY = /^\d{4}-\d{2}-\d{2}$/
export const TIME = /^\d{2}:\d{2}$/

interface Split {
  readonly options: Readonly<Record<string, string>>
  readonly positional: readonly string[]
}

const VALUE_OPTIONS = new Set(['--config', '--day'])

const split = (args: readonly string[]): Result<Split> => {
  const [head, ...afterHead] = args
  if (head === undefined) return ok({ options: {}, positional: [] })
  if (!head.startsWith('--')) {
    const tail = split(afterHead)
    return tail.ok ? ok({ ...tail.value, positional: [head, ...tail.value.positional] }) : tail
  }
  const [next, ...rest] = afterHead
  if (!VALUE_OPTIONS.has(head)) return fail(`Unknown option ${head}. Run \`timetracker help\`.`)
  if (next === undefined) return fail(`${head} needs a value.`)
  const tail = split(rest)
  return tail.ok ? ok({ ...tail.value, options: { ...tail.value.options, [head]: next } }) : tail
}

const day = (value: string): Result<string> =>
  DAY.test(value) ? ok(value) : fail(`"${value}" is not a day. Use YYYY-MM-DD.`)

type Parse = (args: readonly string[], dayOption: string) => Result<Command>

const onDay =
  (kind: 'review' | 'accept'): Parse =>
  ([given], dayOption) => {
    const chosen = day(given ?? dayOption)
    return chosen.ok ? ok({ kind, day: chosen.value }) : chosen
  }

const label: Parse = ([time, project, activity = ''], dayOption) => {
  if (time === undefined || project === undefined) {
    return fail('Usage: timetracker label <HH:MM> <project> [activity] [--day YYYY-MM-DD]')
  }
  if (!TIME.test(time)) return fail(`"${time}" is not a time. Use HH:MM.`)
  const chosen = day(dayOption)
  return chosen.ok ? ok({ kind: 'label', day: chosen.value, time, project, activity }) : chosen
}

const COMMANDS: Readonly<Record<string, Parse>> = {
  help: () => ok({ kind: 'help' }),
  run: () => ok({ kind: 'run' }),
  summarize: () => ok({ kind: 'summarize' }),
  eval: () => ok({ kind: 'eval' }),
  mcp: () => ok({ kind: 'mcp' }),
  review: onDay('review'),
  accept: onDay('accept'),
  label,
}

const command = (positional: readonly string[], dayOption: string): Result<Command> => {
  const [name = 'help', ...args] = positional
  const parse = COMMANDS[name]
  return parse === undefined
    ? fail(`Unknown command "${name}". Run \`timetracker help\`.`)
    : parse(args, dayOption)
}

export const parseArgs = (args: readonly string[], today: string): Result<Invocation> => {
  if (args.some((a) => a === '--help' || a === '-h')) {
    return ok({ configPath: null, command: { kind: 'help' } })
  }
  const parts = split(args)
  if (!parts.ok) return parts
  const parsed = command(parts.value.positional, parts.value.options['--day'] ?? today)
  return parsed.ok
    ? ok({ configPath: parts.value.options['--config'] ?? null, command: parsed.value })
    : parsed
}

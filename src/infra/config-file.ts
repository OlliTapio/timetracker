/** @file Reading config.toml, and compiling its redact patterns. */
import { existsSync, readFileSync } from 'node:fs'
import { parse } from 'smol-toml'
import { configFrom } from '../adapters/config.ts'
import { DEFAULT_CONFIG, type Config } from '../domain/config.ts'
import { errorMessage } from '../shared/errors.ts'
import { unwrap } from './unwrap.ts'

/** A missing file means the defaults; a broken one is an error naming the file. */
export const loadConfig = (path: string): Config => {
  if (!existsSync(path)) return DEFAULT_CONFIG
  try {
    return unwrap(configFrom(parse(readFileSync(path, 'utf8'))))
  } catch (err) {
    throw new Error(`${path}: ${errorMessage(err)}`, { cause: err })
  }
}

export const compilePatterns = (patterns: readonly string[]): readonly RegExp[] =>
  patterns.map((pattern) => {
    try {
      return new RegExp(pattern, 'g')
    } catch (err) {
      throw new Error(`redact pattern ${pattern} is not a valid regex: ${errorMessage(err)}`, {
        cause: err,
      })
    }
  })

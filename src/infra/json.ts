/** @file JSON from text, as `unknown` for an adapter to check. */
import { fail, ok, type Result } from '../shared/result.ts'
import { errorMessage } from '../shared/errors.ts'

export const parseJson = (text: string): Result<unknown> => {
  try {
    const parsed: unknown = JSON.parse(text)
    return ok(parsed)
  } catch (err) {
    return fail(errorMessage(err))
  }
}

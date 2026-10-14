/** @file Where a core Result becomes an exception: the shell's side of the boundary. */
import type { Result } from '../shared/result.ts'

export const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) throw new Error(result.error)
  return result.value
}

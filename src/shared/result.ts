/** @file Failure as a value: the functional core returns a Result where the shell would throw. */

export type Result<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string }

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })

export const fail = <T = never>(error: string): Result<T> => ({ ok: false, error })

/** The first failure, or every value in order. */
export const collect = <T>(results: readonly Result<T>[]): Result<readonly T[]> =>
  results.reduce<Result<readonly T[]>>(
    (acc, next) => (!acc.ok ? acc : next.ok ? ok([...acc.value, next.value]) : fail(next.error)),
    ok([]),
  )

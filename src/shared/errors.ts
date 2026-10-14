/** @file Reading caught values without casting them. */

export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)

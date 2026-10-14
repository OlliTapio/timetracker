/** @file Window titles can carry email subjects and document names; strip them before storage. */
import type { Snapshot } from './types.ts'

export const redact = (snapshot: Snapshot, patterns: readonly RegExp[]): Snapshot => {
  const clean = (title: string): string =>
    patterns.reduce((text, pattern) => text.replace(pattern, '[redacted]'), title)
  return { ...snapshot, fgTitle: clean(snapshot.fgTitle), cursorTitle: clean(snapshot.cursorTitle) }
}

/** @file A block's evidence as the text the model reads; it is also stored with the entry. */
import type { Evidence, WindowTime } from '../domain/blocks.ts'

const minutes = (seconds: number): string => (seconds / 60).toFixed(1)

const windowLines = (windows: readonly WindowTime[], top: number): readonly string[] =>
  windows.slice(0, top).map((w) => `- ${minutes(w.seconds)}  ${w.process} | ${w.title}`)

export const evidenceText = (ev: Evidence, top = 8): string =>
  [
    `Active ${minutes(ev.activeS)} min, idle ${minutes(ev.idleS)} min.`,
    ...(ev.focus.length > 0 ? ['Focused windows (minutes):', ...windowLines(ev.focus, top)] : []),
    ...(ev.cursorOnly.length > 0
      ? [
          'Cursor over another window, e.g. reading or scrolling (minutes):',
          ...windowLines(ev.cursorOnly, top),
        ]
      : []),
  ].join('\n')

/** @file The daily review, the accuracy summary and the timesheet CSV. */
import type { Accuracy, TimesheetDay } from '../domain/report.ts'
import type { ReviewRow } from '../domain/types.ts'

export const reviewLines = (rows: readonly ReviewRow[]): readonly string[] =>
  rows.map((r) => {
    const label = r.label === null ? '' : `  -> ${r.label.project}: ${r.label.activity}`
    return `${r.time}  ${r.project.padEnd(12)} ${r.activity}  (${r.confidence.toFixed(1)})${label}`
  })

export const accuracyText = (a: Accuracy): string =>
  a.accuracy === null
    ? 'No labelled blocks yet. Review a day and `label` or `accept` its entries.'
    : [
        `Accuracy ${(a.accuracy * 100).toFixed(0)}% over ${String(a.blocks)} labelled blocks.`,
        ...(a.topErrors.length > 0 ? ['Most common mix-ups (actual -> model said):'] : []),
        ...a.topErrors.map((e) => `  ${e.actual} -> ${e.predicted}: ${String(e.count)}`),
      ].join('\n')

const csvField = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value

/** One row per day: date, hours, the distinct activities in order. */
export const timesheetCsv = (days: readonly TimesheetDay[]): string =>
  [
    'date,hours,activities',
    ...days.map((d) =>
      [d.day, d.hours.toFixed(2), d.activities.join('; ')].map(csvField).join(','),
    ),
  ]
    .map((line) => `${line}\r\n`)
    .join('')

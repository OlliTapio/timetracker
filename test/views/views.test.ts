import { expect, test } from 'vitest'
import { evidenceText } from '../../src/views/evidence.ts'
import { buildMessages } from '../../src/views/prompt.ts'
import { accuracyText, reviewLines, timesheetCsv } from '../../src/views/report.ts'

test('evidenceText lists focus and cursor-only windows in minutes', () => {
  const window = { process: 'code.exe', title: 'pr.py', seconds: 90 }
  expect(evidenceText({ activeS: 90, idleS: 0, focus: [window], cursorOnly: [window] })).toBe(
    [
      'Active 1.5 min, idle 0.0 min.',
      'Focused windows (minutes):',
      '- 1.5  code.exe | pr.py',
      'Cursor over another window, e.g. reading or scrolling (minutes):',
      '- 1.5  code.exe | pr.py',
    ].join('\n'),
  )
  expect(evidenceText({ activeS: 0, idleS: 900, focus: [], cursorOnly: [] })).toBe(
    'Active 0.0 min, idle 15.0 min.',
  )
})

test('buildMessages puts corrections between the instructions and the evidence', () => {
  const messages = buildMessages('now', ['Sono', 'Idle'], 15, [
    { evidence: 'then', project: 'Sono', activity: 'review' },
  ])
  expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user'])
  expect(messages[0]?.content).toContain('Projects: Sono, Idle.')
  expect(messages[2]?.content).toBe('{"project":"Sono","activity":"review","confidence":1}')
  expect(messages[3]?.content).toBe('now')
})

test('reviewLines shows the label next to the entry', () => {
  const row = { time: '09:00', project: 'Sono', activity: 'review', confidence: 0.84 }
  expect(
    reviewLines([
      { ...row, label: null },
      { ...row, label: { project: 'Job search', activity: 'CV' } },
    ]),
  ).toEqual([
    '09:00  Sono         review  (0.8)',
    '09:00  Sono         review  (0.8)  -> Job search: CV',
  ])
})

test('accuracyText', () => {
  expect(accuracyText({ blocks: 0, accuracy: null, topErrors: [] })).toMatch(/No labelled blocks/)
  expect(
    accuracyText({
      blocks: 4,
      accuracy: 0.75,
      topErrors: [{ actual: 'Sono', predicted: 'Idle', count: 1 }],
    }),
  ).toBe(
    'Accuracy 75% over 4 labelled blocks.\nMost common mix-ups (actual -> model said):\n  Sono -> Idle: 1',
  )
  expect(accuracyText({ blocks: 1, accuracy: 1, topErrors: [] })).toBe(
    'Accuracy 100% over 1 labelled blocks.',
  )
})

test('timesheetCsv quotes fields that need it', () => {
  expect(
    timesheetCsv([{ day: '2026-10-01', hours: 0.75, activities: ['PR review', 'say "hi", then'] }]),
  ).toBe('date,hours,activities\r\n2026-10-01,0.75,"PR review; say ""hi"", then"\r\n')
})

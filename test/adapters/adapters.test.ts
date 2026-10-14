import { describe, expect, test } from 'vitest'
import { parseArgs } from '../../src/adapters/argv.ts'
import { configFrom } from '../../src/adapters/config.ts'
import { chatContent, guessFrom } from '../../src/adapters/guess.ts'
import { entriesFrom, numbersFrom, samplesFrom } from '../../src/adapters/rows.ts'
import { DEFAULT_CONFIG } from '../../src/domain/config.ts'
import { fail, ok } from '../../src/shared/result.ts'

describe('guessFrom', () => {
  const choices = ['Sono', 'Idle']

  test('keeps a known project and clamps confidence', () => {
    expect(guessFrom(ok({ project: 'Idle', activity: 'x', confidence: 3 }), '', choices)).toEqual({
      project: 'Idle',
      activity: 'x',
      confidence: 1,
    })
  })

  test('marks an unknown project or a malformed reply Unknown', () => {
    expect(guessFrom(ok({ project: 'Golf' }), '', choices)).toEqual({
      project: 'Unknown',
      activity: '',
      confidence: 0,
    })
    expect(guessFrom(fail('bad json'), 'not json', choices)).toEqual({
      project: 'Unknown',
      activity: 'not json',
      confidence: 0,
    })
  })
})

test('chatContent reads message.content', () => {
  expect(chatContent({ message: { content: '{}' } })).toEqual(ok('{}'))
  expect(chatContent({ error: 'model not found' }).ok).toBe(false)
})

describe('configFrom', () => {
  test('maps snake_case keys over the defaults', () => {
    const result = configFrom({ projects: ['A'], ollama_url: 'http://pc:11434', block_minutes: 30 })
    expect(result).toEqual(
      ok({ ...DEFAULT_CONFIG, projects: ['A'], ollamaUrl: 'http://pc:11434', blockMinutes: 30 }),
    )
  })

  test.each([
    [{ porjects: ['A'] }, /Unknown setting "porjects"/],
    [{ projects: 'A' }, /"projects" must be a list of strings/],
    [{ sample_seconds: 0 }, /"sample_seconds" must be a positive number/],
    [{ model: 7 }, /"model" must be a string/],
    [[], /TOML table/],
  ])('rejects %j', (raw, message) => {
    const result = configFrom(raw)
    expect(result.ok ? '' : result.error).toMatch(message)
  })
})

describe('parseArgs', () => {
  const today = '2026-10-14'

  test.each([
    [[], { kind: 'help' }],
    [['--help'], { kind: 'help' }],
    [['run'], { kind: 'run' }],
    [['summarize'], { kind: 'summarize' }],
    [['eval'], { kind: 'eval' }],
    [['mcp'], { kind: 'mcp' }],
    [['review'], { kind: 'review', day: today }],
    [['accept', '2026-10-01'], { kind: 'accept', day: '2026-10-01' }],
    [
      ['label', '09:15', 'Sono', 'PR review', '--day', '2026-10-01'],
      { kind: 'label', day: '2026-10-01', time: '09:15', project: 'Sono', activity: 'PR review' },
    ],
    [
      ['label', '09:15', 'Sono'],
      { kind: 'label', day: today, time: '09:15', project: 'Sono', activity: '' },
    ],
  ])('%j', (args, command) => {
    expect(parseArgs(args, today)).toEqual(ok({ configPath: null, command }))
  })

  test('takes --config anywhere', () => {
    expect(parseArgs(['--config', 'x.toml', 'eval'], today)).toEqual(
      ok({ configPath: 'x.toml', command: { kind: 'eval' } }),
    )
  })

  test.each([
    [['golf'], /Unknown command "golf"/],
    [['eval', '--verbose'], /Unknown option --verbose/],
    [['eval', '--config'], /--config needs a value/],
    [['review', 'yesterday'], /not a day/],
    [['label', '9:15', 'Sono'], /not a time/],
    [['label', '09:15'], /Usage: timetracker label/],
    [['label', '09:15', 'Sono', '--day', 'x'], /not a day/],
  ])('rejects %j', (args, message) => {
    const result = parseArgs(args, today)
    expect(result.ok ? '' : result.error).toMatch(message)
  })
})

describe('rows', () => {
  test('reads NULL text as empty and bigint numbers as numbers', () => {
    const row = {
      ts: 1,
      fg_process: null,
      fg_title: 't',
      cursor_process: '',
      cursor_title: '',
      idle_s: 0,
    }
    expect(samplesFrom([row])).toEqual(
      ok([{ ts: 1, fgProcess: '', fgTitle: 't', cursorProcess: '', cursorTitle: '', idleS: 0 }]),
    )
    expect(numbersFrom([{ n: 2n }, { n: 3 }], 'n')).toEqual(ok([2, 3]))
  })

  test('reports a row of the wrong shape', () => {
    expect(samplesFrom([{ ts: 'x' }]).ok).toBe(false)
    expect(samplesFrom([{ ts: 1, idle_s: 0, fg_process: '', fg_title: '' }]).ok).toBe(false)
    expect(entriesFrom([42]).ok).toBe(false)
    expect(numbersFrom([{ n: 'x' }], 'n').ok).toBe(false)
  })
})

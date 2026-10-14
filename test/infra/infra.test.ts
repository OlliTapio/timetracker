import { mkdtempSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { DEFAULT_CONFIG } from '../../src/domain/config.ts'
import { compilePatterns, loadConfig } from '../../src/infra/config-file.ts'
import { parseJson } from '../../src/infra/json.ts'
import { ollamaChat } from '../../src/infra/ollama.ts'
import { windowsSampler } from '../../src/infra/sampler.ts'
import { every } from '../../src/infra/schedule.ts'
import { openStore } from '../../src/infra/store.ts'
import { dayRange, localParts, localTs, today } from '../../src/infra/time.ts'

afterEach(() => {
  vi.useRealTimers()
})

const file = (name: string, text: string): string => {
  const path = join(mkdtempSync(join(tmpdir(), 'tt-')), name)
  writeFileSync(path, text)
  return path
}

describe('config file', () => {
  test('missing means defaults; present overrides', () => {
    expect(loadConfig(join(tmpdir(), 'no-such-config.toml'))).toEqual(DEFAULT_CONFIG)
    const path = file('config.toml', 'projects = ["A"]\nredact = [\'\\S+@\\S+\']\n')
    expect(loadConfig(path)).toEqual({ ...DEFAULT_CONFIG, projects: ['A'], redact: ['\\S+@\\S+'] })
  })

  test('errors name the file', () => {
    expect(() => loadConfig(file('bad.toml', 'projects = "A"'))).toThrow(/bad\.toml: Setting/)
    expect(() => loadConfig(file('broken.toml', 'projects = ['))).toThrow(/broken\.toml/)
  })

  test('redact patterns compile, or name the bad one', () => {
    expect(compilePatterns(['a+'])[0]?.flags).toBe('g')
    expect(() => compilePatterns(['('])).toThrow(/redact pattern \( is not a valid regex/)
  })
})

test('the database keeps samples across a reopen', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'tt-')), 't.db')
  const first = openStore(path)
  first.insertSample(1, {
    fgProcess: 'a',
    fgTitle: 'b',
    cursorProcess: '',
    cursorTitle: '',
    idleS: 0,
  })
  first.close()
  const second = openStore(path)
  expect(second.samplesBetween(0, 2)).toHaveLength(1)
  second.close()
})

test('parseJson returns a Result', () => {
  expect(parseJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } })
  expect(parseJson('nope').ok).toBe(false)
})

describe('local time', () => {
  test('round-trips a local day and time', () => {
    const ts = localTs('2026-10-14', '09:15')
    expect(localParts(ts)).toEqual({ day: '2026-10-14', time: '09:15' })
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('a range covers whole days, both ends included', () => {
    const [from, to] = dayRange('2026-10-14', '2026-10-15')
    expect(localParts(from)).toEqual({ day: '2026-10-14', time: '00:00' })
    expect(localParts(to)).toEqual({ day: '2026-10-16', time: '00:00' })
  })

  test('rejects a date that does not exist', () => {
    expect(() => localTs('2026-13-01', '09:00')).toThrow(/not a valid local date/)
  })
})

describe('ollama', () => {
  const serve = async (status: number, body: string) => {
    const requests: unknown[] = []
    const server = createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => chunks.push(c))
      req.on('end', () => {
        requests.push(JSON.parse(Buffer.concat(chunks).toString()))
        res.writeHead(status).end(body)
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo
    return { url: `http://127.0.0.1:${String(port)}`, requests, close: () => server.close() }
  }

  test('sends the chat in JSON mode and returns the content', async () => {
    const ollama = await serve(200, '{"message": {"content": "{}"}}')
    const reply = await ollamaChat(ollama.url, 'qwen')([{ role: 'user', content: 'hi' }])
    ollama.close()
    expect(reply).toBe('{}')
    expect(ollama.requests[0]).toMatchObject({ model: 'qwen', format: 'json', stream: false })
  })

  test('explains an error status and an unreachable server', async () => {
    const ollama = await serve(404, 'model "qwen" not found')
    await expect(ollamaChat(ollama.url, 'qwen')([])).rejects.toThrow(/answered 404: model "qwen"/)
    ollama.close()
    await expect(ollamaChat(ollama.url, 'qwen', 2000)([])).rejects.toThrow(/Cannot reach Ollama/)
  })
})

test('every waits after each run, survives failures, and stops', async () => {
  vi.useFakeTimers()
  const errors: unknown[] = []
  const runs: number[] = []
  const repeating = every(
    1000,
    () => {
      runs.push(runs.length)
      if (runs.length === 2) throw new Error('second run fails')
    },
    (err) => errors.push(err),
  )
  await vi.advanceTimersByTimeAsync(2500)
  repeating.stop()
  repeating.stop()
  await vi.advanceTimersByTimeAsync(5000)
  expect(runs).toEqual([0, 1, 2])
  expect(errors).toHaveLength(1)
})

test.runIf(process.platform === 'win32')('the Windows sampler reads a snapshot', () => {
  const snap = windowsSampler()()
  expect(typeof snap.fgProcess).toBe('string')
  expect(snap.idleS).toBeGreaterThanOrEqual(0)
})

test.runIf(process.platform !== 'win32')('the sampler refuses other platforms', () => {
  expect(() => windowsSampler()).toThrow(/needs Windows/)
})

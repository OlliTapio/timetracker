/** @file The model's reply → a Guess. A bad reply still yields an entry, marked Unknown. */
import { UNKNOWN } from '../domain/config.ts'
import type { Guess } from '../domain/types.ts'
import { isRecord } from '../shared/collections.ts'
import type { Result } from '../shared/result.ts'

/** `parsed` is the reply run through JSON.parse; `raw` is kept as the activity when that failed. */
export const guessFrom = (
  parsed: Result<unknown>,
  raw: string,
  choices: readonly string[],
): Guess => {
  if (!parsed.ok || !isRecord(parsed.value)) {
    return { project: UNKNOWN, activity: raw.slice(0, 80), confidence: 0 }
  }
  const { project, activity, confidence } = parsed.value
  return {
    project: typeof project === 'string' && choices.includes(project) ? project : UNKNOWN,
    activity: typeof activity === 'string' ? activity : '',
    confidence: typeof confidence === 'number' ? Math.min(1, Math.max(0, confidence)) : 0,
  }
}

/** Ollama's /api/chat response → the message text. */
export const chatContent = (body: unknown): Result<string> => {
  const message = isRecord(body) ? body['message'] : undefined
  const content = isRecord(message) ? message['content'] : undefined
  return typeof content === 'string'
    ? { ok: true, value: content }
    : { ok: false, error: 'Ollama replied without message.content. Is the model name right?' }
}

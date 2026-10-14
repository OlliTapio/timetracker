/** @file One chat call to Ollama's /api/chat, JSON mode, temperature 0. */
import { chatContent } from '../adapters/guess.ts'
import type { ChatMessage } from '../domain/types.ts'
import { errorMessage } from '../shared/errors.ts'
import { unwrap } from './unwrap.ts'

export type Chat = (messages: readonly ChatMessage[]) => Promise<string>

export const ollamaChat =
  (url: string, model: string, timeoutMs = 120_000): Chat =>
  async (messages) => {
    const body = JSON.stringify({
      model,
      messages,
      format: 'json',
      stream: false,
      options: { temperature: 0 },
    })
    const response = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    }).catch((err: unknown) => {
      throw new Error(
        `Cannot reach Ollama at ${url} (${errorMessage(err)}). Is it running? Check ollama_url in config.toml.`,
        { cause: err },
      )
    })
    if (!response.ok) {
      throw new Error(
        `Ollama at ${url} answered ${String(response.status)}: ${await response.text()}`,
      )
    }
    const json: unknown = await response.json()
    return unwrap(chatContent(json))
  }

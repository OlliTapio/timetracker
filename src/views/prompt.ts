/** @file The chat the model gets for one block: instructions, past corrections, the evidence. */
import type { ChatMessage, Correction } from '../domain/types.ts'

const system = (minutes: number, choices: readonly string[]): string =>
  [
    `You write time-tracking entries. Given what was on screen during one ${String(minutes)}-minute block, pick the project the person mostly worked on and describe the activity in under 10 words.`,
    `Projects: ${choices.join(', ')}. Use "Idle" if they were mostly away.`,
    'Focused windows are where typing went; cursor-only windows are usually reading.',
    'Answer as JSON: {"project": ..., "activity": ..., "confidence": 0-1}',
  ].join('\n')

export const buildMessages = (
  evidence: string,
  choices: readonly string[],
  minutes: number,
  corrections: readonly Correction[],
): readonly ChatMessage[] => [
  { role: 'system', content: system(minutes, choices) },
  ...corrections.flatMap((c): readonly ChatMessage[] => [
    { role: 'user', content: c.evidence },
    {
      role: 'assistant',
      content: JSON.stringify({ project: c.project, activity: c.activity, confidence: 1 }),
    },
  ]),
  { role: 'user', content: evidence },
]

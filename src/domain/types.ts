/** @file The records the tracker works with. Times are unix seconds; day and time strings are local. */

/** What is on screen at one moment: titles and process names only, never content. */
export interface Snapshot {
  readonly fgProcess: string
  readonly fgTitle: string
  readonly cursorProcess: string
  readonly cursorTitle: string
  readonly idleS: number
}

export interface Sample extends Snapshot {
  readonly ts: number
}

/** The model's (or a person's) answer for one block. */
export interface Guess {
  readonly project: string
  readonly activity: string
  readonly confidence: number
}

export interface Entry extends Guess {
  readonly blockStart: number
  readonly model: string
  readonly evidence: string
}

export interface Labelled {
  readonly project: string
  readonly activity: string
}

/** A block where a person's label disagrees with the model: a few-shot example. */
export interface Correction extends Labelled {
  readonly evidence: string
}

/** An entry next to its label, if any, as the daily review shows it. */
export interface ReviewRow extends Guess {
  readonly time: string
  readonly label: Labelled | null
}

/** An entry with its label applied: what reports and exports count. */
export interface EffectiveEntry {
  readonly day: string
  readonly time: string
  readonly project: string
  readonly activity: string
  readonly confidence: number
  readonly corrected: boolean
}

export interface Prediction {
  readonly predicted: string
  readonly actual: string
}

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

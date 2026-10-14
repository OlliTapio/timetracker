/** @file Repeating work: the next run starts `ms` after the previous one finishes, failures included. */
import { Cell } from './cell.ts'

export interface Repeating {
  readonly stop: () => undefined
}

export const every = (
  ms: number,
  task: () => unknown,
  onError: (err: unknown) => unknown,
): Repeating => {
  const timer = new Cell<NodeJS.Timeout | null>(null)
  const stopped = new Cell(false)
  const tick = (): undefined => {
    if (stopped.get()) return undefined
    void Promise.resolve()
      .then(task)
      .catch(onError)
      .finally(() => {
        if (!stopped.get()) timer.swap(setTimeout(tick, ms))
      })
    return undefined
  }
  tick()
  return {
    stop: () => {
      stopped.swap(true)
      const pending = timer.get()
      if (pending !== null) clearTimeout(pending)
      return undefined
    },
  }
}

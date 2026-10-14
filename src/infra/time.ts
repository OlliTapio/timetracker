/** @file The clock and local time zone: unix seconds ↔ local day (YYYY-MM-DD) and time (HH:MM). */

export const nowSeconds = (): number => Date.now() / 1000

const pad = (n: number): string => String(n).padStart(2, '0')

export interface LocalParts {
  readonly day: string
  readonly time: string
}

export const localParts = (ts: number): LocalParts => {
  const d = new Date(ts * 1000)
  return {
    day: `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

export const today = (): string => localParts(nowSeconds()).day

/** Unix seconds of a local day and time; throws for a date that does not exist. */
export const localTs = (day: string, time: string): number => {
  const ms = new Date(`${day}T${time}`).getTime()
  if (Number.isNaN(ms)) throw new Error(`"${day} ${time}" is not a valid local date and time.`)
  return ms / 1000
}

/** From the start of `from` to the start of the day after `to`, so both days are included. */
export const dayRange = (from: string, to: string): readonly [number, number] => {
  const end = new Date(localTs(to, '00:00') * 1000)
  const next = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)
  return [localTs(from, '00:00'), next.getTime() / 1000]
}

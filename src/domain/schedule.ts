/**
 * When the next dose falls, from the last logged dose and the medication's interval. This is
 * the user's own schedule restated, not advice: it never suggests a dose or a change.
 */

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

export function nextDueAt(lastDoseAt: number | null, intervalDays: number): number | null {
  if (lastDoseAt === null || !(intervalDays > 0)) return null
  return lastDoseAt + intervalDays * DAY_MS
}

const MINUTE_MS = 60_000

export type DueState =
  | { kind: 'later'; days: number }
  | { kind: 'soon'; hours: number }
  | { kind: 'minutes'; minutes: 15 | 30 | 45 }
  | { kind: 'due' }
  | { kind: 'late'; days: number }

/**
 * Where `now` sits against the due time: whole days a day or more ahead, hours inside a day,
 * then quarter hours inside the last 45 minutes. A quarter hour rounds up, so "45 minutes"
 * covers 31 to 45 and the label never says less time is left than there is; 46 to 59 minutes
 * reads as about an hour. Up to a day after the due time reads as due, because people dose at
 * different times of day; beyond that, whole days late.
 */
export function dueState(dueAt: number, now: number): DueState {
  const diff = dueAt - now
  if (diff >= DAY_MS) return { kind: 'later', days: Math.round(diff / DAY_MS) }
  if (diff > 45 * MINUTE_MS) {
    return { kind: 'soon', hours: Math.min(23, Math.max(1, Math.round(diff / HOUR_MS))) }
  }
  if (diff > 0) {
    const quarters = Math.ceil(diff / (15 * MINUTE_MS))
    return { kind: 'minutes', minutes: (quarters * 15) as 15 | 30 | 45 }
  }
  if (-diff < DAY_MS) return { kind: 'due' }
  return { kind: 'late', days: Math.floor(-diff / DAY_MS) }
}

/**
 * How full the countdown ring is, 1 to 0. It zooms in as the label's unit changes: over the
 * whole interval while days remain, over the last day once hours remain, and over the last
 * hour once minutes remain. Otherwise the last day of a weekly dose would be a sliver of the
 * ring and its last hour a dot. It never goes below 0 once the dose is due or late.
 */
export function remainingFraction(dueAt: number, intervalDays: number, now: number): number {
  if (!(intervalDays > 0)) return 0
  const diff = dueAt - now
  const span = diff >= DAY_MS ? intervalDays * DAY_MS : diff > 45 * MINUTE_MS ? DAY_MS : HOUR_MS
  return Math.min(1, Math.max(0, diff / span))
}

export interface SyringeReading {
  ml: number
  /** Units on a U-100 insulin syringe, the kind compounded vials are drawn with. */
  units: number
}

/** Volume and U-100 units for a dose drawn from a vial of known strength. */
export function syringeReading(doseMg: number, mgPerMl: number): SyringeReading {
  if (!(doseMg > 0) || !(mgPerMl > 0)) throw new RangeError('Dose and strength must be positive.')
  const ml = doseMg / mgPerMl
  return { ml, units: ml * 100 }
}

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

export type DueState =
  | { kind: 'later'; days: number }
  | { kind: 'soon'; hours: number }
  | { kind: 'due' }
  | { kind: 'late'; days: number }

/**
 * Where `now` sits against the due time. Within 24 hours either side reads as due soon or due
 * now, because people dose at different times of day; beyond that, whole days.
 */
export function dueState(dueAt: number, now: number): DueState {
  const diff = dueAt - now
  if (diff >= DAY_MS) return { kind: 'later', days: Math.round(diff / DAY_MS) }
  if (diff > 0) return { kind: 'soon', hours: Math.max(1, Math.round(diff / HOUR_MS)) }
  if (-diff < DAY_MS) return { kind: 'due' }
  return { kind: 'late', days: Math.floor(-diff / DAY_MS) }
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

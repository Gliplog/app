import { REPEATING_AHEAD } from './reminders'

const DAY_MS = 86_400_000

/**
 * The days Gliplog reminds about: for a daily medicine the next week, starting today when the
 * last dose is days old, so reminders do not stop; for a longer interval the one day the next
 * dose falls due.
 */
export function dueDaysFor(input: { dueAt: number | null; intervalDays: number; now: number }): {
  days: number[]
  repeating: boolean
} {
  const { dueAt, intervalDays, now } = input
  if (dueAt === null || !(intervalDays > 0)) return { days: [], repeating: false }
  if (intervalDays === 1) {
    // From today if the last logged dose is days old, so reminders do not stop after a week.
    const start = Math.max(0, Math.floor((now - dueAt) / DAY_MS))
    const days = Array.from({ length: REPEATING_AHEAD + 1 }, (_, k) => dueAt + (start + k) * DAY_MS)
    return { days, repeating: true }
  }
  return { days: [dueAt], repeating: false }
}

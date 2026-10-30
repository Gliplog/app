import type { Trial, TrialArm } from './catalog'

/**
 * Weight progress from a starting point, and how it sits beside published trial results.
 * Trials report the mean change at one endpoint week, measured from the first dose; the user's
 * progress is measured the same way so the two can be read side by side.
 */

const WEEK_MS = 7 * 86_400_000

export interface WeightPoint {
  /** Epoch milliseconds. */
  at: number
  kg: number
}

export interface Baseline extends WeightPoint {
  /**
   * How the starting weight was chosen: the last weigh-in at or before the first dose (as in a
   * trial), the first weigh-in after it when none came before, or the first weigh-in when no
   * dose is logged yet.
   */
  basis: 'before-first-dose' | 'after-first-dose' | 'no-doses'
  /** Week 0: the first dose, or the starting weigh-in when there are no doses. */
  startAt: number
}

/** The starting weight for progress, or null when nothing has been weighed. */
export function baselineFor(
  weights: readonly WeightPoint[],
  firstDoseAt: number | null,
): Baseline | null {
  if (!weights.length) return null
  const sorted = [...weights].sort((a, b) => a.at - b.at)
  if (firstDoseAt === null) return { ...sorted[0]!, basis: 'no-doses', startAt: sorted[0]!.at }
  const before = sorted.filter((w) => w.at <= firstDoseAt)
  if (before.length) {
    return { ...before[before.length - 1]!, basis: 'before-first-dose', startAt: firstDoseAt }
  }
  return { ...sorted[0]!, basis: 'after-first-dose', startAt: firstDoseAt }
}

export interface ProgressPoint extends WeightPoint {
  /** Weeks since the baseline's start (the first dose), fractional. */
  weeks: number
  changeKg: number
  changePercent: number
}

/** Weigh-ins from the baseline onward, oldest first, each as a change from the baseline. */
export function progressSeries(
  weights: readonly WeightPoint[],
  baseline: Baseline,
): ProgressPoint[] {
  return [...weights]
    .filter((w) => w.at >= baseline.at)
    .sort((a, b) => a.at - b.at)
    .map((w) => ({
      ...w,
      weeks: Math.max(0, (w.at - baseline.startAt) / WEEK_MS),
      changeKg: w.kg - baseline.kg,
      changePercent: ((w.kg - baseline.kg) / baseline.kg) * 100,
    }))
}

export interface TrialComparison {
  trial: Trial
  /**
   * The user's weigh-in to set beside the endpoint: the latest one up to the trial's endpoint
   * week, so a user past the endpoint is compared at the same point in time as the trial.
   */
  user: ProgressPoint | null
  /** The user's change in the trial's measure (percent or kg), or null with no weigh-in. */
  userChange: number | null
  /** The arm matching the user's molecule and current dose, when one exists. */
  matchingArm: TrialArm | null
}

/** Sets the user's progress beside a trial's endpoint results. */
export function compareToTrial(
  series: readonly ProgressPoint[],
  trial: Trial,
  current: { molecule: string; doseMg: number } | null,
): TrialComparison {
  const eligible = series.filter((p) => p.weeks <= trial.weeks)
  const user = eligible.length ? eligible[eligible.length - 1]! : null
  const userChange = user
    ? trial.measure === 'percent'
      ? user.changePercent
      : user.changeKg
    : null
  const matchingArm =
    (current &&
      trial.arms.find(
        (a) =>
          a.doseMg !== null &&
          Math.abs(a.doseMg - current.doseMg) < 1e-9 &&
          (a.molecule ?? trial.molecule) === current.molecule,
      )) ??
    null
  return { trial, user, userChange, matchingArm }
}

export interface CohortOverlay {
  /** The user's journey in the trial's measure, from week 0 (no change) to the latest weigh-in. */
  user: { weeks: number; change: number }[]
  /** Each published arm at the trial's endpoint week; nothing is drawn before it. */
  arms: { label: string; weeks: number; change: number; placebo: boolean }[]
  /** Lowest to highest mean change across the arms, or null with fewer than two arms. */
  spread: { from: number; to: number } | null
}

/**
 * What a cohort chart draws: the user's own change week by week beside each trial arm's mean
 * at the endpoint. The label prints one week, so the arms are points, never a path: Tidebook
 * does not invent the route a cohort took to get there. Values are in the trial's own measure
 * (percent, or kilograms for the caller to show in the user's unit); one is never turned into the
 * other.
 */
export function cohortOverlay(series: readonly ProgressPoint[], trial: Trial): CohortOverlay {
  const measure = (p: ProgressPoint) => (trial.measure === 'percent' ? p.changePercent : p.changeKg)
  const user = series.length
    ? [{ weeks: 0, change: 0 }, ...series.map((p) => ({ weeks: p.weeks, change: measure(p) }))]
    : []
  // A weigh-in at week 0 is the baseline itself; keep one point there.
  const deduped = user.filter((p, i) => i === 0 || p.weeks > 0)
  const arms = trial.arms.map((a) => ({
    label: a.label,
    weeks: trial.weeks,
    change: a.change,
    placebo: a.doseMg === null,
  }))
  const changes = arms.map((a) => a.change)
  const spread = arms.length > 1 ? { from: Math.max(...changes), to: Math.min(...changes) } : null
  return { user: deduped, arms, spread }
}

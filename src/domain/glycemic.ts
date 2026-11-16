import type { Trial } from './catalog'
import type { A1cUnit } from './glucose'

/**
 * The IFCC-NGSP master equation slope: NGSP (%) = 0.09148 x IFCC (mmol/mol) + 2.152. A change
 * scales by its slope alone.
 */
const NGSP_PER_IFCC = 0.09148

/** A change in percentage points expressed in `unit`. */
export function a1cChangeIn(deltaPercent: number, unit: A1cUnit): number {
  return unit === '%' ? deltaPercent : deltaPercent / NGSP_PER_IFCC
}

export interface Reading {
  /** Epoch milliseconds. */
  at: number
  /** HbA1c in percent or glucose in mg/dL. */
  value: number
}

const WEEK_MS = 7 * 86_400_000

export interface GlycemicBaseline extends Reading {
  /** As for weight: the last reading at or before the first dose, else the first after it. */
  basis: 'before-first-dose' | 'after-first-dose'
}

/** The reading a change is measured from, or null without a dose or a reading. */
export function glycemicBaseline(
  readings: readonly Reading[],
  firstDoseAt: number | null,
): GlycemicBaseline | null {
  if (firstDoseAt === null || !readings.length) return null
  const sorted = [...readings].sort((a, b) => a.at - b.at)
  const before = sorted.filter((r) => r.at <= firstDoseAt)
  if (before.length) return { ...before[before.length - 1]!, basis: 'before-first-dose' }
  return { ...sorted[0]!, basis: 'after-first-dose' }
}

export type GlycemicMeasure = 'hba1c' | 'fastingGlucose'

export interface GlycemicComparison {
  trial: Trial
  measure: GlycemicMeasure
  baseline: GlycemicBaseline | null
  /** The latest reading after the baseline, up to the endpoint week, as a change from it. */
  user: { weeks: number; value: number; change: number } | null
  arms: { label: string; baseline: number; change: number; placebo: boolean }[]
}

/**
 * Sets the user's HbA1c or fasting glucose beside a trial's published endpoint changes, in the
 * same way weight is compared: change from the reading nearest the first dose to the latest one
 * up to the endpoint week. Null when the trial does not print the measure.
 */
export function compareGlycemic(
  readings: readonly Reading[],
  firstDoseAt: number | null,
  trial: Trial,
  measure: GlycemicMeasure,
): GlycemicComparison | null {
  const arms = trial.arms.flatMap((a) => {
    const result = measure === 'hba1c' ? a.hba1c : a.fastingGlucoseMgDl
    return result ? [{ label: a.label, ...result, placebo: a.doseMg === null }] : []
  })
  if (!arms.length) return null
  const baseline = glycemicBaseline(readings, firstDoseAt)
  let user: GlycemicComparison['user'] = null
  if (baseline && firstDoseAt !== null) {
    const after = readings
      .filter((r) => r.at > baseline.at && r.at > firstDoseAt)
      .map((r) => ({ ...r, weeks: (r.at - firstDoseAt) / WEEK_MS }))
      .filter((r) => r.weeks <= trial.weeks)
      .sort((a, b) => a.at - b.at)
    const last = after[after.length - 1]
    if (last) user = { weeks: last.weeks, value: last.value, change: last.value - baseline.value }
  }
  return { trial, measure, baseline, user, arms }
}

/**
 * The user's own path for a cohort chart: change from the baseline reading at each later
 * reading, by weeks since the first dose, starting at no change on week 0. Empty without a
 * baseline.
 */
export function glycemicSeries(
  readings: readonly Reading[],
  firstDoseAt: number | null,
): { weeks: number; change: number }[] {
  const baseline = glycemicBaseline(readings, firstDoseAt)
  if (!baseline || firstDoseAt === null) return []
  const later = readings
    .filter((r) => r.at > baseline.at && r.at > firstDoseAt)
    .sort((a, b) => a.at - b.at)
    .map((r) => ({ weeks: (r.at - firstDoseAt) / WEEK_MS, change: r.value - baseline.value }))
  return [{ weeks: 0, change: 0 }, ...later]
}

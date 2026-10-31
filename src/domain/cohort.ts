import { glycemicSeries, type Reading } from './glucose'
import { baselineFor, progressSeries, type WeightPoint } from './progress'
import type { Population, SourceRef, Trial } from './catalog'

/**
 * Every published readout for one medicine, merged across its trials so they read as one path
 * over time: SUSTAIN 1 at week 30, SUSTAIN FORTE at week 40, STEP 1 at week 68. Each trial still
 * reports only its own final week; the path joins those weeks with straight lines and is
 * labelled as such. The catalog keeps every figure as printed; merging happens only here.
 */
export type CohortMeasure = 'weight' | 'hba1c' | 'fastingGlucose'
export type CohortPopulation = 'all' | Population

export interface CohortReadout {
  trialId: string
  trialName: string
  population: Population
  weeks: number
  armLabel: string
  doseMg: number | null
  placebo: boolean
  /** Weight in percent of starting weight, HbA1c in percentage points, glucose in mg/dL. */
  change: number
  /**
   * Set when the trial printed kilograms and the percent here is derived from them (the
   * arm's mean change over its mean starting weight); holds the printed change in kg.
   */
  printedKg: number | null
  source: SourceRef
}

interface CohortBandPoint {
  weeks: number
  /** The largest fall among active arms at this week (most negative). */
  low: number
  /** The smallest fall among active arms at this week. */
  high: number
}

export interface CohortSummary {
  readouts: CohortReadout[]
  /**
   * The range across active arms at each readout week, from no change at week 0. Empty when
   * the trials report a single week, so no path is drawn from one point.
   */
  band: CohortBandPoint[]
  /** Distinct trial sources, plus the conversion note when any value is derived. */
  sources: SourceRef[]
}

export const DERIVED_PERCENT_SOURCE: SourceRef = {
  kind: 'model',
  citation:
    'Trials that report kilograms are shown in percent as each group’s mean change divided by ' +
    'its mean starting weight. This is close to, but not the same as, the trial’s own percent.',
}

function valueFor(
  trial: Trial,
  arm: Trial['arms'][number],
  measure: CohortMeasure,
): { change: number; printedKg: number | null } | null {
  if (measure === 'weight') {
    return trial.measure === 'percent'
      ? { change: arm.change, printedKg: null }
      : { change: (arm.change / arm.baselineKg) * 100, printedKg: arm.change }
  }
  const result = measure === 'hba1c' ? arm.hba1c : arm.fastingGlucoseMgDl
  return result ? { change: result.change, printedKg: null } : null
}

/**
 * The readouts of `molecule` by `route` in `measure`, across every trial that studied it,
 * including comparator arms (semaglutide 1 mg in SURPASS-2) and each trial's placebo. Arms of
 * other medicines are left out. Oldest week first.
 */
export function cohortReadouts(
  trials: readonly Trial[],
  molecule: string,
  route: Trial['route'],
  measure: CohortMeasure,
  population: CohortPopulation = 'all',
): CohortSummary {
  const readouts: CohortReadout[] = []
  for (const t of trials) {
    if (t.route !== route || (population !== 'all' && t.population !== population)) continue
    const ofMolecule = t.arms.filter((a) => (a.molecule ?? t.molecule) === molecule)
    if (!ofMolecule.some((a) => a.doseMg !== null)) continue
    const source = measure === 'weight' ? t.source : (t.glycemic?.source ?? t.source)
    const placebo = t.arms.filter((a) => a.doseMg === null && !a.molecule)
    for (const arm of [...ofMolecule.filter((a) => a.doseMg !== null), ...placebo]) {
      const value = valueFor(t, arm, measure)
      if (!value) continue
      readouts.push({
        trialId: t.id,
        trialName: t.name,
        population: t.population,
        weeks: t.weeks,
        armLabel: arm.label,
        doseMg: arm.doseMg,
        placebo: arm.doseMg === null,
        ...value,
        source,
      })
    }
  }
  readouts.sort((a, b) => a.weeks - b.weeks || a.change - b.change)

  const byWeek = new Map<number, number[]>()
  for (const r of readouts) {
    if (r.placebo) continue
    byWeek.set(r.weeks, [...(byWeek.get(r.weeks) ?? []), r.change])
  }
  const band: CohortBandPoint[] =
    byWeek.size > 1
      ? [
          { weeks: 0, low: 0, high: 0 },
          ...[...byWeek.entries()].map(([weeks, changes]) => ({
            weeks,
            low: Math.min(...changes),
            high: Math.max(...changes),
          })),
        ]
      : []

  const sources = [
    ...new Map(readouts.map((r) => [r.source.citation, r.source])).values(),
    ...(readouts.some((r) => r.printedKg !== null) ? [DERIVED_PERCENT_SOURCE] : []),
  ]
  return { readouts, band, sources }
}

/** Which measures have any readout for this medicine, in display order. */
export function cohortMeasures(
  trials: readonly Trial[],
  molecule: string,
  route: Trial['route'],
): CohortMeasure[] {
  return (['weight', 'hba1c', 'fastingGlucose'] as const).filter(
    (m) => cohortReadouts(trials, molecule, route, m).readouts.length > 0,
  )
}

/** Whether both kinds of trial (with and without diabetes) report this measure. */
export function hasMixedPopulations(
  trials: readonly Trial[],
  molecule: string,
  route: Trial['route'],
  measure: CohortMeasure,
): boolean {
  const { readouts } = cohortReadouts(trials, molecule, route, measure)
  return new Set(readouts.map((r) => r.population)).size > 1
}

/**
 * The trials a cohort chart opens on. People without diabetes start near a normal HbA1c and
 * glucose and barely change, so merging them with diabetes trials draws a misleading path:
 * blood sugar opens on the diabetes trials when there are any. Weight opens on every trial, as
 * one medicine's path over time.
 */
export function defaultPopulation(
  trials: readonly Trial[],
  molecule: string,
  route: Trial['route'],
  measure: CohortMeasure,
): CohortPopulation {
  if (measure === 'weight') return 'all'
  return cohortReadouts(trials, molecule, route, measure, 't2d').readouts.length ? 't2d' : 'all'
}

/** What the user has logged that a cohort chart compares, with the first dose as week 0. */
export interface CohortUserInput {
  weights: readonly WeightPoint[]
  /** HbA1c in percent. */
  a1c: readonly Reading[]
  /** Fasting glucose in mg/dL. */
  fasting: readonly Reading[]
  firstDoseAt: number | null
}

/**
 * The user's own path in the measure's stored unit (percent of starting weight, HbA1c points,
 * mg/dL), by weeks since the first dose. Empty until there is a dose and a starting value.
 */
export function cohortUserSeries(
  measure: CohortMeasure,
  input: CohortUserInput,
): { weeks: number; change: number }[] {
  if (measure !== 'weight') {
    return glycemicSeries(measure === 'hba1c' ? input.a1c : input.fasting, input.firstDoseAt)
  }
  const baseline = baselineFor(input.weights, input.firstDoseAt)
  if (!baseline || baseline.basis === 'no-doses') return []
  return progressSeries(input.weights, baseline).map((p) => ({
    weeks: p.weeks,
    change: p.changePercent,
  }))
}

/**
 * How to read a cohort chart, after the sentence naming week 0 (which the caller dates): what a
 * point is, whether a path is drawn, what a hollow point means, and how the populations differ.
 */
export function cohortNotes(
  summary: CohortSummary,
  measure: CohortMeasure,
  population: CohortPopulation,
  mixed: boolean,
): string[] {
  return [
    summary.band.length
      ? "Each point is one group's average at the final week of its trial; the shaded range joins those weeks."
      : "Each point is one group's average at the final week of its trial. These trials reported a single week, so no path is drawn.",
    summary.readouts.some((r) => r.printedKg !== null)
      ? 'Hollow points are worked out from kilograms.'
      : '',
    population === 'all' && mixed
      ? measure === 'weight'
        ? 'Trials in people with type 2 diabetes usually show less weight change.'
        : 'People without diabetes start near a normal level, so their change is small.'
      : '',
  ].filter(Boolean)
}

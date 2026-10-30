import { describe, expect, it } from 'vitest'
import { baselineFor, cohortOverlay, compareToTrial, progressSeries } from '@/domain/progress'
import { catalog } from '@/data'

const DAY = 86_400_000
const WEEK = 7 * DAY

describe('baselineFor', () => {
  const weights = [
    { at: -10 * DAY, kg: 101 },
    { at: -1 * DAY, kg: 100 },
    { at: 3 * WEEK, kg: 97 },
  ]

  it('uses the last weigh-in at or before the first dose, as trials do', () => {
    expect(baselineFor(weights, 0)).toMatchObject({
      kg: 100,
      basis: 'before-first-dose',
      startAt: 0,
    })
  })

  it('falls back to the first weigh-in after the first dose, and says so', () => {
    expect(baselineFor(weights, -20 * DAY)).toMatchObject({ kg: 101, basis: 'after-first-dose' })
  })

  it('starts from the first weigh-in with no doses, and is null with no weights', () => {
    expect(baselineFor(weights, null)).toMatchObject({
      kg: 101,
      basis: 'no-doses',
      startAt: -10 * DAY,
    })
    expect(baselineFor([], 0)).toBeNull()
  })
})

describe('progressSeries and compareToTrial', () => {
  const step1 = catalog.trials.find((t) => t.id === 'step-1')!
  const surpass2 = catalog.trials.find((t) => t.id === 'surpass-2')!
  const weights = [
    { at: 0, kg: 100 },
    { at: 20 * WEEK, kg: 92 },
    { at: 80 * WEEK, kg: 84 },
  ]
  const series = progressSeries(weights, baselineFor(weights, 0)!)

  it('measures change in kg and percent from the baseline in weeks since the first dose', () => {
    expect(series.map((p) => p.weeks)).toEqual([0, 20, 80])
    expect(series[1]).toMatchObject({ changeKg: -8, changePercent: -8 })
  })

  it('compares at the latest weigh-in up to the trial endpoint, never past it', () => {
    const c = compareToTrial(series, step1, { molecule: 'semaglutide', doseMg: 2.4 })
    expect(c.user!.weeks).toBe(20)
    expect(c.userChange).toBe(-8)
    expect(c.matchingArm!.label).toBe('Semaglutide 2.4 mg')
  })

  it('uses kilograms for a trial reported in kilograms, and matches a comparator arm by molecule', () => {
    const c = compareToTrial(series, surpass2, { molecule: 'semaglutide', doseMg: 1 })
    expect(c.userChange).toBe(-8)
    expect(c.matchingArm!.label).toBe('Semaglutide 1 mg')
    const tirz = compareToTrial(series, surpass2, { molecule: 'tirzepatide', doseMg: 1 })
    expect(tirz.matchingArm).toBeNull()
  })
})

describe('cohortOverlay', () => {
  const step1 = catalog.trials.find((t) => t.id === 'step-1')!
  const surpass1 = catalog.trials.find((t) => t.id === 'surpass-1')!
  const series = progressSeries(
    [
      { at: 0, kg: 100 },
      { at: 4 * WEEK, kg: 97 },
      { at: 12 * WEEK, kg: 92 },
    ],
    { at: 0, kg: 100, basis: 'before-first-dose', startAt: 0 },
  )

  it('starts the user at no change and follows each weigh-in in the trial measure', () => {
    const overlay = cohortOverlay(series, step1)
    expect(overlay.user.map((p) => p.weeks)).toEqual([0, 4, 12])
    expect(overlay.user[2]!.change).toBeCloseTo(-8)
    expect(cohortOverlay(series, surpass1).user[2]!.change).toBeCloseTo(-8)
  })

  it('places every arm at the endpoint week only, with the spread between them', () => {
    const overlay = cohortOverlay(series, step1)
    expect(overlay.arms.every((a) => a.weeks === step1.weeks)).toBe(true)
    expect(overlay.arms.find((a) => a.placebo)?.change).toBe(-2.4)
    expect(overlay.spread).toEqual({ from: -2.4, to: -14.9 })
  })

  it('draws no user line without weigh-ins', () => {
    expect(cohortOverlay([], step1).user).toEqual([])
  })
})

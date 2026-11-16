import { describe, expect, it } from 'vitest'
import { compareGlycemic, glycemicBaseline, glycemicSeries } from '@/domain/glycemic'
import { catalog } from '@/data'

const WEEK = 7 * 86_400_000

describe('glycemic comparison', () => {
  const sustain1 = catalog.trials.find((t) => t.id === 'sustain-1')!
  const step1 = catalog.trials.find((t) => t.id === 'step-1')!

  it('measures from the reading at or before the first dose, as trials do', () => {
    const readings = [
      { at: -30 * 86_400_000, value: 8.2 },
      { at: 12 * WEEK, value: 7.1 },
      { at: 40 * WEEK, value: 6.6 },
    ]
    expect(glycemicBaseline(readings, 0)).toMatchObject({ value: 8.2, basis: 'before-first-dose' })
    const c = compareGlycemic(readings, 0, sustain1, 'hba1c')!
    expect(c.user).toMatchObject({ weeks: 12, value: 7.1 })
    expect(c.user!.change).toBeCloseTo(-1.1)
    expect(c.arms.find((a) => a.label === 'Semaglutide 1 mg')).toMatchObject({
      baseline: 8.1,
      change: -1.6,
    })
  })

  it('is null for a measure the trial does not print, and has no user row without a dose', () => {
    expect(compareGlycemic([], 0, step1, 'fastingGlucose')).toBeNull()
    expect(compareGlycemic([{ at: 0, value: 6 }], null, step1, 'hba1c')!.user).toBeNull()
  })

  it('follows each reading after the baseline as a change from it', () => {
    const series = glycemicSeries(
      [
        { at: -WEEK, value: 8 },
        { at: 10 * WEEK, value: 7.2 },
      ],
      0,
    )
    expect(series).toEqual([
      { weeks: 0, change: 0 },
      { weeks: 10, change: expect.closeTo(-0.8, 6) },
    ])
    expect(glycemicSeries([], 0)).toEqual([])
  })
})

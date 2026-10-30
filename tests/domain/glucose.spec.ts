import { describe, expect, it } from 'vitest'
import {
  compareGlycemic,
  formatA1c,
  formatA1cChange,
  formatGlucose,
  formatGlucoseChange,
  fromA1cPercent,
  fromMgDl,
  glycemicBaseline,
  glycemicSeries,
  isValidA1c,
  isValidGlucose,
  toA1cPercent,
  toMgDl,
} from '@/domain/glucose'
import { catalog } from '@/data'

const WEEK = 7 * 86_400_000

describe('glucose units', () => {
  it('converts mg/dL and mmol/L by the molar mass of glucose', () => {
    expect(toMgDl(5.5, 'mmol/L')).toBeCloseTo(99.09, 2)
    expect(fromMgDl(180.16, 'mmol/L')).toBeCloseTo(10, 6)
    expect(toMgDl(126, 'mg/dL')).toBe(126)
    expect(fromMgDl(toMgDl(7.2, 'mmol/L'), 'mmol/L')).toBeCloseTo(7.2, 12)
  })

  it('converts HbA1c with the NGSP master equation, both ways', () => {
    expect(toA1cPercent(48, 'mmol/mol')).toBeCloseTo(6.543, 3)
    expect(fromA1cPercent(6.5, 'mmol/mol')).toBeCloseTo(47.5, 1)
    expect(toA1cPercent(fromA1cPercent(8.1, 'mmol/mol'), 'mmol/mol')).toBeCloseTo(8.1, 12)
  })

  it('formats each unit at its lab precision, with signed changes', () => {
    expect(formatGlucose(99.09, 'mg/dL')).toBe('99 mg/dL')
    expect(formatGlucose(99.09, 'mmol/L')).toBe('5.5 mmol/L')
    expect(formatA1c(6.54, '%')).toBe('6.5%')
    expect(formatA1c(6.54, 'mmol/mol')).toBe('48 mmol/mol')
    expect(formatA1cChange(-1.6, '%')).toBe('−1.6 points')
    expect(formatA1cChange(-1.6, 'mmol/mol')).toBe('−17 mmol/mol')
    expect(formatGlucoseChange(4, 'mg/dL')).toBe('+4 mg/dL')
    expect(formatGlucoseChange(0, 'mmol/L')).toBe('0 mmol/L')
  })

  it('rejects readings no meter or lab reports', () => {
    expect(isValidA1c(2.9)).toBe(false)
    expect(isValidA1c(6.5)).toBe(true)
    expect(isValidGlucose(15)).toBe(false)
    expect(isValidGlucose(600)).toBe(true)
  })
})

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

import { describe, expect, it } from 'vitest'
import { catalog } from '@/data'
import { cohortMeasures, cohortReadouts, DERIVED_PERCENT_SOURCE } from '@/domain/cohort'

const trials = catalog.trials

describe('cohortReadouts', () => {
  it('merges every semaglutide injection trial into readouts across weeks', () => {
    const { readouts, band } = cohortReadouts(trials, 'semaglutide', 'injection', 'weight')
    expect([...new Set(readouts.map((r) => r.weeks))]).toEqual([30, 40, 68, 72])
    expect(band.map((b) => b.weeks)).toEqual([0, 30, 40, 68, 72])
    expect(band[0]).toEqual({ weeks: 0, low: 0, high: 0 })
    // STEP 1 is printed in percent and kept as printed.
    const step1 = readouts.find((r) => r.trialId === 'step-1' && !r.placebo)!
    expect(step1).toMatchObject({ change: -14.9, printedKg: null })
  })

  it('derives percent from kilograms over the arm’s starting weight, and says so', () => {
    const { readouts, sources } = cohortReadouts(trials, 'semaglutide', 'injection', 'weight')
    const sustain = readouts.find(
      (r) => r.trialId === 'sustain-1' && r.armLabel === 'Semaglutide 1 mg',
    )!
    expect(sustain.printedKg).toBe(-4.7)
    expect(sustain.change).toBeCloseTo((-4.7 / 96.9) * 100, 6)
    expect(sources).toContain(DERIVED_PERCENT_SOURCE)
  })

  it('keeps comparator arms of the medicine and leaves other medicines out', () => {
    const sema = cohortReadouts(trials, 'semaglutide', 'injection', 'weight').readouts
    expect(sema.some((r) => r.trialId === 'surpass-2' && r.armLabel === 'Semaglutide 1 mg')).toBe(
      true,
    )
    const tirz = cohortReadouts(trials, 'tirzepatide', 'injection', 'weight').readouts
    expect(tirz.some((r) => r.armLabel.startsWith('Semaglutide'))).toBe(false)
  })

  it('bands only active arms, and draws no band from a single readout week', () => {
    const { band, readouts } = cohortReadouts(
      trials,
      'semaglutide',
      'injection',
      'weight',
      'obesity',
    )
    expect(band.map((b) => b.weeks)).toEqual([0, 68, 72])
    expect(band.find((b) => b.weeks === 68)).toEqual({ weeks: 68, low: -16, high: -14.9 })
    expect(readouts.some((r) => r.placebo)).toBe(true)
    expect(cohortReadouts(trials, 'semaglutide', 'tablet', 'weight').band).toEqual([])
  })

  it('reads HbA1c and fasting glucose where the label prints them', () => {
    const a1c = cohortReadouts(trials, 'tirzepatide', 'injection', 'hba1c')
    expect(a1c.readouts.find((r) => r.trialId === 'surpass-2' && r.doseMg === 15)?.change).toBe(
      -2.3,
    )
    expect(cohortMeasures(trials, 'tirzepatide', 'injection')).toEqual([
      'weight',
      'hba1c',
      'fastingGlucose',
    ])
    expect(cohortMeasures(trials, 'orforglipron', 'tablet')).toEqual(['weight', 'hba1c'])
  })
})

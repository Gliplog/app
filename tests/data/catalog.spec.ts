import { describe, expect, it } from 'vitest'
import Ajv from 'ajv'
import schema from '@/data/medications.schema.json'
import { catalog, findPkProfile, trialsFor } from '@/data'

describe('medication catalog', () => {
  it('matches its JSON Schema', () => {
    const validate = new Ajv({ allErrors: true }).compile(schema)
    const ok = validate(catalog)
    expect(validate.errors ?? []).toEqual([])
    expect(ok).toBe(true)
  })

  it('has unique ids and resolves every reference', () => {
    for (const list of [catalog.products, catalog.trials, catalog.pkProfiles]) {
      const ids = list.map((x) => x.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
    for (const p of catalog.products) {
      expect(findPkProfile(p.pkProfile), p.id).toBeDefined()
      expect(
        trialsFor(p).map((t) => t.id),
        p.id,
      ).toEqual(p.trialIds)
    }
  })

  it('lists the launch brands and compounded medicines', () => {
    const ids = catalog.products.map((p) => p.id)
    for (const id of [
      'ozempic',
      'wegovy',
      'mounjaro',
      'zepbound',
      'compounded-semaglutide',
      'compounded-tirzepatide',
    ]) {
      expect(ids).toContain(id)
    }
  })

  it('compares each product only with trials of its own medicine and route', () => {
    for (const p of catalog.products) {
      for (const t of trialsFor(p)) {
        expect(t.route, `${p.id} / ${t.id}`).toBe(p.route)
        expect(t.molecule === p.molecule || t.arms.some((a) => a.molecule === p.molecule)).toBe(
          true,
        )
      }
    }
  })

  it('gives every profile without a curve a reason, and titration doses that are label strengths', () => {
    for (const profile of catalog.pkProfiles) {
      if (!profile.pk) expect(profile.pkUnavailableReason, profile.id).toBeTruthy()
    }
    for (const p of catalog.products) {
      for (const step of p.titration?.steps ?? []) {
        expect(p.strengths.values, p.id).toContain(step.doseMg)
      }
    }
  })

  it('keeps label endpoints as printed (spot checks against section 14)', () => {
    const arm = (trial: string, label: string) =>
      catalog.trials.find((t) => t.id === trial)!.arms.find((a) => a.label === label)!.change
    expect(arm('step-1', 'Semaglutide 2.4 mg')).toBe(-14.9)
    expect(arm('surmount-1', 'Tirzepatide 15 mg')).toBe(-20.9)
    expect(arm('surpass-2', 'Semaglutide 1 mg')).toBe(-5.7)
  })

  it('gives every arm of a trial with glycemic results its HbA1c, and fasting glucose only when printed', () => {
    for (const t of catalog.trials) {
      for (const a of t.arms) {
        expect(a.hba1c !== undefined, `${t.id} / ${a.label}`).toBe(t.glycemic !== undefined)
        expect(a.fastingGlucoseMgDl !== undefined, `${t.id} / ${a.label}`).toBe(
          t.glycemic?.fastingGlucoseLabel !== undefined,
        )
      }
    }
  })

  it('keeps glycemic endpoints as printed (spot checks against section 14 tables)', () => {
    const arm = (trial: string, label: string) =>
      catalog.trials.find((t) => t.id === trial)!.arms.find((a) => a.label === label)!
    expect(arm('sustain-1', 'Semaglutide 1 mg').hba1c).toEqual({ baseline: 8.1, change: -1.6 })
    expect(arm('sustain-1', 'Placebo').fastingGlucoseMgDl).toEqual({ baseline: 174, change: -15 })
    expect(arm('surpass-2', 'Tirzepatide 15 mg').hba1c).toEqual({ baseline: 8.3, change: -2.3 })
    expect(arm('surpass-1', 'Placebo').fastingGlucoseMgDl).toEqual({ baseline: 155, change: 4 })
    expect(arm('step-2', 'Semaglutide 2.4 mg').hba1c).toEqual({ baseline: 8.1, change: -1.6 })
    expect(arm('surmount-2', 'Tirzepatide 10 mg').hba1c).toEqual({ baseline: 8, change: -2.1 })
    expect(arm('attain-2', 'Orforglipron 17.2 mg').hba1c).toEqual({ baseline: 8.1, change: -1.7 })
  })
})

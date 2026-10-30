import { describe, expect, it } from 'vitest'
import { SYMPTOMS, SYMPTOM_LABELS, summarizeSymptoms, symptomName } from '@/domain/symptoms'

const DAY = 86_400_000

describe('symptoms', () => {
  it('names every symptom, and uses the user’s own words for something else', () => {
    for (const s of SYMPTOMS) expect(SYMPTOM_LABELS[s]).toBeTruthy()
    expect(symptomName({ symptom: 'other', otherText: ' Hiccups ' })).toBe('Hiccups')
    expect(symptomName({ symptom: 'other', otherText: '' })).toBe('Something else')
  })

  it('counts each symptom since a date, with severity and days after the dose before it', () => {
    const entries = [
      { symptom: 'nausea' as const, otherText: '', severity: 'mild' as const, at: 1 * DAY },
      { symptom: 'nausea' as const, otherText: '', severity: 'moderate' as const, at: 9 * DAY },
      { symptom: 'nausea' as const, otherText: '', severity: 'mild' as const, at: 16 * DAY },
      { symptom: 'headache' as const, otherText: '', severity: 'mild' as const, at: 2 * DAY },
      { symptom: 'other' as const, otherText: 'Hiccups', severity: 'mild' as const, at: 3 * DAY },
      { symptom: 'other' as const, otherText: 'Cramp', severity: 'mild' as const, at: 3 * DAY },
      { symptom: 'headache' as const, otherText: '', severity: 'severe' as const, at: -5 * DAY },
    ]
    const summary = summarizeSymptoms(entries, [0, 7 * DAY, 14 * DAY], 0)
    expect(summary[0]).toMatchObject({
      key: 'nausea',
      count: 3,
      bySeverity: { mild: 2, moderate: 1, severe: 0 },
      lastAt: 16 * DAY,
      medianDaysAfterDose: 2,
    })
    expect(summary.find((s) => s.key === 'headache')).toMatchObject({ count: 1 })
    expect(summary.filter((s) => s.symptom === 'other').map((s) => s.name)).toEqual(
      expect.arrayContaining(['Hiccups', 'Cramp']),
    )
  })

  it('leaves the timing empty when no dose came before', () => {
    const [only] = summarizeSymptoms(
      [{ symptom: 'gas', otherText: '', severity: 'mild', at: DAY }],
      [5 * DAY],
      0,
    )
    expect(only!.medianDaysAfterDose).toBeNull()
  })
})

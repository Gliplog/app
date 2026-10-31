import { describe, expect, it } from 'vitest'
import type { DoseRow, GlucoseRow, MedicationRow, SymptomRow, WeightRow } from '@/db/database'
import type { ReportPeriod } from '@/domain/report'
import { SYMPTOM_LABELS, SYMPTOM_LABEL_TERMS, SYMPTOM_SOURCES } from '@/domain/symptoms'
import { findPkProfile, findProduct } from '@/data'
import { BMI_SOURCE } from '@/domain/body'
import { groupLevels } from '@/domain/levels'
import {
  availableSections,
  collectReport,
  pageSizeFor,
  type ReportSource,
} from '@/services/report/collectReport'
import { renderReport } from '@/services/report/renderReport'
import type { ReportSection } from '@/services/report/reportData'
import { REPORT_SECTIONS } from '@/services/report/reportData'
import { A4, LETTER } from '@/services/pdf/pageSize'
import { toWinAnsi } from '@/services/pdf/text'
import { readPdf, withoutStrings } from '../pdf/pdfParse'

const DAY = 86_400_000
const NOW = Date.parse('2026-10-30T12:00:00.000Z')
const iso = (ms: number) => new Date(ms).toISOString()
const created = iso(NOW - 200 * DAY)

/** A hostile note: it tries to close the string and draw in a huge font. */
const HOSTILE = 'fine) Tj /F1 99 Tf (pwned'

function source(period: ReportPeriod = '90d'): ReportSource {
  const med: MedicationRow = {
    id: 'm1',
    productId: 'ozempic',
    name: 'Ozempic',
    intervalDays: 7,
    concentrationMgPerMl: null,
    pkOverride: null,
    status: 'active',
    notes: '',
    createdAt: created,
    updatedAt: created,
  }
  const doses: DoseRow[] = Array.from({ length: 70 }, (_, i) => ({
    id: `d${i}`,
    medicationId: 'm1',
    takenAt: iso(NOW - (i * 2 + 1) * DAY),
    doseMg: i < 20 ? 1 : 0.5,
    site: 'abdomen-left',
    notes: i === 0 ? HOSTILE : '',
    createdAt: created,
  }))
  const weights: WeightRow[] = Array.from({ length: 12 }, (_, i) => ({
    id: `w${i}`,
    measuredAt: iso(NOW - i * 7 * DAY),
    kg: 90 + i * 0.6,
    enteredUnit: 'kg',
    notes: '',
    createdAt: created,
  }))
  const symptoms: SymptomRow[] = [
    {
      id: 's1',
      occurredAt: iso(NOW - 3 * DAY),
      symptom: 'indigestion',
      otherText: '',
      severity: 'moderate',
      notes: '',
      createdAt: created,
    },
  ]
  const glucose: GlucoseRow[] = [
    {
      id: 'g1',
      kind: 'a1c',
      measuredAt: iso(NOW - 10 * DAY),
      value: 6.8,
      enteredUnit: '%',
      context: null,
      notes: '',
      createdAt: created,
    },
    {
      id: 'g2',
      kind: 'glucose',
      measuredAt: iso(NOW - 2 * DAY),
      value: 118,
      enteredUnit: 'mg/dL',
      context: 'fasting',
      notes: '',
      createdAt: created,
    },
  ]
  const profile = findPkProfile(findProduct(med.productId)!.pkProfile)!
  const levelGroups = groupLevels(
    [
      {
        id: med.id,
        pkProfile: profile.id,
        label: profile.name,
        pk: { params: profile.pk!, userSupplied: false },
      },
    ],
    doses.map((d) => ({
      medicationId: d.medicationId,
      at: Date.parse(d.takenAt),
      doseMg: d.doseMg,
    })),
  )
  return {
    medications: [med],
    doses,
    weights,
    symptoms,
    glucose,
    levelGroups,
    units: { weight: 'kg', a1c: '%', glucose: 'mg/dL' },
    profile: { heightCm: 170, goalKg: 85 },
    sections: REPORT_SECTIONS,
    period,
    now: NOW,
    locale: 'en-US',
  }
}

const render = (period: ReportPeriod = '90d') => renderReport(collectReport(source(period)))
const only = (sections: ReportSection[], period: ReportPeriod = '90d') =>
  collectReport({ ...source(period), sections })
const text = (sections: ReportSection[]) => readPdf(renderReport(only(sections))).streams.join('\n')

describe('renderReport', () => {
  it('produces a valid, multi-page PDF numbered "page n of m"', () => {
    const pdf = readPdf(render())
    const pages = pdf.streams.length
    expect(pages).toBeGreaterThan(1)
    pdf.streams.forEach((s, i) => expect(s).toContain(`(Page ${i + 1} of ${pages})`))
  })

  it('is deterministic for the same data', () => {
    expect(render()).toEqual(render())
  })

  it('prints each section, the labels’ term for a side effect, and its source', () => {
    const all = readPdf(render()).streams.join('\n')
    for (const text of [
      '(Medications)',
      '(Weight)',
      '(Side effects)',
      '(HbA1c)',
      '(Blood glucose)',
      '(Dose log)',
      '(Combined chart)',
      '(Body mass index)',
      '(Compared with trial cohorts)',
      '(Estimated levels)',
      '(You)',
      '(Range across trials)',
      '(Indigestion \\(dyspepsia\\))',
      '(6.8%)',
      '(118 mg/dL)',
    ]) {
      expect(all).toContain(text)
    }
    expect(all).toContain('Bracketed terms: WEGOVY \\(semaglutide\\)')
  })

  it('prints the sections in reading order, with no closing notes section', () => {
    const all = readPdf(render()).streams.join('\n')
    const order = [
      '(Combined chart)',
      '(Weight)',
      '(HbA1c)',
      '(Blood glucose)',
      '(Compared with trial cohorts)',
      '(Estimated levels)',
      '(Side effects)',
      '(Dose log)',
    ].map((heading) => all.lastIndexOf(heading))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(all).not.toContain('About these numbers')
  })

  it('repeats the dose-log header on continuation pages', () => {
    const { streams } = readPdf(render())
    const continued = streams.filter((s) => s.includes('(Dose log \\(continued\\))'))
    expect(continued.length).toBeGreaterThan(0)
    for (const s of continued) expect(s).toContain('(Medication)')
  })

  it('cannot be steered by a hostile note', () => {
    for (const stream of readPdf(render()).streams) {
      const ops = withoutStrings(stream)
      expect(ops).not.toContain('/F1 99')
      expect(ops.match(/\bTf\b/g)?.length).toBe(ops.match(/\bTj\b/g)?.length)
    }
  })

  it('keeps only the period’s rows', () => {
    const month = collectReport(source('30d'))
    expect(month.doses!.log.rows.length).toBe(15)
    expect(collectReport(source('all')).doses!.log.rows.length).toBe(70)
  })

  it('prints only the chosen parts', () => {
    const chosen = text(['weight', 'cohort'])
    expect(chosen).toContain('(Weight)')
    expect(chosen).toContain('(Compared with trial cohorts)')
    for (const absent of ['(Dose log', '(Side effects)', '(Combined chart)', '(Estimated levels)'])
      expect(chosen).not.toContain(absent)
  })

  it('picks Letter paper for the US and A4 elsewhere', () => {
    expect(pageSizeFor('en-US')).toBe(LETTER)
    expect(pageSizeFor('en-GB')).toBe(A4)
    expect(pageSizeFor('not a locale')).toBe(A4)
  })
})

describe('side-effect text in reports', () => {
  it('encodes losslessly in the PDF fonts, so nothing prints as "?"', () => {
    const decoder = new TextDecoder('windows-1252')
    const texts = [
      ...Object.values(SYMPTOM_LABELS),
      ...Object.values(SYMPTOM_LABEL_TERMS),
      ...SYMPTOM_SOURCES.map((s) => s.citation),
      BMI_SOURCE.citation,
      BMI_SOURCE.url,
    ]
    for (const text of texts) {
      const bytes = Uint8Array.from(toWinAnsi(text), (c) => c.charCodeAt(0))
      expect(decoder.decode(bytes)).toBe(text)
    }
  })
})

describe('collectReport', () => {
  it('reports weight change, BMI with its band, and the goal line', () => {
    const weight = collectReport(source()).weight!
    const stats = new Map(weight.stats)
    expect(stats.get('Latest')).toBe('90 kg')
    // 90 / 1.7² = 31.1.
    expect(stats.get('BMI')).toBe('31.1')
    expect(stats.get('BMI band')).toBe('Obesity class 1')
    expect(weight.weight!.guides).toEqual([{ value: 85, label: 'Goal' }])
  })

  it('compares weight with every semaglutide trial from the first dose', () => {
    const cohort = collectReport(source('30d')).cohort!
    expect(cohort.map((c) => c.title)).toEqual([
      expect.stringMatching(/: weight$/),
      expect.stringMatching(/: HbA1c$/),
      expect.stringMatching(/: fasting glucose$/),
    ])
    const weight = cohort[0]!.chart
    expect(weight.x).toBe('weeks')
    expect(weight.band.length).toBeGreaterThan(1)
    const you = weight.series.find((s) => s.label === 'You')!
    // The first weigh-in came after the first dose, so the line starts at its own week.
    expect(you.points[0]!.value).toBe(0)
    expect(you.points[0]!.at).toBeCloseTo(62 / 7, 6)
    // Derived from kilograms, so drawn open.
    expect(weight.series.flatMap((s) => s.points).some((p) => p.hollow)).toBe(true)
    expect(cohort[0]!.caption[0]).toMatch(/^Week 0 is your first semaglutide dose on /)
    expect(cohort[0]!.citations.length).toBeGreaterThan(0)
  })

  it('keeps a left-out part out of the combined chart too', () => {
    const combined = only(['combined', 'weight']).combined!
    expect(combined.panels.map((p) => p.title)).toEqual(['Weight (kg)'])
    expect(combined.timeline).toEqual([])
    expect(only(['combined']).combined).toBeNull()
  })

  it('offers only the parts with something to print', () => {
    const { sections: _, ...rest } = source('30d')
    expect([...availableSections({ ...rest, symptoms: [], glucose: [] })].sort()).toEqual([
      'cohort',
      'combined',
      'doses',
      'levels',
      'weight',
    ])
    // The active medication is listed even with no dose in the period.
    const later = availableSections({ ...rest, now: NOW + 400 * DAY })
    expect([...later].sort()).toEqual(['cohort', 'doses'])
    const stopped = rest.medications.map((m) => ({ ...m, status: 'archived' as const }))
    expect([...availableSections({ ...rest, medications: stopped, now: NOW + 400 * DAY })]).toEqual(
      ['cohort'],
    )
  })
})

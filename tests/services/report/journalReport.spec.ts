import { describe, expect, it } from 'vitest'
import type { DoseRow, GlucoseRow, MedicationRow, SymptomRow, WeightRow } from '@/db/database'
import type { ReportPeriod } from '@/domain/report'
import { SYMPTOM_LABELS, SYMPTOM_LABEL_TERMS, SYMPTOM_SOURCES } from '@/domain/symptoms'
import { collectReport, pageSizeFor, type ReportSource } from '@/services/report/collectReport'
import { renderJournalReport } from '@/services/report/journalReport'
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
  return {
    medications: [med],
    doses,
    weights,
    symptoms,
    glucose,
    units: { weight: 'kg', a1c: '%', glucose: 'mg/dL' },
    period,
    now: NOW,
    locale: 'en-US',
  }
}

const render = (period: ReportPeriod = '90d') => renderJournalReport(collectReport(source(period)))

describe('renderJournalReport', () => {
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
      '(Indigestion \\(dyspepsia\\))',
      '(6.8%)',
      '(118 mg/dL)',
    ]) {
      expect(all).toContain(text)
    }
    expect(all).toContain('Source: Prescribing label: WEGOVY \\(semaglutide\\)')
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
    expect(month.doses.rows.length).toBe(15)
    expect(collectReport(source('all')).doses.rows.length).toBe(70)
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
    ]
    for (const text of texts) {
      const bytes = Uint8Array.from(toWinAnsi(text), (c) => c.charCodeAt(0))
      expect(decoder.decode(bytes)).toBe(text)
    }
  })
})

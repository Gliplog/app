import { findProduct } from '@/data'
import type { DoseRow, GlucoseRow, MedicationRow, SymptomRow, WeightRow } from '@/db/database'
import {
  formatA1c,
  formatA1cChange,
  formatGlucose,
  GLUCOSE_CONTEXT_LABELS,
  type A1cUnit,
  type GlucoseUnit,
} from '@/domain/glucose'
import { periodStart, type ReportPeriod } from '@/domain/report'
import {
  SEVERITIES,
  SEVERITY_LABELS,
  SYMPTOM_LABEL_TERMS,
  SYMPTOM_SOURCES,
  summarizeSymptoms,
} from '@/domain/symptoms'
import {
  formatDose,
  formatPercentChange,
  formatWeight,
  formatWeightChange,
  fromKg,
  roundTo,
  type WeightUnit,
} from '@/domain/units'
import { A4, LETTER, type PageSize } from '@/services/pdf/pageSize'
import { formatDate, formatDateRange, formatDateTime, toEpochMs } from '@/services/time'
import { SITE_LABELS } from '@/components/journal/siteLabels'
import type { JournalReportData } from './journalReport'

export interface ReportSource {
  medications: readonly MedicationRow[]
  /** Newest first, as the journal store holds them. */
  doses: readonly DoseRow[]
  weights: readonly WeightRow[]
  symptoms: readonly SymptomRow[]
  glucose: readonly GlucoseRow[]
  units: { weight: WeightUnit; a1c: A1cUnit; glucose: GlucoseUnit }
  period: ReportPeriod
  now: number
  /** BCP 47 locale, which picks the paper size. */
  locale: string
}

/** Regions that use US Letter paper; everywhere else uses A4. */
const LETTER_REGIONS = new Set(['US', 'CA', 'MX', 'PH', 'CL', 'CO', 'VE', 'PR'])

export function pageSizeFor(locale: string): PageSize {
  try {
    const region = new Intl.Locale(locale).maximize().region
    return region && LETTER_REGIONS.has(region) ? LETTER : A4
  } catch {
    return A4
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const interval = (days: number) =>
  days === 1 ? 'Daily' : days === 7 ? 'Weekly' : `Every ${days} days`

/**
 * Gather what the journal report prints for `period`, formatted for the reader's locale and
 * units: medications, weight change with its chart, HbA1c and glucose, side effects with the
 * labels' terms, and the dose log. Newest first in every table, as History lists them.
 */
export function collectReport(source: ReportSource): JournalReportData {
  const { period, now, units } = source
  const since = periodStart(period, now)
  const within = <T>(list: readonly T[], at: (row: T) => string) =>
    list
      .filter((r) => toEpochMs(at(r)) >= since && toEpochMs(at(r)) <= now)
      .sort((a, b) => toEpochMs(at(b)) - toEpochMs(at(a)))

  const doses = within(source.doses, (d) => d.takenAt)
  const weights = within(source.weights, (w) => w.measuredAt)
  const symptoms = within(source.symptoms, (s) => s.occurredAt)
  const a1c = within(
    source.glucose.filter((g) => g.kind === 'a1c'),
    (g) => g.measuredAt,
  )
  const glucose = within(
    source.glucose.filter((g) => g.kind === 'glucose'),
    (g) => g.measuredAt,
  )
  const medsById = new Map(source.medications.map((m) => [m.id, m]))

  const oldestLogged = Math.min(
    now,
    ...[...doses.map((d) => d.takenAt), ...weights.map((w) => w.measuredAt)].map(toEpochMs),
  )
  const start = Number.isFinite(since) ? since : oldestLogged
  const periodLabel =
    period === 'all'
      ? `Everything logged (${formatDateRange(start, now)})`
      : `Last ${period === '30d' ? 30 : 90} days (${formatDateRange(start, now)})`

  // Weight: first and last weigh-in of the period, oldest first for the chart.
  const chronological = [...weights].reverse()
  const first = chronological[0]
  const last = chronological[chronological.length - 1]
  const weight =
    first && last
      ? {
          stats: [
            ['First', formatWeight(first.kg, units.weight)],
            ['Latest', formatWeight(last.kg, units.weight)],
            [
              'Change',
              `${formatWeightChange(last.kg - first.kg, units.weight)} (${formatPercentChange(((last.kg - first.kg) / first.kg) * 100)})`,
            ],
            ['Weigh-ins', String(weights.length)],
          ] as [string, string][],
          series: {
            points: chronological.map((w) => ({
              at: toEpochMs(w.measuredAt),
              value: fromKg(w.kg, units.weight),
            })),
            unitLabel: units.weight,
            decimals: 1,
            window: { start: toEpochMs(first.measuredAt), end: toEpochMs(last.measuredAt) },
          },
        }
      : null

  const medsInUse = source.medications.filter(
    (m) => m.status === 'active' || doses.some((d) => d.medicationId === m.id),
  )
  const medicationRows = medsInUse.map((m) => {
    const product = findProduct(m.productId)
    const own = doses.filter((d) => d.medicationId === m.id)
    return [
      m.name,
      product ? product.molecule : 'Not in the catalog',
      `${interval(m.intervalDays)}${m.status === 'archived' ? ' · stopped' : ''}`,
      String(own.length),
      own[0] ? `${formatDose(own[0].doseMg)}, ${formatDate(own[0].takenAt)}` : '',
    ]
  })

  const summaries = summarizeSymptoms(
    symptoms.map((s) => ({ ...s, at: toEpochMs(s.occurredAt) })),
    source.doses.map((d) => toEpochMs(d.takenAt)),
    since,
  )
  const symptomRows = summaries.map((s) => {
    const term = s.symptom !== 'other' ? SYMPTOM_LABEL_TERMS[s.symptom] : undefined
    const timing =
      s.medianDaysAfterDose === null
        ? 'Before any dose'
        : `${roundTo(s.medianDaysAfterDose, 1)} days after a dose`
    return [
      term ? `${s.name} (${term})` : s.name,
      String(s.count),
      SEVERITIES.filter((l) => s.bySeverity[l])
        .map((l) => `${s.bySeverity[l]} ${SEVERITY_LABELS[l].toLowerCase()}`)
        .join(', '),
      timing,
      formatDate(s.lastAt),
    ]
  })

  const latestA1c = a1c[0]
  const summary: [string, string][] = [
    ['Medications', String(medsInUse.length)],
    ['Doses logged', String(doses.length)],
  ]
  if (weight) summary.push(['Weight change', weight.stats[2]![1]])
  if (latestA1c) summary.push(['Latest HbA1c', formatA1c(latestA1c.value, units.a1c)])
  if (symptoms.length) summary.push(['Side effects logged', String(symptoms.length)])

  const a1cRows = a1c.map((g, i) => {
    const previous = a1c[i + 1]
    return [
      formatDate(g.measuredAt),
      formatA1c(g.value, units.a1c),
      previous ? formatA1cChange(g.value - previous.value, units.a1c) : '',
      g.notes,
    ]
  })

  return {
    pageSize: pageSizeFor(source.locale),
    generated: formatDateTime(now),
    periodLabel: `${periodLabel} · ${plural(doses.length, 'dose')}`,
    summary,
    medications: {
      columns: [
        { title: 'Medication', width: 0.28, align: 'left' },
        { title: 'Medicine', width: 0.18, align: 'left' },
        { title: 'Schedule', width: 0.18, align: 'left' },
        { title: 'Doses', width: 0.1, align: 'right' },
        { title: 'Latest dose', width: 0.26, align: 'left' },
      ],
      rows: medicationRows,
      empty: 'No medications in this period.',
    },
    weight,
    symptoms: {
      columns: [
        { title: 'Side effect', width: 0.34, align: 'left' },
        { title: 'Times', width: 0.08, align: 'right' },
        { title: 'Strength', width: 0.24, align: 'left' },
        { title: 'Usually', width: 0.2, align: 'left' },
        { title: 'Last', width: 0.14, align: 'left' },
      ],
      rows: symptomRows,
      empty: 'No side effects logged in this period.',
    },
    symptomNotes: [
      '"Usually" is the median time from the dose before each entry. Strength: mild, noticeable ' +
        'but not in the way; moderate, got in the way of some things; severe, stopped them.',
      ...(symptoms.length
        ? [`Bracketed terms: ${SYMPTOM_SOURCES.map((s) => s.citation).join('; ')}.`]
        : []),
    ],
    a1c: {
      columns: [
        { title: 'Date', width: 0.2, align: 'left' },
        { title: 'HbA1c', width: 0.16, align: 'right' },
        { title: 'Change', width: 0.18, align: 'right' },
        { title: 'Notes', width: 0.46, align: 'left' },
      ],
      rows: a1cRows,
      empty: 'No HbA1c results in this period.',
    },
    glucose: {
      columns: [
        { title: 'When', width: 0.26, align: 'left' },
        { title: 'Glucose', width: 0.16, align: 'right' },
        { title: 'Timing', width: 0.18, align: 'left' },
        { title: 'Notes', width: 0.4, align: 'left' },
      ],
      rows: glucose.map((g) => [
        formatDateTime(g.measuredAt),
        formatGlucose(g.value, units.glucose),
        g.kind === 'glucose' ? GLUCOSE_CONTEXT_LABELS[g.context] : '',
        g.notes,
      ]),
      empty: 'No glucose readings in this period.',
    },
    doses: {
      columns: [
        { title: 'When', width: 0.24, align: 'left' },
        { title: 'Medication', width: 0.26, align: 'left' },
        { title: 'Dose', width: 0.12, align: 'right' },
        { title: 'Site', width: 0.14, align: 'left' },
        { title: 'Notes', width: 0.24, align: 'left' },
      ],
      rows: doses.map((d) => [
        formatDateTime(d.takenAt),
        medsById.get(d.medicationId)?.name ?? '',
        formatDose(d.doseMg),
        d.site ? SITE_LABELS[d.site] : '',
        d.notes,
      ]),
      empty: 'No doses logged in this period.',
    },
    formatTick: (at) => formatDate(at),
  }
}

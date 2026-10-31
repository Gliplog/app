import { catalog, findPkProfile, findProduct } from '@/data'
import type { DoseRow, GlucoseRow, MedicationRow, SymptomRow, WeightRow } from '@/db/database'
import { bmi, bmiBand, BMI_BANDS, BMI_SOURCE } from '@/domain/body'
import { SOURCE_KIND_LABELS, type CatalogProduct } from '@/domain/catalog'
import {
  cohortMeasures,
  cohortNotes,
  cohortReadouts,
  cohortUserSeries,
  defaultPopulation,
  hasMixedPopulations,
  type CohortMeasure,
} from '@/domain/cohort'
import {
  a1cChangeIn,
  decimalsFor,
  formatA1c,
  formatA1cChange,
  formatGlucose,
  fromA1cPercent,
  fromMgDl,
  GLUCOSE_CONTEXT_LABELS,
  type A1cUnit,
  type GlucoseUnit,
} from '@/domain/glucose'
import type { MedicationLevels } from '@/domain/levels'
import { amountAt, rateConstants, simulate, summarizeLevels } from '@/domain/pk'
import { periodStart, reportWindow, type ReportPeriod } from '@/domain/report'
import {
  SEVERITIES,
  SEVERITY_LABELS,
  SYMPTOM_LABEL_TERMS,
  SYMPTOM_SOURCES,
  summarizeSymptoms,
} from '@/domain/symptoms'
import {
  formatAmount,
  formatDose,
  formatPercentChange,
  formatWeight,
  formatWeightChange,
  fromKg,
  roundTo,
  type WeightUnit,
} from '@/domain/units'
import { A4, LETTER, type PageSize } from '@/services/pdf/pageSize'
import {
  formatAxisTick,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatHours,
  toEpochMs,
} from '@/services/time'
import { SITE_LABELS } from '@/components/journal/siteLabels'
import type {
  ReportChart,
  ReportCohort,
  ReportCombined,
  ReportData,
  ReportLevels,
  ReportSection,
  ReportSugar,
  ReportTimelineRow,
  ReportWeight,
} from './reportData'

export interface ReportSource {
  medications: readonly MedicationRow[]
  /** Newest first, as the journal store holds them. */
  doses: readonly DoseRow[]
  weights: readonly WeightRow[]
  symptoms: readonly SymptomRow[]
  glucose: readonly GlucoseRow[]
  /** Every dose pooled per medicine (the journal store's `levelGroups`). */
  levelGroups: readonly MedicationLevels[]
  units: { weight: WeightUnit; a1c: A1cUnit; glucose: GlucoseUnit }
  profile: { heightCm: number | null; goalKg: number | null }
  /** The sections the reader chose; those with nothing to print are left out. */
  sections: readonly ReportSection[]
  period: ReportPeriod
  now: number
  /** BCP 47 locale, which picks the paper size. */
  locale: string
}

type Source = Omit<ReportSource, 'sections'>

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

const DAY_MS = 86_400_000
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const interval = (days: number) =>
  days === 1 ? 'Daily' : days === 7 ? 'Weekly' : `Every ${days} days`
const chronological = <T>(rows: readonly T[]) => [...rows].reverse()

/** The source's rows inside the period, newest first. */
function inPeriod(source: Source) {
  const since = periodStart(source.period, source.now)
  const within = <T>(list: readonly T[], at: (row: T) => string) =>
    list
      .filter((r) => toEpochMs(at(r)) >= since && toEpochMs(at(r)) <= source.now)
      .sort((a, b) => toEpochMs(at(b)) - toEpochMs(at(a)))
  return {
    since,
    doses: within(source.doses, (d) => d.takenAt),
    weights: within(source.weights, (w) => w.measuredAt),
    symptoms: within(source.symptoms, (s) => s.occurredAt),
    a1c: within(
      source.glucose.filter((g) => g.kind === 'a1c'),
      (g) => g.measuredAt,
    ),
    glucose: within(
      source.glucose.filter((g) => g.kind === 'glucose'),
      (g) => g.measuredAt,
    ),
  }
}

type Rows = ReturnType<typeof inPeriod>

/** The pooled medicines with doses in the period, with or without a level curve. */
function dosedGroups(source: Source, rows: Rows): MedicationLevels[] {
  const dosed = new Set(rows.doses.map((d) => d.medicationId))
  return source.levelGroups.filter((g) => g.medicationIds.some((id) => dosed.has(id)))
}

/** Catalog products the user has added, once each, in the order they were added. */
function productsInUse(source: Source): CatalogProduct[] {
  const seen = new Map<string, CatalogProduct>()
  for (const m of source.medications) {
    const p = findProduct(m.productId)
    if (p && !seen.has(p.id)) seen.set(p.id, p)
  }
  return [...seen.values()]
}

/**
 * Which sections have anything to print for the period, so the export dialog can offer only
 * those. The trial comparison is not bound to the period: it needs only a medicine with
 * published trials.
 */
export function availableSections(source: Source): Set<ReportSection> {
  const rows = inPeriod(source)
  const out = new Set<ReportSection>()
  if (rows.doses.length) out.add('levels')
  // A prescriber needs the medications taken even when no dose was logged in the period.
  if (rows.doses.length || source.medications.some((m) => m.status === 'active')) out.add('doses')
  if (rows.weights.length) out.add('weight')
  if (rows.a1c.length || rows.glucose.length) out.add('sugar')
  if (rows.symptoms.length) out.add('symptoms')
  const logged =
    rows.doses.length +
    rows.weights.length +
    rows.a1c.length +
    rows.glucose.length +
    rows.symptoms.length
  if (logged) out.add('combined')
  if (productsInUse(source).some((p) => cohortMeasures(catalog.trials, p.molecule, p.route).length))
    out.add('cohort')
  return out
}

function describeLevels(
  group: MedicationLevels,
  doses: readonly DoseRow[],
  rows: Rows,
  now: number,
): ReportLevels {
  const total = doses.reduce((sum, d) => sum + d.doseMg, 0)
  const stats: [string, string][] = [
    ['Doses', String(doses.length)],
    ['Total', formatDose(total)],
  ]
  const profile = findPkProfile(group.pkProfile)
  if (!group.pk) {
    return {
      name: group.label,
      stats,
      pk: null,
      curve: null,
      noCurveReason:
        profile?.pkUnavailableReason ??
        'No published data for this medicine. Add a half-life to the medication to see an estimate.',
    }
  }
  const { params, userSupplied } = group.pk
  const { trimmed, ...window } = reportWindow(group.doses, params, now, rows.since)
  const points = simulate(group.doses, params, window)
  const summary = summarizeLevels(points, group.doses, params, now)
  stats.push([
    'Estimated now',
    formatAmount(amountAt(now, group.doses, rateConstants(params)), 'mg'),
  ])
  if (summary.peak) stats.push(['Highest on chart', formatAmount(summary.peak.amount, 'mg')])
  const catalogPk = userSupplied ? null : profile?.pk
  const best = catalogPk?.sources.some((s) => s.kind === 'label') ? 'label' : 'trial'
  return {
    name: group.label,
    stats,
    pk: {
      halfLife: formatHours(params.halfLifeHours),
      peak: formatHours(params.tmaxHours),
      sourceLabel: userSupplied ? 'Your own values' : SOURCE_KIND_LABELS[best],
      userSupplied,
      notes: catalogPk?.notes ?? '',
      citations: (catalogPk?.sources ?? []).map(
        (s) => `${SOURCE_KIND_LABELS[s.kind]}: ${s.citation}${s.url ? ` (${s.url})` : ''}`,
      ),
    },
    curve: {
      chart: {
        title: null,
        x: 'time',
        window,
        scale: 'zero',
        unitLabel: 'mg',
        decimals: 3,
        series: [
          {
            label: 'Estimated amount',
            style: 'area',
            tone: 'logged',
            points: points.map((p) => ({ at: p.at, value: p.amount })),
          },
        ],
        band: [],
        markers: group.doses
          .filter((d) => d.at >= window.start && d.at <= window.end)
          .map((d) => d.at),
        guides: [],
        now,
      },
      note: trimmed
        ? 'Short-acting: the chart shows the 3 days up to the latest dose. Every dose in the ' +
          'period is in the totals and the dose log.'
        : null,
    },
    noCurveReason: null,
  }
}

function timeChart(
  title: string | null,
  window: ReportChart['window'],
  unitLabel: string,
  decimals: number,
  series: ReportChart['series'],
  guides: ReportChart['guides'] = [],
): ReportChart {
  return {
    title,
    x: 'time',
    window,
    scale: 'fit',
    unitLabel,
    decimals,
    series,
    band: [],
    markers: [],
    guides,
    now: null,
  }
}

function weightChart(source: Source, rows: Rows, window: ReportChart['window']): ReportChart {
  const { weight } = source.units
  const goal = source.profile.goalKg
  return timeChart(
    `Weight (${weight})`,
    window,
    weight,
    1,
    [
      {
        label: 'Weight',
        style: 'line',
        tone: 'logged',
        points: chronological(rows.weights).map((w) => ({
          at: toEpochMs(w.measuredAt),
          value: fromKg(w.kg, weight),
        })),
      },
    ],
    goal ? [{ value: fromKg(goal, weight), label: 'Goal' }] : [],
  )
}

function a1cChart(source: Source, rows: Rows, window: ReportChart['window']): ReportChart {
  const unit = source.units.a1c
  return timeChart(`HbA1c (${unit})`, window, unit, decimalsFor(unit), [
    {
      label: 'HbA1c',
      style: 'line',
      tone: 'logged',
      points: chronological(rows.a1c).map((g) => ({
        at: toEpochMs(g.measuredAt),
        value: fromA1cPercent(g.value, unit),
      })),
    },
  ])
}

/**
 * Fasting readings as the line and readings at other times as hollow points: they are not
 * comparable with each other, as on the app's trend chart.
 */
function glucoseChart(source: Source, rows: Rows, window: ReportChart['window']): ReportChart {
  const unit = source.units.glucose
  const point = (g: GlucoseRow) => ({ at: toEpochMs(g.measuredAt), value: fromMgDl(g.value, unit) })
  const all = chronological(rows.glucose)
  const fasting = all.filter((g) => g.context === 'fasting').map(point)
  const other = all.filter((g) => g.context !== 'fasting').map(point)
  return timeChart(`Glucose (${unit})`, window, unit, decimalsFor(unit), [
    ...(fasting.length
      ? [{ label: 'Fasting', style: 'line' as const, tone: 'logged' as const, points: fasting }]
      : []),
    ...(other.length
      ? [
          {
            label: 'Other times',
            style: 'hollow' as const,
            tone: 'preview' as const,
            points: other,
          },
        ]
      : []),
  ])
}

/** The span of a list of readings, or null with fewer than two distinct times. */
function spanOf(times: readonly number[]): ReportChart['window'] | null {
  if (times.length < 2) return null
  const start = Math.min(...times)
  const end = Math.max(...times)
  return end > start ? { start, end } : null
}

function collectWeight(source: Source, rows: Rows): ReportWeight {
  const { units, profile } = source
  const series = chronological(rows.weights)
  const first = series[0]!
  const last = series[series.length - 1]!
  const stats: [string, string][] = [
    ['First', formatWeight(first.kg, units.weight)],
    ['Latest', formatWeight(last.kg, units.weight)],
  ]
  if (series.length > 1) {
    stats.push([
      'Change',
      `${formatWeightChange(last.kg - first.kg, units.weight)} (${formatPercentChange(((last.kg - first.kg) / first.kg) * 100)})`,
    ])
  }
  stats.push(['Weigh-ins', String(series.length)])

  const window = spanOf(series.map((w) => toEpochMs(w.measuredAt)))
  const notes: string[] = []
  let bmiChart: ReportChart | null = null
  const height = profile.heightCm
  if (height) {
    const latest = bmi(last.kg, height)
    stats.push(['BMI', String(roundTo(latest, 1))])
    stats.push(['BMI band', bmiBand(latest).label])
    const values = series.map((w) => ({ at: toEpochMs(w.measuredAt), value: bmi(w.kg, height) }))
    if (window) {
      const lo = Math.min(...values.map((v) => v.value)) - 4
      const hi = Math.max(...values.map((v) => v.value)) + 4
      // Only band edges near the reader's own values, so the axis is not stretched.
      const guides = BMI_BANDS.filter((b) => b.from > 0 && b.from >= lo && b.from <= hi).map(
        (b) => ({
          value: b.from,
          label: b.label,
        }),
      )
      bmiChart = timeChart(
        'Body mass index',
        window,
        '',
        1,
        [{ label: 'BMI', style: 'line', tone: 'logged', points: values }],
        guides,
      )
    }
    notes.push(
      `BMI is weight over height squared, from the height in your profile (${roundTo(height, 1)} cm). ` +
        'It is a population screening measure, not a diagnosis. ' +
        `Bands: ${BMI_SOURCE.citation} (${BMI_SOURCE.url}).`,
    )
  }
  return {
    stats,
    weight: window ? weightChart(source, rows, window) : null,
    bmi: bmiChart,
    notes,
  }
}

function collectSugar(source: Source, rows: Rows): ReportSugar {
  const { units } = source
  const a1cWindow = spanOf(rows.a1c.map((g) => toEpochMs(g.measuredAt)))
  const glucoseWindow = spanOf(rows.glucose.map((g) => toEpochMs(g.measuredAt)))
  return {
    a1cChart: a1cWindow ? a1cChart(source, rows, a1cWindow) : null,
    glucoseChart: glucoseWindow ? glucoseChart(source, rows, glucoseWindow) : null,
    a1c: {
      columns: [
        { title: 'Date', width: 0.2, align: 'left' },
        { title: 'HbA1c', width: 0.16, align: 'right' },
        { title: 'Change', width: 0.18, align: 'right' },
        { title: 'Notes', width: 0.46, align: 'left', muted: true },
      ],
      rows: rows.a1c.map((g, i) => {
        const previous = rows.a1c[i + 1]
        return [
          formatDate(g.measuredAt),
          formatA1c(g.value, units.a1c),
          previous ? formatA1cChange(g.value - previous.value, units.a1c) : '',
          g.notes,
        ]
      }),
      empty: 'No HbA1c results in this period.',
    },
    glucose: {
      columns: [
        { title: 'When', width: 0.26, align: 'left' },
        { title: 'Glucose', width: 0.16, align: 'right' },
        { title: 'Timing', width: 0.18, align: 'left' },
        { title: 'Notes', width: 0.4, align: 'left', muted: true },
      ],
      rows: rows.glucose.map((g) => [
        formatDateTime(g.measuredAt),
        formatGlucose(g.value, units.glucose),
        g.kind === 'glucose' ? GLUCOSE_CONTEXT_LABELS[g.context] : '',
        g.notes,
      ]),
      empty: 'No glucose readings in this period.',
    },
  }
}

const LEVELS_NOTE =
  'Estimated levels are the amount left in the body from logged doses, not blood levels, from ' +
  'a simple model of the half-life and time to peak. Triangles mark doses.'

/**
 * The other chosen sections on one time axis, as stacked panels rather than a second value
 * axis: weight, blood sugar, and each medicine's estimated level over the whole period.
 * Medicines without a curve and side effects are rows of events below. A section left out
 * stays out of this chart too. Null when no chosen section has data.
 */
function collectCombined(
  source: Source,
  rows: Rows,
  window: ReportChart['window'],
  chosen: ReadonlySet<ReportSection>,
): ReportCombined | null {
  const panels: ReportChart[] = []
  const sugar = chosen.has('sugar')
  const atWindow = (chart: ReportChart): ReportChart => ({ ...chart, window, guides: [] })
  if (chosen.has('weight') && rows.weights.length)
    panels.push(atWindow(weightChart(source, rows, window)))
  if (sugar && rows.a1c.length) panels.push(atWindow(a1cChart(source, rows, window)))
  if (sugar && rows.glucose.length) panels.push(atWindow(glucoseChart(source, rows, window)))

  const timeline: ReportTimelineRow[] = []
  const medicines = chosen.has('levels') || chosen.has('doses')
  for (const group of medicines ? dosedGroups(source, rows) : []) {
    const markers = group.doses
      .filter((d) => d.at >= window.start && d.at <= window.end)
      .map((d) => d.at)
    if (!group.pk) {
      timeline.push({ label: `${group.label} doses`, at: markers })
      continue
    }
    const points = simulate(group.doses, group.pk.params, window, 400)
    panels.push({
      title: `${group.label}, estimated (mg)`,
      x: 'time',
      window,
      scale: 'zero',
      unitLabel: 'mg',
      decimals: 3,
      series: [
        {
          label: 'Estimated amount',
          style: 'area',
          tone: 'logged',
          points: points.map((p) => ({ at: p.at, value: p.amount })),
        },
      ],
      band: [],
      markers,
      guides: [],
      now: null,
    })
  }
  if (chosen.has('symptoms') && rows.symptoms.length) {
    timeline.push({ label: 'Side effects', at: rows.symptoms.map((s) => toEpochMs(s.occurredAt)) })
  }
  if (!panels.length && !timeline.length) return null
  const notes = ['Each panel has its own scale; they share only the time axis.']
  if (panels.some((p) => p.scale === 'zero')) notes.push(LEVELS_NOTE)
  return { window, panels, timeline, notes }
}

const COHORT_TITLES: Record<CohortMeasure, string> = {
  weight: 'weight',
  hba1c: 'HbA1c',
  fastingGlucose: 'fasting glucose',
}

/**
 * Each medicine's trial comparison as the app draws it, opening on the same trials: weight
 * always, and HbA1c or fasting glucose when the user has logged that measure. Week 0 is the
 * first dose of the medicine, whatever period the report covers.
 */
function collectCohort(source: Source): ReportCohort[] {
  const { units } = source
  const weights = source.weights.map((w) => ({ at: toEpochMs(w.measuredAt), kg: w.kg }))
  const readings = (fasting: boolean) =>
    source.glucose
      .filter((g) => (fasting ? g.kind === 'glucose' && g.context === 'fasting' : g.kind === 'a1c'))
      .map((g) => ({ at: toEpochMs(g.measuredAt), value: g.value }))
  const a1c = readings(false)
  const fasting = readings(true)
  const out: ReportCohort[] = []
  for (const product of productsInUse(source)) {
    const firstDoseAt =
      source.levelGroups.find((g) => g.pkProfile === product.pkProfile)?.doses[0]?.at ?? null
    const measures = cohortMeasures(catalog.trials, product.molecule, product.route).filter(
      (m) => m === 'weight' || (m === 'hba1c' ? a1c.length : fasting.length),
    )
    for (const measure of measures) {
      const population = defaultPopulation(catalog.trials, product.molecule, product.route, measure)
      const mixed = hasMixedPopulations(catalog.trials, product.molecule, product.route, measure)
      const summary = cohortReadouts(
        catalog.trials,
        product.molecule,
        product.route,
        measure,
        population,
      )
      const user = cohortUserSeries(measure, { weights, a1c, fasting, firstDoseAt })
      const toDisplay = (change: number) =>
        measure === 'hba1c'
          ? a1cChangeIn(change, units.a1c)
          : measure === 'fastingGlucose'
            ? fromMgDl(change, units.glucose)
            : change
      const active = summary.readouts.filter((r) => !r.placebo)
      const point = (r: (typeof summary.readouts)[number]) => ({
        at: r.weeks,
        value: toDisplay(r.change),
        hollow: r.printedKg !== null,
      })
      const lastWeek = Math.max(
        ...summary.readouts.map((r) => r.weeks),
        ...user.map((p) => p.weeks),
        1,
      )
      // The chart title names the unit; HbA1c points carry no suffix of their own.
      const unitLabel =
        measure === 'weight'
          ? '%'
          : measure === 'hba1c'
            ? units.a1c === '%'
              ? ''
              : 'mmol/mol'
            : units.glucose
      const series: ReportChart['series'] = [
        ...(user.length > 1
          ? [
              {
                label: 'You',
                style: 'line' as const,
                tone: 'logged' as const,
                points: user.map((p) => ({ at: p.weeks, value: toDisplay(p.change) })),
              },
            ]
          : []),
        ...(active.some((r) => r.population === 'obesity')
          ? [
              {
                label: 'Without diabetes',
                style: 'diamond' as const,
                tone: 'trial' as const,
                points: active.filter((r) => r.population === 'obesity').map(point),
              },
            ]
          : []),
        ...(active.some((r) => r.population === 't2d')
          ? [
              {
                label: 'With type 2 diabetes',
                style: 'triangle' as const,
                tone: 'trial' as const,
                points: active.filter((r) => r.population === 't2d').map(point),
              },
            ]
          : []),
        ...(summary.readouts.some((r) => r.placebo)
          ? [
              {
                label: 'Placebo',
                style: 'hollow' as const,
                tone: 'placebo' as const,
                points: summary.readouts.filter((r) => r.placebo).map(point),
              },
            ]
          : []),
      ]
      const start =
        firstDoseAt === null
          ? `Log a dose of ${product.name} to add your own line.`
          : `Week 0 is your first ${product.molecule} dose on ${formatDate(firstDoseAt)}.`
      out.push({
        title: `${findPkProfile(product.pkProfile)?.name ?? product.molecule}: ${COHORT_TITLES[measure]}`,
        chart: {
          title:
            measure === 'weight'
              ? 'Change in weight, % of starting weight'
              : measure === 'hba1c'
                ? `Change in HbA1c, ${units.a1c === '%' ? 'percentage points' : 'mmol/mol'}`
                : `Change in fasting glucose, ${units.glucose}`,
          x: 'weeks',
          window: { start: 0, end: Math.ceil((lastWeek + 2) / 12) * 12 },
          scale: 'fit',
          unitLabel,
          decimals: 1,
          series,
          band: summary.band.map((b) => ({
            at: b.weeks,
            low: toDisplay(b.low),
            high: toDisplay(b.high),
          })),
          markers: [],
          // Week 0 is everyone's start, so no change is the line every point is read against.
          guides: [{ value: 0, label: 'No change' }],
          now: null,
        },
        caption: [
          start,
          ...cohortNotes(summary, measure, population, mixed),
          ...(product.kind === 'compounded' ? ['These trials used the brand product.'] : []),
          'Trials are a reference, not a target.',
        ],
        citations: summary.sources.map(
          (s) => `${SOURCE_KIND_LABELS[s.kind]}: ${s.citation}${s.url ? ` (${s.url})` : ''}`,
        ),
      })
    }
  }
  return out
}

/**
 * Gather what the report prints for `period` and the chosen sections, formatted for the
 * reader's locale and units. Level curves count every logged dose, including those before the
 * period, because earlier doses are still in the body. Tables are newest first, as History
 * lists them.
 */
export function collectReport(source: ReportSource): ReportData {
  const { period, now, units } = source
  const rows = inPeriod(source)
  const available = availableSections(source)
  const chosen = new Set(source.sections.filter((s) => available.has(s)))
  const medsById = new Map(source.medications.map((m) => [m.id, m]))

  const times = [
    ...rows.doses.map((d) => d.takenAt),
    ...rows.weights.map((w) => w.measuredAt),
    ...rows.symptoms.map((s) => s.occurredAt),
    ...rows.a1c.map((g) => g.measuredAt),
    ...rows.glucose.map((g) => g.measuredAt),
  ].map(toEpochMs)
  const start = Number.isFinite(rows.since) ? rows.since : Math.min(now, ...times)
  const periodLabel =
    period === 'all'
      ? `Everything logged (${formatDateRange(start, now)})`
      : `Last ${period === '30d' ? 30 : 90} days (${formatDateRange(start, now)})`

  const medsInUse = source.medications.filter(
    (m) => m.status === 'active' || rows.doses.some((d) => d.medicationId === m.id),
  )
  const summary: [string, string][] = [
    ['Medications', String(medsInUse.length)],
    ['Doses logged', String(rows.doses.length)],
  ]
  if (rows.weights.length > 1) {
    const [latest, first] = [rows.weights[0]!, rows.weights[rows.weights.length - 1]!]
    summary.push([
      'Weight change',
      `${formatWeightChange(latest.kg - first.kg, units.weight)} (${formatPercentChange(((latest.kg - first.kg) / first.kg) * 100)})`,
    ])
  }
  if (rows.a1c[0]) summary.push(['Latest HbA1c', formatA1c(rows.a1c[0].value, units.a1c)])
  if (rows.symptoms.length) summary.push(['Side effects logged', String(rows.symptoms.length)])

  const symptoms = chosen.has('symptoms')
    ? {
        table: {
          columns: [
            { title: 'Side effect', width: 0.34, align: 'left' },
            { title: 'Times', width: 0.08, align: 'right' },
            { title: 'Strength', width: 0.24, align: 'left' },
            { title: 'Usually', width: 0.2, align: 'left' },
            { title: 'Last', width: 0.14, align: 'left' },
          ] as const,
          rows: summarizeSymptoms(
            rows.symptoms.map((s) => ({ ...s, at: toEpochMs(s.occurredAt) })),
            source.doses.map((d) => toEpochMs(d.takenAt)),
            rows.since,
          ).map((s) => {
            const term = s.symptom !== 'other' ? SYMPTOM_LABEL_TERMS[s.symptom] : undefined
            return [
              term ? `${s.name} (${term})` : s.name,
              String(s.count),
              SEVERITIES.filter((l) => s.bySeverity[l])
                .map((l) => `${s.bySeverity[l]} ${SEVERITY_LABELS[l].toLowerCase()}`)
                .join(', '),
              s.medianDaysAfterDose === null
                ? 'Before any dose'
                : `${plural(roundTo(s.medianDaysAfterDose, 1), 'day')} after a dose`,
              formatDate(s.lastAt),
            ]
          }),
          empty: 'No side effects logged in this period.',
        },
        notes: [
          '"Usually" is the median time from the dose before each entry. Strength: mild, ' +
            'noticeable but not in the way; moderate, got in the way of some things; severe, ' +
            'stopped them.',
          `Bracketed terms: ${SYMPTOM_SOURCES.map((s) => s.citation).join('; ')}.`,
        ],
      }
    : null

  const doses = chosen.has('doses')
    ? {
        medications: {
          columns: [
            { title: 'Medication', width: 0.28, align: 'left' },
            { title: 'Medicine', width: 0.18, align: 'left' },
            { title: 'Schedule', width: 0.18, align: 'left' },
            { title: 'Doses', width: 0.1, align: 'right' },
            { title: 'Latest dose', width: 0.26, align: 'left' },
          ] as const,
          rows: medsInUse.map((m) => {
            const product = findProduct(m.productId)
            const own = rows.doses.filter((d) => d.medicationId === m.id)
            return [
              m.name,
              product ? product.molecule : 'Not in the catalog',
              `${interval(m.intervalDays)}${m.status === 'archived' ? ' · stopped' : ''}`,
              String(own.length),
              own[0] ? `${formatDose(own[0].doseMg)}, ${formatDate(own[0].takenAt)}` : '',
            ]
          }),
          empty: 'No medications in this period.',
        },
        log: {
          columns: [
            { title: 'When', width: 0.24, align: 'left' },
            { title: 'Medication', width: 0.26, align: 'left' },
            { title: 'Dose', width: 0.12, align: 'right' },
            { title: 'Site', width: 0.14, align: 'left' },
            { title: 'Notes', width: 0.24, align: 'left', muted: true },
          ] as const,
          rows: rows.doses.map((d) => [
            formatDateTime(d.takenAt),
            medsById.get(d.medicationId)?.name ?? '',
            formatDose(d.doseMg),
            d.site ? SITE_LABELS[d.site] : '',
            d.notes,
          ]),
          empty: 'No doses logged in this period.',
        },
      }
    : null

  return {
    pageSize: pageSizeFor(source.locale),
    generated: formatDateTime(now),
    periodLabel,
    summary,
    combined: chosen.has('combined')
      ? collectCombined(
          source,
          rows,
          { start: start === now ? now - DAY_MS : start, end: now },
          chosen,
        )
      : null,
    weight: chosen.has('weight') ? collectWeight(source, rows) : null,
    sugar: chosen.has('sugar') ? collectSugar(source, rows) : null,
    cohort: chosen.has('cohort') ? collectCohort(source) : null,
    levels: chosen.has('levels')
      ? dosedGroups(source, rows).map((g) =>
          describeLevels(
            g,
            rows.doses.filter((d) => g.medicationIds.includes(d.medicationId)),
            rows,
            now,
          ),
        )
      : null,
    symptoms,
    doses,
    formatTick: formatAxisTick,
  }
}

import type { PageSize } from '@/services/pdf/pageSize'

/**
 * What the PDF report prints, already formatted for the reader's locale and units. The
 * collector (`collectReport`) builds it from the stores; the renderer (`renderReport`) only
 * places it. A section the reader left out is null.
 */

/** The parts of the report the reader can choose, in the order they print. */
export const REPORT_SECTIONS = [
  'combined',
  'weight',
  'sugar',
  'cohort',
  'levels',
  'symptoms',
  'doses',
] as const
export type ReportSection = (typeof REPORT_SECTIONS)[number]

interface ReportPoint {
  /** Epoch milliseconds, or weeks since the first dose on a cohort chart. */
  at: number
  value: number
  /** Drawn open: a trial percent worked out from kilograms rather than printed. */
  hollow?: boolean
}

export interface ReportSeries {
  label: string
  /**
   * `area` is a curve filled down to zero (estimated levels); `line` joins readings; the rest
   * are unjoined points, told apart by shape rather than colour alone.
   */
  style: 'line' | 'area' | 'points' | 'hollow' | 'diamond' | 'triangle'
  tone: 'logged' | 'preview' | 'trial' | 'placebo'
  /** Oldest first, in the unit the chart is labelled in. */
  points: readonly ReportPoint[]
}

/** A chart, already in the reader's units; the renderer draws but never computes. */
export interface ReportChart {
  /** Printed above the plot, such as "Weight (kg)"; null when the section heading says it. */
  title: string | null
  /** `time` in epoch ms, or `weeks` since the first dose for a trial comparison. */
  x: 'time' | 'weeks'
  window: { start: number; end: number }
  /** `zero` starts the axis at zero (amounts); `fit` spans the values (body measures). */
  scale: 'zero' | 'fit'
  unitLabel: string
  decimals: number
  series: readonly ReportSeries[]
  /** A shaded range, such as the spread of trial arms at each readout week. */
  band: readonly { at: number; low: number; high: number }[]
  /** Doses, marked as triangles on the baseline. */
  markers: readonly number[]
  /** Dashed reference lines, such as BMI band edges or a goal weight. */
  guides: readonly { value: number; label: string }[]
  /** A dashed "Now" line when it falls inside the window. */
  now: number | null
}

/** A row of instants on the combined chart's time axis: doses without a curve, side effects. */
export interface ReportTimelineRow {
  label: string
  at: readonly number[]
}

export interface ReportColumn {
  title: string
  /** Share of the page width, the columns summing to 1. */
  width: number
  align: 'left' | 'right'
  /** Printed in the secondary text colour, as for notes. */
  muted?: boolean
}

export interface ReportTable {
  columns: readonly ReportColumn[]
  rows: readonly (readonly string[])[]
  /** Shown in place of the table when there are no rows. */
  empty: string
}

export type ReportStats = readonly (readonly [string, string])[]

/** Where a curve's half-life and time to peak came from. */
interface ReportPk {
  halfLife: string
  peak: string
  /** "Prescribing label", "Clinical trial" or "Your values". */
  sourceLabel: string
  userSupplied: boolean
  /** Ranges or caveats from the source. */
  notes: string
  citations: readonly string[]
}

export interface ReportLevels {
  name: string
  stats: ReportStats
  pk: ReportPk | null
  curve: { chart: ReportChart; note: string | null } | null
  /** Why there is no curve, shown in its place. */
  noCurveReason: string | null
}

export interface ReportCombined {
  /** The period: every panel and the timeline share it. */
  window: { start: number; end: number }
  /** Stacked on one time axis, top to bottom. */
  panels: readonly ReportChart[]
  timeline: readonly ReportTimelineRow[]
  notes: readonly string[]
}

export interface ReportCohort {
  /** "Semaglutide injection: weight". */
  title: string
  chart: ReportChart
  /** How to read the chart, starting with what week 0 is. */
  caption: readonly string[]
  citations: readonly string[]
}

export interface ReportWeight {
  stats: ReportStats
  /** Null with fewer than two weigh-ins. */
  weight: ReportChart | null
  /** Null without a height in the profile, or with fewer than two weigh-ins. */
  bmi: ReportChart | null
  notes: readonly string[]
}

export interface ReportSugar {
  a1cChart: ReportChart | null
  glucoseChart: ReportChart | null
  a1c: ReportTable
  glucose: ReportTable
}

export interface ReportData {
  pageSize: PageSize
  generated: string
  periodLabel: string
  /** Headline figures for the period, label then value. */
  summary: ReportStats
  combined: ReportCombined | null
  weight: ReportWeight | null
  sugar: ReportSugar | null
  cohort: readonly ReportCohort[] | null
  levels: readonly ReportLevels[] | null
  symptoms: { table: ReportTable; notes: readonly string[] } | null
  doses: { medications: ReportTable; log: ReportTable } | null
  /** Axis label for an instant; `spanMs` lets it drop the date or the time. */
  formatTick: (epochMs: number, spanMs: number) => string
}

import type { SourceRef, Trial } from './catalog'
import { roundTo } from './units'

/**
 * Blood sugar: HbA1c and glucose readings. Stored canonically and unrounded (HbA1c in NGSP
 * percent, glucose in mg/dL, the units US labels print), with the unit the user typed; the
 * display unit is a setting, converted only for display and entry, as weight is.
 */
export type A1cUnit = '%' | 'mmol/mol'
export type GlucoseUnit = 'mg/dL' | 'mmol/L'

export const A1C_UNITS: readonly A1cUnit[] = ['%', 'mmol/mol']
export const GLUCOSE_UNITS: readonly GlucoseUnit[] = ['mg/dL', 'mmol/L']

/** Glucose's molar mass is 180.16 g/mol, so 1 mmol/L is 18.016 mg/dL. */
const MG_DL_PER_MMOL_L = 18.016

/**
 * The IFCC-NGSP master equation as NGSP publishes it: NGSP (%) = 0.09148 x IFCC (mmol/mol)
 * + 2.152. Both directions use these two constants, so a round trip is exact.
 */
const NGSP_PER_IFCC = 0.09148
const NGSP_OFFSET = 2.152

export const GLUCOSE_UNIT_SOURCES: SourceRef[] = [
  {
    kind: 'standard',
    citation: 'NGSP: HbA1c in NGSP percent and IFCC mmol/mol (the IFCC-NGSP master equation)',
    url: 'https://ngsp.org/ifccngsp.asp',
  },
  {
    kind: 'standard',
    citation: 'Glucose molar mass 180.16 g/mol: 1 mmol/L = 18.016 mg/dL (PubChem, glucose)',
    url: 'https://pubchem.ncbi.nlm.nih.gov/compound/D-Glucose',
  },
]

export function toMgDl(value: number, unit: GlucoseUnit): number {
  return unit === 'mg/dL' ? value : value * MG_DL_PER_MMOL_L
}

export function fromMgDl(mgDl: number, unit: GlucoseUnit): number {
  return unit === 'mg/dL' ? mgDl : mgDl / MG_DL_PER_MMOL_L
}

export function toA1cPercent(value: number, unit: A1cUnit): number {
  return unit === '%' ? value : value * NGSP_PER_IFCC + NGSP_OFFSET
}

export function fromA1cPercent(percent: number, unit: A1cUnit): number {
  return unit === '%' ? percent : (percent - NGSP_OFFSET) / NGSP_PER_IFCC
}

/** Display precision follows the lab convention for each unit. */
const GLUCOSE_DECIMALS: Record<GlucoseUnit, number> = { 'mg/dL': 0, 'mmol/L': 1 }
const A1C_DECIMALS: Record<A1cUnit, number> = { '%': 1, 'mmol/mol': 0 }

/** Decimals to show a value in `unit`, for entry fields and tables. */
export function decimalsFor(unit: GlucoseUnit | A1cUnit): number {
  return unit in GLUCOSE_DECIMALS
    ? GLUCOSE_DECIMALS[unit as GlucoseUnit]
    : A1C_DECIMALS[unit as A1cUnit]
}

export function formatGlucose(mgDl: number, unit: GlucoseUnit): string {
  return `${roundTo(fromMgDl(mgDl, unit), GLUCOSE_DECIMALS[unit])} ${unit}`
}

/** "6.4%" or "46 mmol/mol". */
export function formatA1c(percent: number, unit: A1cUnit): string {
  const value = roundTo(fromA1cPercent(percent, unit), A1C_DECIMALS[unit])
  return unit === '%' ? `${value}%` : `${value} ${unit}`
}

function signed(value: number, decimals: number, suffix: string): string {
  const size = roundTo(Math.abs(value), decimals)
  if (size === 0) return `0${suffix}`
  return `${value > 0 ? '+' : '−'}${size}${suffix}`
}

/** A signed change in mg/dL shown in `unit`: "-41 mg/dL". */
export function formatGlucoseChange(deltaMgDl: number, unit: GlucoseUnit): string {
  return signed(fromMgDl(deltaMgDl, unit), GLUCOSE_DECIMALS[unit], ` ${unit}`)
}

/**
 * A signed change in percentage points shown in `unit`. The master equation is linear, so a
 * change scales by its slope alone: -1.6 points is -17 mmol/mol.
 */
export function formatA1cChange(deltaPercent: number, unit: A1cUnit): string {
  return unit === '%'
    ? signed(deltaPercent, 1, ' points')
    : signed(deltaPercent / NGSP_PER_IFCC, 0, ' mmol/mol')
}

/** Readings outside these are typos, not results; both cover what a meter or lab reports. */
export const A1C_RANGE = { min: 3, max: 20 } as const
export const GLUCOSE_RANGE_MG_DL = { min: 20, max: 600 } as const

export function isValidA1c(percent: number): boolean {
  return Number.isFinite(percent) && percent >= A1C_RANGE.min && percent <= A1C_RANGE.max
}

export function isValidGlucose(mgDl: number): boolean {
  return Number.isFinite(mgDl) && mgDl >= GLUCOSE_RANGE_MG_DL.min && mgDl <= GLUCOSE_RANGE_MG_DL.max
}

/** When a glucose reading was taken. Only fasting readings are set beside trial results. */
export const GLUCOSE_CONTEXTS = [
  'fasting',
  'before-meal',
  'after-meal',
  'bedtime',
  'other',
] as const
export type GlucoseContext = (typeof GLUCOSE_CONTEXTS)[number]

export const GLUCOSE_CONTEXT_LABELS: Record<GlucoseContext, string> = {
  fasting: 'Fasting',
  'before-meal': 'Before a meal',
  'after-meal': 'After a meal',
  bedtime: 'Bedtime',
  other: 'Other',
}

export interface Reading {
  /** Epoch milliseconds. */
  at: number
  /** HbA1c in percent or glucose in mg/dL. */
  value: number
}

const WEEK_MS = 7 * 86_400_000

export interface GlycemicBaseline extends Reading {
  /** As for weight: the last reading at or before the first dose, else the first after it. */
  basis: 'before-first-dose' | 'after-first-dose'
}

/** The reading a change is measured from, or null without a dose or a reading. */
export function glycemicBaseline(
  readings: readonly Reading[],
  firstDoseAt: number | null,
): GlycemicBaseline | null {
  if (firstDoseAt === null || !readings.length) return null
  const sorted = [...readings].sort((a, b) => a.at - b.at)
  const before = sorted.filter((r) => r.at <= firstDoseAt)
  if (before.length) return { ...before[before.length - 1]!, basis: 'before-first-dose' }
  return { ...sorted[0]!, basis: 'after-first-dose' }
}

export type GlycemicMeasure = 'hba1c' | 'fastingGlucose'

export interface GlycemicComparison {
  trial: Trial
  measure: GlycemicMeasure
  baseline: GlycemicBaseline | null
  /** The latest reading after the baseline, up to the endpoint week, as a change from it. */
  user: { weeks: number; value: number; change: number } | null
  arms: { label: string; baseline: number; change: number; placebo: boolean }[]
}

/**
 * Sets the user's HbA1c or fasting glucose beside a trial's published endpoint changes, in the
 * same way weight is compared: change from the reading nearest the first dose to the latest one
 * up to the endpoint week. Null when the trial does not print the measure.
 */
export function compareGlycemic(
  readings: readonly Reading[],
  firstDoseAt: number | null,
  trial: Trial,
  measure: GlycemicMeasure,
): GlycemicComparison | null {
  const arms = trial.arms.flatMap((a) => {
    const result = measure === 'hba1c' ? a.hba1c : a.fastingGlucoseMgDl
    return result ? [{ label: a.label, ...result, placebo: a.doseMg === null }] : []
  })
  if (!arms.length) return null
  const baseline = glycemicBaseline(readings, firstDoseAt)
  let user: GlycemicComparison['user'] = null
  if (baseline && firstDoseAt !== null) {
    const after = readings
      .filter((r) => r.at > baseline.at && r.at > firstDoseAt)
      .map((r) => ({ ...r, weeks: (r.at - firstDoseAt) / WEEK_MS }))
      .filter((r) => r.weeks <= trial.weeks)
      .sort((a, b) => a.at - b.at)
    const last = after[after.length - 1]
    if (last) user = { weeks: last.weeks, value: last.value, change: last.value - baseline.value }
  }
  return { trial, measure, baseline, user, arms }
}

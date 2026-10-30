import Dexie, { type EntityTable } from 'dexie'
import type { A1cUnit, GlucoseContext, GlucoseUnit } from '@/domain/glucose'
import type { PkParameters } from '@/domain/pk'
import type { Severity, Symptom } from '@/domain/symptoms'
import type { WeightUnit } from '@/domain/units'

/** A medication the user takes or has taken. Timestamps are UTC ISO-8601. */
export interface MedicationRow {
  id: string
  /** Catalog product id, or null for a medication the catalog does not list. */
  productId: string | null
  name: string
  /** Days between doses: 7 for weekly pens, 1 for daily tablets, or the user's own schedule. */
  intervalDays: number
  /** Strength of a compounded vial, so a dose also reads as syringe units; null otherwise. */
  concentrationMgPerMl: number | null
  /** User-supplied PK for a medication outside the catalog; never overrides catalog data. */
  pkOverride: PkParameters | null
  status: 'active' | 'archived'
  notes: string
  createdAt: string
  updatedAt: string
}

export const INJECTION_SITES = [
  'abdomen-left',
  'abdomen-right',
  'thigh-left',
  'thigh-right',
  'arm-left',
  'arm-right',
] as const

export type InjectionSite = (typeof INJECTION_SITES)[number]

export interface DoseRow {
  id: string
  medicationId: string
  takenAt: string
  doseMg: number
  /** Where an injection went, for rotation; null for tablets or when not recorded. */
  site: InjectionSite | null
  notes: string
  createdAt: string
}

export interface WeightRow {
  id: string
  measuredAt: string
  /** Unrounded, so switching units never compounds rounding. */
  kg: number
  /** The unit the user typed, so an edit shows the number they entered. */
  enteredUnit: WeightUnit
  notes: string
  createdAt: string
}

/** A side effect the user felt, for their own record and to share with a prescriber. */
export interface SymptomRow {
  id: string
  occurredAt: string
  symptom: Symptom
  /** The user's words when `symptom` is `other`; empty otherwise. */
  otherText: string
  severity: Severity
  notes: string
  createdAt: string
}

/**
 * An HbA1c result or a glucose reading. `value` is canonical and unrounded: HbA1c in NGSP
 * percent, glucose in mg/dL.
 */
export type GlucoseRow = {
  id: string
  measuredAt: string
  value: number
  notes: string
  createdAt: string
} & (
  | { kind: 'a1c'; enteredUnit: A1cUnit; context: null }
  | { kind: 'glucose'; enteredUnit: GlucoseUnit; context: GlucoseContext }
)

export interface SettingRow {
  key: string
  value: unknown
}

export type TidebookDb = Dexie & {
  medications: EntityTable<MedicationRow, 'id'>
  doses: EntityTable<DoseRow, 'id'>
  weights: EntityTable<WeightRow, 'id'>
  symptoms: EntityTable<SymptomRow, 'id'>
  glucose: EntityTable<GlucoseRow, 'id'>
  settings: EntityTable<SettingRow, 'key'>
}

const DB_NAME = 'tidebook'

/*
 * Schema history. Never edit a released version: add a new `db.version(n + 1)` with an
 * `.upgrade()` that migrates existing rows, because users' only copy of their data is here.
 * Indexes list only fields that are queried; other fields are stored but not indexed.
 */
export function createDatabase(name = DB_NAME): TidebookDb {
  const db = new Dexie(name) as TidebookDb
  db.version(1).stores({
    medications: 'id, status, productId, createdAt',
    doses: 'id, medicationId, takenAt',
    weights: 'id, measuredAt',
    settings: 'key',
  })
  // Side effects and blood sugar: new tables only, so existing rows need no upgrade.
  db.version(2).stores({
    symptoms: 'id, occurredAt',
    glucose: 'id, kind, measuredAt',
  })
  return db
}

export const db = createDatabase()

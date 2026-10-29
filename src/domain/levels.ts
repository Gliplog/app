import {
  chartWindow,
  simulate,
  summarizeLevels,
  type DoseEvent,
  type LevelSummary,
  type PkParameters,
  type PkPoint,
  type SimulationWindow,
} from './pk'

/** A medication as the level grouping needs it; the caller resolves its PK. */
export interface LevelMedication {
  id: string
  /** The catalog PK profile ("semaglutide-injection"), or null outside the catalog. */
  pkProfile: string | null
  /** Display name for the group: the profile name, or the medication's own name. */
  label: string
  pk: { params: PkParameters; userSupplied: boolean } | null
}

export interface LevelDose {
  medicationId: string
  /** Epoch milliseconds. */
  at: number
  doseMg: number
}

export interface MedicationLevels {
  key: string
  pkProfile: string | null
  label: string
  /** PK of the most recently dosed medication in the group, or null when none is known. */
  pk: { params: PkParameters; userSupplied: boolean } | null
  /** Oldest first, in mg. */
  doses: DoseEvent[]
  medicationCount: number
  latestAt: number
}

/** The pooling key: a catalog profile is shared; a medication outside the catalog is its own. */
export function levelKey(med: { id: string; pkProfile: string | null }): string {
  return med.pkProfile ?? `med:${med.id}`
}

/**
 * Pool every dose of the same molecule and route, across medications, so the estimate reflects
 * everything still in the body: someone switching from Ozempic to compounded semaglutide has
 * one curve, not two. Doses whose medication no longer exists are skipped. Newest group first.
 */
export function groupLevels(
  medications: readonly LevelMedication[],
  doses: readonly LevelDose[],
): MedicationLevels[] {
  const byId = new Map(medications.map((m) => [m.id, m]))
  const byKey = new Map<string, { med: LevelMedication; dose: LevelDose }[]>()
  for (const dose of doses) {
    const med = byId.get(dose.medicationId)
    if (!med) continue
    const key = levelKey(med)
    const list = byKey.get(key) ?? []
    list.push({ med, dose })
    byKey.set(key, list)
  }
  const groups: MedicationLevels[] = []
  for (const [key, entries] of byKey) {
    entries.sort((a, b) => a.dose.at - b.dose.at)
    const latest = entries[entries.length - 1]!
    groups.push({
      key,
      pkProfile: latest.med.pkProfile,
      label: latest.med.label,
      pk: latest.med.pk,
      doses: entries.map((e) => ({ at: e.dose.at, amount: e.dose.doseMg })),
      medicationCount: new Set(entries.map((e) => e.med.id)).size,
      latestAt: latest.dose.at,
    })
  }
  return groups.sort((a, b) => b.latestAt - a.latestAt)
}

export interface LevelsInput {
  params: PkParameters
  /** Logged doses in mg. */
  doses: DoseEvent[]
  /** A dose being logged, drawn as a dashed projection; null when only history is shown. */
  preview: DoseEvent | null
  unitLabel: string
  now: number
  lookbackHours?: number
}

export interface LevelsModel {
  window: SimulationWindow
  allDoses: DoseEvent[]
  logged: PkPoint[]
  projected: PkPoint[]
  summary: LevelSummary
}

/**
 * Everything a levels chart draws (the curve, its table and the headline readings), computed
 * once from the inputs so they always agree.
 */
export function levelsModel(input: LevelsInput): LevelsModel {
  const { params, doses, preview, now, lookbackHours } = input
  const allDoses = preview ? [...doses, preview] : doses
  const window = chartWindow(allDoses, params, now, lookbackHours)
  const logged = doses.length ? simulate(doses, params, window) : []
  const projected = preview ? simulate(allDoses, params, window) : []
  return {
    window,
    allDoses,
    logged,
    projected,
    summary: summarizeLevels(preview ? projected : logged, allDoses, params, now),
  }
}

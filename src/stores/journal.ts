import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { repository } from '@/db'
import type {
  DoseRow,
  GlucoseRow,
  MedicationRow,
  SymptomRow,
  VitalRow,
  WeightRow,
} from '@/db/database'
import type {
  NewDose,
  NewGlucose,
  NewMedication,
  NewSymptom,
  NewVital,
  NewWeight,
} from '@/db/repository'
import { findPkProfile, findProduct } from '@/data'
import type { CatalogProduct } from '@/domain/catalog'
import {
  groupLevels,
  levelKey,
  type LevelDose,
  type LevelMedication,
  type MedicationLevels,
} from '@/domain/levels'
import type { DoseEvent, PkParameters } from '@/domain/pk'
import { baselineFor, progressSeries, type Baseline, type ProgressPoint } from '@/domain/progress'
import { projectLevels, type LevelProjection } from '@/domain/projection'
import { nextDueAt } from '@/domain/schedule'
import { toEpochMs } from '@/services/time'

export interface MedicationProjection {
  projection: LevelProjection
  /** The curve comes from the user's own half-life. */
  userSupplied: boolean
}

/**
 * The user's journal: medications, the doses logged against them, weigh-ins, side effects,
 * blood sugar readings and vitals. The whole
 * dataset is small enough to hold in memory, so the store loads everything once and reloads
 * after each write.
 */
export const useJournalStore = defineStore('journal', () => {
  const medications = ref<MedicationRow[]>([])
  /** Newest first. */
  const doses = ref<DoseRow[]>([])
  /** Newest first. */
  const weights = ref<WeightRow[]>([])
  /** Newest first. */
  const symptoms = ref<SymptomRow[]>([])
  /** HbA1c results and glucose readings, newest first. */
  const glucose = ref<GlucoseRow[]>([])
  /** Blood pressure and resting heart rate readings, newest first. */
  const vitals = ref<VitalRow[]>([])
  const loaded = ref(false)

  async function load() {
    const [m, d, w, s, g, v] = await Promise.all([
      repository.listMedications(),
      repository.listDoses(),
      repository.listWeights(),
      repository.listSymptoms(),
      repository.listGlucose(),
      repository.listVitals(),
    ])
    medications.value = m
    doses.value = d
    weights.value = w
    symptoms.value = s
    glucose.value = g
    vitals.value = v
    loaded.value = true
  }

  function medicationById(id: string): MedicationRow | undefined {
    return medications.value.find((m) => m.id === id)
  }

  function productOf(med: MedicationRow | undefined): CatalogProduct | undefined {
    return findProduct(med?.productId)
  }

  function dosesFor(medicationId: string): DoseRow[] {
    return doses.value.filter((d) => d.medicationId === medicationId)
  }

  function lastDoseOf(medicationId: string): DoseRow | undefined {
    return doses.value.find((d) => d.medicationId === medicationId)
  }

  /** Epoch ms the next dose of `med` is due, from its last dose and interval; null before any dose. */
  function nextDueOf(med: MedicationRow): number | null {
    const last = lastDoseOf(med.id)
    return nextDueAt(last ? toEpochMs(last.takenAt) : null, med.intervalDays)
  }

  const activeMedications = computed(() => medications.value.filter((m) => m.status === 'active'))
  const archivedMedications = computed(() =>
    medications.value.filter((m) => m.status === 'archived'),
  )

  /** The medication in use now: the active one dosed most recently, else the newest active one. */
  const currentMedication = computed<MedicationRow | undefined>(() => {
    const active = new Set(activeMedications.value.map((m) => m.id))
    const recent = doses.value.find((d) => active.has(d.medicationId))
    return recent ? medicationById(recent.medicationId) : activeMedications.value[0]
  })

  /**
   * The medication the user chose to look at on Today, which Progress follows for its trial
   * comparison. Held in memory only: a fresh launch opens on the medication in use now.
   */
  const focusedMedicationId = ref<string | null>(null)

  /** The focused medication while it is still active, else the one in use now. */
  const focusedMedication = computed<MedicationRow | undefined>(() => {
    const id = focusedMedicationId.value
    const chosen = id ? activeMedications.value.find((m) => m.id === id) : undefined
    return chosen ?? currentMedication.value
  })

  function focusMedication(id: string) {
    focusedMedicationId.value = id
  }

  /** PK for a medication: the catalog's human data, else the user's own values. */
  function pkFor(med: MedicationRow): { params: PkParameters; userSupplied: boolean } | null {
    const product = productOf(med)
    if (product) {
      const pk = findPkProfile(product.pkProfile)?.pk
      return pk ? { params: pk, userSupplied: false } : null
    }
    return med.pkOverride ? { params: med.pkOverride, userSupplied: true } : null
  }

  const levelMedications = computed<LevelMedication[]>(() =>
    medications.value.map((m) => {
      const product = productOf(m)
      const profile = findPkProfile(product?.pkProfile)
      return {
        id: m.id,
        pkProfile: profile?.id ?? null,
        label: profile?.name ?? m.name,
        pk: pkFor(m),
      }
    }),
  )
  const levelDoses = computed<LevelDose[]>(() =>
    doses.value.map((d) => ({
      medicationId: d.medicationId,
      at: toEpochMs(d.takenAt),
      doseMg: d.doseMg,
    })),
  )

  /** Every dose pooled per molecule and route, newest group first (see groupLevels). */
  const levelGroups = computed<MedicationLevels[]>(() =>
    groupLevels(levelMedications.value, levelDoses.value),
  )

  /** The level group a medication's doses belong to, if it has any doses. */
  function levelGroupOf(med: MedicationRow): MedicationLevels | undefined {
    const key = levelMedications.value.find((m) => m.id === med.id)
    const groupKey = key?.pkProfile ?? `med:${med.id}`
    return levelGroups.value.find((g) => g.key === groupKey)
  }

  /**
   * Doses already in the body under a catalog profile, or for a medication outside the catalog,
   * oldest first. Serves the form too, where the medication may not exist yet: someone adding
   * compounded semaglutide after Ozempic carries the same curve forward.
   */
  function historyFor(id: string | undefined, pkProfile: string | null | undefined): DoseEvent[] {
    const key = levelKey({ id: id ?? '', pkProfile: pkProfile ?? null })
    return levelGroups.value.find((g) => g.key === key)?.doses ?? []
  }

  /**
   * Where a medication's levels are heading on its own schedule, repeating its last logged dose.
   * Null with no curve to continue: no half-life, or nothing logged yet.
   */
  function projectionOf(med: MedicationRow, now: number): MedicationProjection | null {
    const pk = pkFor(med)
    const history = historyFor(med.id, findPkProfile(productOf(med)?.pkProfile)?.id)
    if (!pk || !history.length) return null
    return {
      projection: projectLevels({
        params: pk.params,
        intervalHours: med.intervalDays * 24,
        amount: null,
        history,
        now,
      }),
      userSupplied: pk.userSupplied,
    }
  }

  const weightPoints = computed(() =>
    weights.value.map((w) => ({ at: toEpochMs(w.measuredAt), kg: w.kg })),
  )
  const latestWeight = computed<WeightRow | undefined>(() => weights.value[0])
  const firstDoseAt = computed(() => {
    const oldest = doses.value[doses.value.length - 1]
    return oldest ? toEpochMs(oldest.takenAt) : null
  })
  /** The starting weight progress is measured from (see baselineFor). */
  const baseline = computed<Baseline | null>(() =>
    baselineFor(weightPoints.value, firstDoseAt.value),
  )
  /** Weigh-ins since the baseline, oldest first. */
  const progress = computed<ProgressPoint[]>(() =>
    baseline.value ? progressSeries(weightPoints.value, baseline.value) : [],
  )

  async function addMedication(input: NewMedication): Promise<MedicationRow> {
    const row = await repository.addMedication(input)
    await load()
    return row
  }

  async function updateMedication(id: string, changes: Partial<NewMedication>) {
    await repository.updateMedication(id, changes)
    await load()
  }

  async function deleteMedication(id: string) {
    await repository.deleteMedication(id)
    await load()
  }

  async function addDose(input: NewDose): Promise<DoseRow> {
    const row = await repository.addDose(input)
    await load()
    return row
  }

  async function updateDose(id: string, changes: Partial<NewDose>) {
    await repository.updateDose(id, changes)
    await load()
  }

  async function deleteDose(id: string) {
    await repository.deleteDose(id)
    await load()
  }

  async function addWeight(input: NewWeight): Promise<WeightRow> {
    const row = await repository.addWeight(input)
    await load()
    return row
  }

  async function updateWeight(id: string, changes: Partial<NewWeight>) {
    await repository.updateWeight(id, changes)
    await load()
  }

  async function deleteWeight(id: string) {
    await repository.deleteWeight(id)
    await load()
  }

  async function addSymptoms(inputs: NewSymptom[]): Promise<SymptomRow[]> {
    const rows = await repository.addSymptoms(inputs)
    await load()
    return rows
  }

  async function updateSymptom(id: string, changes: Partial<NewSymptom>) {
    await repository.updateSymptom(id, changes)
    await load()
  }

  async function deleteSymptom(id: string) {
    await repository.deleteSymptom(id)
    await load()
  }

  async function addGlucose(input: NewGlucose): Promise<GlucoseRow> {
    const row = await repository.addGlucose(input)
    await load()
    return row
  }

  async function updateGlucose(id: string, changes: NewGlucose) {
    await repository.updateGlucose(id, changes)
    await load()
  }

  async function deleteGlucose(id: string) {
    await repository.deleteGlucose(id)
    await load()
  }

  async function addVital(input: NewVital): Promise<VitalRow> {
    const row = await repository.addVital(input)
    await load()
    return row
  }

  async function updateVital(id: string, changes: NewVital) {
    await repository.updateVital(id, changes)
    await load()
  }

  async function deleteVital(id: string) {
    await repository.deleteVital(id)
    await load()
  }

  return {
    medications,
    doses,
    weights,
    symptoms,
    glucose,
    vitals,
    loaded,
    activeMedications,
    archivedMedications,
    currentMedication,
    focusedMedication,
    levelGroups,
    latestWeight,
    baseline,
    progress,
    load,
    medicationById,
    productOf,
    dosesFor,
    lastDoseOf,
    nextDueOf,
    pkFor,
    levelGroupOf,
    historyFor,
    projectionOf,
    focusMedication,
    addMedication,
    updateMedication,
    deleteMedication,
    addDose,
    updateDose,
    deleteDose,
    addWeight,
    updateWeight,
    deleteWeight,
    addSymptoms,
    updateSymptom,
    deleteSymptom,
    addGlucose,
    updateGlucose,
    deleteGlucose,
    addVital,
    updateVital,
    deleteVital,
  }
})

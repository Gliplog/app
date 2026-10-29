import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { repository } from '@/db'
import type { DoseRow, MedicationRow, WeightRow } from '@/db/database'
import type { NewDose, NewMedication, NewWeight } from '@/db/repository'
import { findPkProfile, findProduct } from '@/data'
import type { CatalogProduct } from '@/domain/catalog'
import {
  groupLevels,
  type LevelDose,
  type LevelMedication,
  type MedicationLevels,
} from '@/domain/levels'
import type { PkParameters } from '@/domain/pk'
import { baselineFor, progressSeries, type Baseline, type ProgressPoint } from '@/domain/progress'
import { nextDueAt } from '@/domain/schedule'
import { toEpochMs } from '@/services/time'

/**
 * The user's journal: medications, the doses logged against them, and weigh-ins. The whole
 * dataset is small enough to hold in memory, so the store loads everything once and reloads
 * after each write.
 */
export const useJournalStore = defineStore('journal', () => {
  const medications = ref<MedicationRow[]>([])
  /** Newest first. */
  const doses = ref<DoseRow[]>([])
  /** Newest first. */
  const weights = ref<WeightRow[]>([])
  const loaded = ref(false)

  async function load() {
    const [m, d, w] = await Promise.all([
      repository.listMedications(),
      repository.listDoses(),
      repository.listWeights(),
    ])
    medications.value = m
    doses.value = d
    weights.value = w
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

  return {
    medications,
    doses,
    weights,
    loaded,
    activeMedications,
    archivedMedications,
    currentMedication,
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
    addMedication,
    updateMedication,
    deleteMedication,
    addDose,
    updateDose,
    deleteDose,
    addWeight,
    updateWeight,
    deleteWeight,
  }
})

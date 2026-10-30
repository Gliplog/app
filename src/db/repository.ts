import type {
  DoseRow,
  GlucoseRow,
  MedicationRow,
  SymptomRow,
  GliplogDb,
  WeightRow,
} from './database'
import { nowIso, systemClock, type Clock } from '@/services/time'

export type NewMedication = Omit<MedicationRow, 'id' | 'createdAt' | 'updatedAt'>
export type NewDose = Omit<DoseRow, 'id' | 'createdAt'>
export type NewWeight = Omit<WeightRow, 'id' | 'createdAt'>
export type NewSymptom = Omit<SymptomRow, 'id' | 'createdAt'>
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
export type NewGlucose = DistributiveOmit<GlucoseRow, 'id' | 'createdAt'>

/**
 * All reads and writes of user data. Views and stores call this, never Dexie tables directly,
 * so storage rules (ids, timestamps, cascade deletes) live in one place.
 */
export function createRepository(db: GliplogDb, clock: Clock = systemClock) {
  return {
    async listMedications(): Promise<MedicationRow[]> {
      return db.medications.orderBy('createdAt').reverse().toArray()
    },

    async addMedication(input: NewMedication): Promise<MedicationRow> {
      const now = nowIso(clock)
      const row: MedicationRow = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      }
      await db.medications.add(row)
      return row
    },

    async updateMedication(id: string, changes: Partial<NewMedication>): Promise<void> {
      await db.medications.update(id, { ...changes, updatedAt: nowIso(clock) })
    },

    /** Deletes the medication and every dose logged against it, in one transaction. */
    async deleteMedication(id: string): Promise<void> {
      await db.transaction('rw', db.medications, db.doses, async () => {
        await db.doses.where('medicationId').equals(id).delete()
        await db.medications.delete(id)
      })
    },

    async listDoses(): Promise<DoseRow[]> {
      return db.doses.orderBy('takenAt').reverse().toArray()
    },

    async addDose(input: NewDose): Promise<DoseRow> {
      const row: DoseRow = { ...input, id: crypto.randomUUID(), createdAt: nowIso(clock) }
      await db.doses.add(row)
      return row
    },

    async updateDose(id: string, changes: Partial<NewDose>): Promise<void> {
      await db.doses.update(id, changes)
    },

    async deleteDose(id: string): Promise<void> {
      await db.doses.delete(id)
    },

    async listWeights(): Promise<WeightRow[]> {
      return db.weights.orderBy('measuredAt').reverse().toArray()
    },

    async addWeight(input: NewWeight): Promise<WeightRow> {
      const row: WeightRow = { ...input, id: crypto.randomUUID(), createdAt: nowIso(clock) }
      await db.weights.add(row)
      return row
    },

    async updateWeight(id: string, changes: Partial<NewWeight>): Promise<void> {
      await db.weights.update(id, changes)
    },

    async deleteWeight(id: string): Promise<void> {
      await db.weights.delete(id)
    },

    async listSymptoms(): Promise<SymptomRow[]> {
      return db.symptoms.orderBy('occurredAt').reverse().toArray()
    },

    /** Logs several side effects felt at one time, one row each, in one transaction. */
    async addSymptoms(inputs: NewSymptom[]): Promise<SymptomRow[]> {
      const createdAt = nowIso(clock)
      const rows = inputs.map((input) => ({ ...input, id: crypto.randomUUID(), createdAt }))
      await db.symptoms.bulkAdd(rows)
      return rows
    },

    async updateSymptom(id: string, changes: Partial<NewSymptom>): Promise<void> {
      await db.symptoms.update(id, changes)
    },

    async deleteSymptom(id: string): Promise<void> {
      await db.symptoms.delete(id)
    },

    async listGlucose(): Promise<GlucoseRow[]> {
      return db.glucose.orderBy('measuredAt').reverse().toArray()
    },

    async addGlucose(input: NewGlucose): Promise<GlucoseRow> {
      const row = { ...input, id: crypto.randomUUID(), createdAt: nowIso(clock) } as GlucoseRow
      await db.glucose.add(row)
      return row
    },

    async updateGlucose(id: string, changes: NewGlucose): Promise<void> {
      await db.glucose.update(id, changes)
    },

    async deleteGlucose(id: string): Promise<void> {
      await db.glucose.delete(id)
    },

    async getSetting<T>(key: string): Promise<T | undefined> {
      const row = await db.settings.get(key)
      return row?.value as T | undefined
    },

    async setSetting(key: string, value: unknown): Promise<void> {
      await db.settings.put({ key, value })
    },

    /** Removes every record on this device: every table, settings included. */
    async eraseAll(): Promise<void> {
      await db.transaction('rw', db.tables, async () => {
        await Promise.all(db.tables.map((t) => t.clear()))
      })
    },
  }
}

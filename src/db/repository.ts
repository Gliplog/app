import type { DoseRow, MedicationRow, TidebookDb, WeightRow } from './database'
import { nowIso, systemClock, type Clock } from '@/services/time'

export type NewMedication = Omit<MedicationRow, 'id' | 'createdAt' | 'updatedAt'>
export type NewDose = Omit<DoseRow, 'id' | 'createdAt'>
export type NewWeight = Omit<WeightRow, 'id' | 'createdAt'>

/**
 * All reads and writes of user data. Views and stores call this, never Dexie tables directly,
 * so storage rules (ids, timestamps, cascade deletes) live in one place.
 */
export function createRepository(db: TidebookDb, clock: Clock = systemClock) {
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

    async getSetting<T>(key: string): Promise<T | undefined> {
      const row = await db.settings.get(key)
      return row?.value as T | undefined
    },

    async setSetting(key: string, value: unknown): Promise<void> {
      await db.settings.put({ key, value })
    },

    /** Removes every record on this device: medications, doses, weights and settings. */
    async eraseAll(): Promise<void> {
      await db.transaction('rw', [db.medications, db.doses, db.weights, db.settings], async () => {
        await Promise.all([
          db.medications.clear(),
          db.doses.clear(),
          db.weights.clear(),
          db.settings.clear(),
        ])
      })
    },
  }
}

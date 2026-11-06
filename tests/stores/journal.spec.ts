import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { DoseRow, MedicationRow } from '@/db/database'
import { useJournalStore } from '@/stores/journal'

const NOW = Date.UTC(2026, 10, 6)
const iso = (ms: number) => new Date(ms).toISOString()

function medication(id: string, changes: Partial<MedicationRow> = {}): MedicationRow {
  return {
    id,
    productId: 'wegovy',
    name: id,
    status: 'active',
    intervalDays: 7,
    concentrationMgPerMl: null,
    pkOverride: null,
    notes: '',
    ...changes,
  } as MedicationRow
}

const dose = (medicationId: string, daysAgo: number, doseMg: number) =>
  ({
    id: `${medicationId}-${daysAgo}`,
    medicationId,
    takenAt: iso(NOW - daysAgo * 86_400_000),
    doseMg,
  }) as DoseRow

describe('journal projections', () => {
  let journal: ReturnType<typeof useJournalStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    journal = useJournalStore()
  })

  it('carries one medicine across brands, including one still being added', () => {
    journal.medications = [medication('a')]
    journal.doses = [dose('a', 3, 1)]
    expect(journal.historyFor(undefined, 'semaglutide-injection')).toHaveLength(1)
    expect(journal.historyFor(undefined, 'tirzepatide-injection')).toEqual([])
  })

  it('finds nothing for a new medication outside the catalog', () => {
    journal.medications = [medication('a', { productId: null })]
    journal.doses = [dose('a', 3, 1)]
    expect(journal.historyFor(undefined, undefined)).toEqual([])
    expect(journal.historyFor('a', undefined)).toHaveLength(1)
  })

  it('has no projection before a first dose', () => {
    journal.medications = [medication('a')]
    expect(journal.projectionOf(journal.medications[0]!, NOW)).toBeNull()
  })

  it('repeats the last dose on the medication’s own interval', () => {
    journal.medications = [medication('a')]
    journal.doses = [dose('a', 3, 2.4), dose('a', 10, 1.7)]
    const found = journal.projectionOf(journal.medications[0]!, NOW)!
    expect(found.userSupplied).toBe(false)
    const planned = found.projection.allDoses[2]!
    expect(planned.amount).toBe(2.4)
    expect(planned.at).toBe(NOW + 4 * 86_400_000)
  })

  it('marks a curve from the user’s own half-life', () => {
    const pkOverride = { halfLifeHours: 48, tmaxHours: 6 }
    journal.medications = [medication('a', { productId: null, pkOverride })]
    journal.doses = [dose('a', 1, 1)]
    expect(journal.projectionOf(journal.medications[0]!, NOW)!.userSupplied).toBe(true)
  })

  it('has no projection without a half-life', () => {
    journal.medications = [medication('a', { productId: null })]
    journal.doses = [dose('a', 1, 1)]
    expect(journal.projectionOf(journal.medications[0]!, NOW)).toBeNull()
  })
})

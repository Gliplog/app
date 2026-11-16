import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db'
import { useJournalStore } from '@/stores/journal'
import { useScheduledDays } from '@/composables/useScheduledDays'
import { atLocalTime } from '@/services/time'

const NOW = new Date(2026, 10, 16, 12, 0).getTime()

describe('useScheduledDays (Gliplog)', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await Promise.all(db.tables.map((t) => t.clear()))
  })

  it('returns each active medication next due day inside the range and nothing outside it', async () => {
    const journal = useJournalStore()
    await journal.load()

    const wegovy = await journal.addMedication({
      productId: 'wegovy',
      name: 'Wegovy',
      intervalDays: 7,
      concentrationMgPerMl: null,
      pkOverride: null,
      status: 'active',
      notes: '',
    })
    const archived = await journal.addMedication({
      productId: 'saxenda',
      name: 'Saxenda',
      intervalDays: 1,
      concentrationMgPerMl: null,
      pkOverride: null,
      status: 'archived',
      notes: '',
    })
    const overdue = await journal.addMedication({
      productId: 'zepbound',
      name: 'Zepbound',
      intervalDays: 7,
      concentrationMgPerMl: null,
      pkOverride: null,
      status: 'active',
      notes: '',
    })

    // Wegovy last dosed 3 days ago -> next due in 4 days (Nov 20).
    await journal.addDose({
      medicationId: wegovy.id,
      doseMg: 0.25,
      takenAt: new Date(2026, 10, 13, 8, 15).toISOString(),
      site: null,
      notes: '',
    })
    // Archived med dosed yesterday -> ignored.
    await journal.addDose({
      medicationId: archived.id,
      doseMg: 0.6,
      takenAt: new Date(2026, 10, 15, 9, 0).toISOString(),
      site: null,
      notes: '',
    })
    // Overdue med dosed 10 days ago -> next due 3 days ago -> not marked as upcoming.
    await journal.addDose({
      medicationId: overdue.id,
      doseMg: 2.5,
      takenAt: new Date(2026, 10, 6, 8, 0).toISOString(),
      site: null,
      notes: '',
    })

    const { scheduledIn, lastSelectable } = useScheduledDays(ref(NOW))
    const inMonth = scheduledIn(new Date(2026, 10, 1).getTime(), new Date(2026, 11, 1).getTime())
    expect(inMonth).toHaveLength(1)
    expect(inMonth[0]!.at).toBe(new Date(2026, 10, 20, 8, 15).getTime())
    expect(inMonth[0]!.label).toContain('Wegovy at')
    expect(lastSelectable.value).toBe(atLocalTime(new Date(2026, 10, 20, 8, 15).getTime(), 0, 0, 0))

    // Outside the range returns nothing.
    expect(scheduledIn(new Date(2026, 10, 1).getTime(), new Date(2026, 10, 20).getTime())).toEqual(
      [],
    )
  })
})

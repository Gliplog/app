import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { db, repository } from '@/db'
import { useSystemRows } from '@/composables/useSystemRows'
import { useJournalStore } from '@/stores/journal'

const DAY_MS = 86_400_000

describe('useSystemRows', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await Promise.all(db.tables.map((t) => t.clear()))
  })

  it('includes a medicine with a curve and skips one without a curve', async () => {
    const nowMs = new Date(2026, 10, 16, 12, 0).getTime()
    const withCurve = await repository.addMedication({
      productId: 'zepbound',
      name: 'Zepbound',
      intervalDays: 7,
      concentrationMgPerMl: null,
      pkOverride: null,
      status: 'active',
      notes: '',
    })
    const withoutCurve = await repository.addMedication({
      productId: null,
      name: 'Custom med',
      intervalDays: 7,
      concentrationMgPerMl: null,
      pkOverride: null,
      status: 'active',
      notes: '',
    })

    await repository.addDose({
      medicationId: withCurve.id,
      takenAt: new Date(nowMs - DAY_MS).toISOString(),
      doseMg: 5,
      site: null,
      notes: '',
    })
    await repository.addDose({
      medicationId: withoutCurve.id,
      takenAt: new Date(nowMs - DAY_MS).toISOString(),
      doseMg: 1,
      site: null,
      notes: '',
    })

    await useJournalStore().load()
    const { rows } = useSystemRows(ref(nowMs))

    expect(rows.value).toHaveLength(1)
    expect(rows.value[0]!.label).toBe('Tirzepatide injection')
    expect(rows.value[0]!.amountText).toMatch(/mg$/)
    expect(rows.value[0]!.percentOfPeak).toBeGreaterThanOrEqual(0)
    expect(rows.value[0]!.percentOfPeak).toBeLessThanOrEqual(100)
    expect(rows.value[0]!.trace.length).toBeGreaterThan(0)
  })
})

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { db, repository } from '@/db'
import { useDueItems } from '@/composables/useDueItems'
import { useJournalStore } from '@/stores/journal'
import { useLogStore } from '@/stores/log'

const DAY_MS = 86_400_000

describe('useDueItems', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await Promise.all(db.tables.map((t) => t.clear()))
  })

  it('orders dosed medications before undosed ones, skips archived, and starts log on click', async () => {
    const nowMs = new Date(2026, 10, 16, 12, 0).getTime()
    const yesterday = new Date(nowMs - DAY_MS).toISOString()

    const dosed = await repository.addMedication({
      productId: 'zepbound',
      name: 'Zepbound',
      intervalDays: 7,
      concentrationMgPerMl: null,
      pkOverride: null,
      status: 'active',
      notes: '',
    })
    const undosed = await repository.addMedication({
      productId: 'rybelsus',
      name: 'Rybelsus',
      intervalDays: 1,
      concentrationMgPerMl: null,
      pkOverride: null,
      status: 'active',
      notes: '',
    })
    const archived = await repository.addMedication({
      productId: 'wegovy',
      name: 'Wegovy',
      intervalDays: 7,
      concentrationMgPerMl: null,
      pkOverride: null,
      status: 'archived',
      notes: '',
    })

    await repository.addDose({
      medicationId: dosed.id,
      takenAt: yesterday,
      doseMg: 7.5,
      site: null,
      notes: '',
    })
    await repository.addDose({
      medicationId: archived.id,
      takenAt: yesterday,
      doseMg: 0.25,
      site: null,
      notes: '',
    })

    await useJournalStore().load()
    const log = useLogStore()
    const startSpy = vi.spyOn(log, 'start')

    const { items } = useDueItems(ref(nowMs))
    expect(items.value).toHaveLength(2)

    expect(items.value[0]!.id).toBe(dosed.id)
    expect(items.value[0]!.dueAt).toBe(nowMs + 6 * DAY_MS)
    expect(items.value[0]!.detail).toBe('Last: 7.5 mg, yesterday')

    expect(items.value[1]!.id).toBe(undosed.id)
    expect(items.value[1]!.dueAt).toBeNull()
    expect(items.value[1]!.detail).toBe('No doses yet')

    items.value[0]!.log()
    expect(startSpy).toHaveBeenCalledWith('dose', { medicationId: dosed.id })
  })
})

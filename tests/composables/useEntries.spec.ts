import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, repository } from '@/db'
import { useEntries } from '@/composables/useEntries'
import { useJournalStore } from '@/stores/journal'
import { usePhotosStore } from '@/stores/photos'
import { useSettingsStore } from '@/stores/settings'

describe('useEntries', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await Promise.all(db.tables.map((t) => t.clear()))
  })

  it('combines every kind from the stores, newest first, with formatted titles', async () => {
    await repository.setSetting('disclaimerAcceptedAt', '2026-10-01T00:00:00.000Z')
    await repository.setSetting('weightUnit', 'kg')
    await repository.setSetting('glucoseUnit', 'mg/dL')
    await repository.setSetting('a1cUnit', '%')

    const med = await repository.addMedication({
      productId: 'zepbound',
      name: 'Zepbound',
      intervalDays: 7,
      concentrationMgPerMl: null,
      pkOverride: null,
      status: 'active',
      notes: '',
    })
    await repository.addDose({
      medicationId: med.id,
      takenAt: '2026-11-16T08:10:00.000Z',
      doseMg: 7.5,
      site: 'abdomen-left',
      notes: 'before breakfast',
    })
    await repository.addWeight({
      measuredAt: '2026-11-16T07:55:00.000Z',
      kg: 82.4,
      enteredUnit: 'kg',
      notes: '',
    })
    await repository.addSymptoms([
      {
        occurredAt: '2026-11-15T19:30:00.000Z',
        symptom: 'nausea',
        otherText: '',
        severity: 'mild',
        notes: '',
      },
    ])
    await repository.addGlucose({
      kind: 'glucose',
      measuredAt: '2026-11-15T08:00:00.000Z',
      value: 96,
      enteredUnit: 'mg/dL',
      context: 'fasting',
      notes: '',
    })
    await repository.addVital({
      kind: 'bp',
      measuredAt: '2026-11-14T09:00:00.000Z',
      systolic: 124,
      diastolic: 78,
      notes: '',
    })
    await repository.addPhoto(
      {
        takenAt: '2026-11-13T10:00:00.000Z',
        pose: 'front',
        notes: '',
        width: 300,
        height: 400,
      },
      new Uint8Array([1, 2]).buffer,
      new Uint8Array([3, 4]).buffer,
    )

    await Promise.all([
      useSettingsStore().load(),
      useJournalStore().load(),
      usePhotosStore().load(),
    ])
    const { entries } = useEntries()

    expect(entries.value).toHaveLength(6)
    expect(entries.value.map((e) => e.kind)).toEqual([
      'dose',
      'weight',
      'symptom',
      'glucose',
      'vital',
      'photo',
    ])
    expect(entries.value.map((e) => e.title)).toEqual([
      '7.5 mg Zepbound',
      '82.4 kg',
      'Nausea',
      '96 mg/dL',
      '124/78 mmHg',
      'Front photo',
    ])
    expect(entries.value[0]!.detail).toBe('Belly, left')
  })
})

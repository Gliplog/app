import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDatabase, type TidebookDb } from '@/db/database'
import { createRepository, type NewMedication } from '@/db/repository'
import { exportBackup, parseBackup, restoreBackup, BackupFormatError } from '@/db/backup'

const fixedClock = () => new Date('2026-10-25T12:00:00.000Z')

const wegovy: NewMedication = {
  productId: 'wegovy',
  name: 'Wegovy',
  intervalDays: 7,
  concentrationMgPerMl: null,
  pkOverride: null,
  status: 'active',
  notes: '',
}

let db: TidebookDb
let counter = 0

beforeEach(async () => {
  db = createDatabase(`test-${++counter}`)
  await db.open()
})

afterEach(async () => {
  await db.delete()
})

describe('repository', () => {
  it('adds medications with ids and UTC timestamps', async () => {
    const repo = createRepository(db, fixedClock)
    const med = await repo.addMedication(wegovy)
    expect(med.id).toMatch(/[0-9a-f-]{36}/)
    expect(med.createdAt).toBe('2026-10-25T12:00:00.000Z')
    expect(await repo.listMedications()).toHaveLength(1)
  })

  it('lists doses newest first and deletes them with their medication', async () => {
    const repo = createRepository(db, fixedClock)
    const a = await repo.addMedication(wegovy)
    const b = await repo.addMedication({ ...wegovy, productId: 'zepbound', name: 'Zepbound' })
    const base = { doseMg: 0.25, site: null, notes: '' }
    await repo.addDose({ ...base, medicationId: a.id, takenAt: '2026-10-01T08:00:00.000Z' })
    await repo.addDose({ ...base, medicationId: a.id, takenAt: '2026-10-08T08:00:00.000Z' })
    await repo.addDose({ ...base, medicationId: b.id, takenAt: '2026-10-05T08:00:00.000Z' })
    expect((await repo.listDoses()).map((d) => d.takenAt)).toEqual([
      '2026-10-08T08:00:00.000Z',
      '2026-10-05T08:00:00.000Z',
      '2026-10-01T08:00:00.000Z',
    ])
    await repo.deleteMedication(a.id)
    const left = await repo.listDoses()
    expect(left).toHaveLength(1)
    expect(left[0]!.medicationId).toBe(b.id)
  })

  it('keeps weights unrounded and lists them newest first', async () => {
    const repo = createRepository(db, fixedClock)
    await repo.addWeight({
      measuredAt: '2026-10-01T07:00:00.000Z',
      kg: 90.718474,
      enteredUnit: 'lb',
      notes: '',
    })
    await repo.addWeight({
      measuredAt: '2026-10-08T07:00:00.000Z',
      kg: 89.5,
      enteredUnit: 'kg',
      notes: '',
    })
    const weights = await repo.listWeights()
    expect(weights.map((w) => w.kg)).toEqual([89.5, 90.718474])
  })

  it('erases every table', async () => {
    const repo = createRepository(db, fixedClock)
    const med = await repo.addMedication(wegovy)
    await repo.addDose({
      medicationId: med.id,
      takenAt: '2026-10-01T08:00:00.000Z',
      doseMg: 1,
      site: null,
      notes: '',
    })
    await repo.addWeight({
      measuredAt: '2026-10-01T07:00:00.000Z',
      kg: 80,
      enteredUnit: 'kg',
      notes: '',
    })
    await repo.setSetting('theme', 'dark')
    await repo.eraseAll()
    expect(await repo.listMedications()).toEqual([])
    expect(await repo.listDoses()).toEqual([])
    expect(await repo.listWeights()).toEqual([])
    expect(await repo.getSetting('theme')).toBeUndefined()
  })
})

describe('backup', () => {
  async function seed() {
    const repo = createRepository(db, fixedClock)
    const med = await repo.addMedication({
      ...wegovy,
      productId: 'compounded-semaglutide',
      name: 'Compounded semaglutide',
      concentrationMgPerMl: 2.5,
    })
    await repo.addDose({
      medicationId: med.id,
      takenAt: '2026-10-01T08:00:00.000Z',
      doseMg: 0.25,
      site: 'abdomen-left',
      notes: 'first',
    })
    await repo.addWeight({
      measuredAt: '2026-10-01T07:00:00.000Z',
      kg: 95.2,
      enteredUnit: 'kg',
      notes: '',
    })
    await repo.setSetting('profile', {
      heightCm: 170,
      birthMonth: '1985-04',
      gender: 'unspecified',
      genderText: '',
      goalKg: null,
    })
    return repo
  }

  it('round-trips everything through a backup file', async () => {
    await seed()
    const text = JSON.stringify(await exportBackup(db, fixedClock))
    const parsed = parseBackup(text)
    expect(parsed.medications).toHaveLength(1)
    expect(parsed.doses).toHaveLength(1)
    expect(parsed.weights).toHaveLength(1)

    const other = createDatabase(`test-${++counter}`)
    await other.open()
    await restoreBackup(other, parsed)
    const restored = createRepository(other)
    expect((await restored.listDoses())[0]!.site).toBe('abdomen-left')
    expect((await restored.listWeights())[0]!.kg).toBe(95.2)
    expect(await restored.getSetting('profile')).toMatchObject({ heightCm: 170 })
    await other.delete()
  })

  it('rejects files that are not Tidebook backups', () => {
    expect(() => parseBackup('not json')).toThrow(BackupFormatError)
    expect(() => parseBackup(JSON.stringify({ format: 'pepcalc-backup', version: 1 }))).toThrow(
      'This is not a Tidebook backup file.',
    )
    expect(() => parseBackup(JSON.stringify({ format: 'tidebook-backup', version: 99 }))).toThrow(
      /newer version/,
    )
  })

  it('rejects doses for a missing medication and invalid weights', async () => {
    await seed()
    const backup = await exportBackup(db, fixedClock)
    const orphan = { ...backup, doses: [{ ...backup.doses[0]!, medicationId: 'gone' }] }
    expect(() => parseBackup(JSON.stringify(orphan))).toThrow(/missing medication/)
    const negative = { ...backup, weights: [{ ...backup.weights[0]!, kg: -1 }] }
    expect(() => parseBackup(JSON.stringify(negative))).toThrow(/Weight 1/)
    const zeroInterval = {
      ...backup,
      medications: [{ ...backup.medications[0]!, intervalDays: 0 }],
    }
    expect(() => parseBackup(JSON.stringify(zeroInterval))).toThrow(/Medication 1/)
  })
})

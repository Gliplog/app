import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDatabase, type GliplogDb } from '@/db/database'
import { createRepository, type NewMedication } from '@/db/repository'
import { strToU8, zipSync } from 'fflate'
import {
  exportBackup,
  exportBackupArchive,
  parseBackup,
  readBackupFile,
  restoreBackup,
  BackupFormatError,
} from '@/db/backup'

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

let db: GliplogDb
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
    await repo.addSymptoms([
      {
        occurredAt: '2026-10-02T09:00:00.000Z',
        symptom: 'headache',
        otherText: '',
        severity: 'moderate',
        notes: '',
      },
    ])
    await repo.addGlucose({
      kind: 'glucose',
      measuredAt: '2026-10-02T07:00:00.000Z',
      value: 110,
      enteredUnit: 'mg/dL',
      context: 'fasting',
      notes: '',
    })
    await repo.setSetting('theme', 'dark')
    await repo.eraseAll()
    expect(await repo.listMedications()).toEqual([])
    expect(await repo.listDoses()).toEqual([])
    expect(await repo.listWeights()).toEqual([])
    expect(await repo.listSymptoms()).toEqual([])
    expect(await repo.listGlucose()).toEqual([])
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
    await repo.addSymptoms([
      {
        occurredAt: '2026-10-02T09:00:00.000Z',
        symptom: 'nausea',
        otherText: '',
        severity: 'mild',
        notes: '',
      },
    ])
    await repo.addGlucose({
      kind: 'a1c',
      measuredAt: '2026-09-30T09:00:00.000Z',
      value: 7.4,
      enteredUnit: '%',
      context: null,
      notes: '',
    })
    await repo.setSetting('profile', {
      heightCm: 170,
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
    expect(parsed.symptoms).toHaveLength(1)
    expect(parsed.glucose).toHaveLength(1)

    const other = createDatabase(`test-${++counter}`)
    await other.open()
    await restoreBackup(other, parsed)
    const restored = createRepository(other)
    expect((await restored.listDoses())[0]!.site).toBe('abdomen-left')
    expect((await restored.listWeights())[0]!.kg).toBe(95.2)
    expect(await restored.getSetting('profile')).toMatchObject({ heightCm: 170 })
    expect((await restored.listSymptoms())[0]!.symptom).toBe('nausea')
    expect((await restored.listGlucose())[0]!.value).toBe(7.4)
    await other.delete()
  })

  it('restores a version 1 backup, which predates side effects and blood sugar', async () => {
    await seed()
    const current = await exportBackup(db, fixedClock)
    const { symptoms: _symptoms, glucose: _glucose, ...rest } = current
    const v1 = { ...rest, version: 1 }
    const parsed = parseBackup(JSON.stringify(v1))
    expect(parsed.symptoms).toEqual([])
    expect(parsed.glucose).toEqual([])
    await restoreBackup(db, parsed)
    const repo = createRepository(db)
    expect(await repo.listSymptoms()).toEqual([])
    expect(await repo.listWeights()).toHaveLength(1)
  })

  it('rejects invalid side effects and blood sugar readings', async () => {
    await seed()
    const backup = await exportBackup(db, fixedClock)
    const badSymptom = { ...backup, symptoms: [{ ...backup.symptoms[0]!, severity: 'awful' }] }
    expect(() => parseBackup(JSON.stringify(badSymptom))).toThrow(/Side effect 1/)
    const badUnit = { ...backup, glucose: [{ ...backup.glucose[0]!, enteredUnit: 'mg/dL' }] }
    expect(() => parseBackup(JSON.stringify(badUnit))).toThrow(/Blood sugar reading 1/)
  })

  it('rejects files that are not Gliplog backups', () => {
    expect(() => parseBackup('not json')).toThrow(BackupFormatError)
    expect(() => parseBackup(JSON.stringify({ format: 'pepcalc-backup', version: 1 }))).toThrow(
      'This is not a Gliplog backup file.',
    )
    expect(() => parseBackup(JSON.stringify({ format: 'gliplog-backup', version: 99 }))).toThrow(
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

  const bytes = (...values: number[]) => new Uint8Array(values).buffer

  async function seedPhoto() {
    return createRepository(db, fixedClock).addPhoto(
      { takenAt: '2026-10-01T07:05:00.000Z', pose: 'front', notes: '', width: 1200, height: 1600 },
      bytes(1, 2, 3),
      bytes(4, 5),
    )
  }

  it('round-trips photos through a zip backup', async () => {
    await seed()
    const photo = await seedPhoto()
    const { bytes: zip } = await exportBackupArchive(db, fixedClock)
    const { backup, photoFiles } = readBackupFile(zip)
    expect(backup.version).toBe(3)
    expect(backup.photos).toHaveLength(1)
    expect(backup.doses).toHaveLength(1)

    const other = createDatabase(`test-${++counter}`)
    await other.open()
    await restoreBackup(other, backup, photoFiles)
    const restored = createRepository(other)
    expect((await restored.listPhotos())[0]!.pose).toBe('front')
    expect(new Uint8Array((await restored.getPhotoImage(photo.id))!)).toEqual(
      new Uint8Array([1, 2, 3]),
    )
    expect(new Uint8Array((await restored.listPhotoThumbs())[0]!.bytes)).toEqual(
      new Uint8Array([4, 5]),
    )
    await other.delete()
  })

  it('still reads a .json backup, which carries no photos', async () => {
    await seed()
    await seedPhoto()
    const json = JSON.stringify(await exportBackup(db, fixedClock))
    const { backup, photoFiles } = readBackupFile(strToU8(json))
    expect(backup.photos).toEqual([])
    expect(photoFiles).toEqual([])
    await restoreBackup(db, backup)
    expect(await createRepository(db).listPhotos()).toEqual([])
  })

  it('refuses a .json that lists photos, and a zip with missing or unexpected files', async () => {
    await seed()
    const photo = await seedPhoto()
    const withPhotos = JSON.stringify(await exportBackup(db, fixedClock, true))
    expect(() => readBackupFile(strToU8(withPhotos))).toThrow(/Restore the .zip/)

    const data = strToU8(withPhotos)
    const missing = zipSync({ 'gliplog-backup.json': data, [`photos/${photo.id}.jpg`]: bytes1() })
    expect(() => readBackupFile(missing)).toThrow(/Photo 1 is missing/)
    const stray = zipSync({ 'gliplog-backup.json': data, 'notes.txt': strToU8('hi') })
    expect(() => readBackupFile(stray)).toThrow(/not a Gliplog backup/)
    const unlisted = zipSync({
      'gliplog-backup.json': data,
      [`photos/${photo.id}.jpg`]: bytes1(),
      [`thumbs/${photo.id}.jpg`]: bytes1(),
      'photos/other.jpg': bytes1(),
    })
    expect(() => readBackupFile(unlisted)).toThrow(/does not list/)
  })

  it('deletes a photo with its image and thumbnail', async () => {
    const photo = await seedPhoto()
    const repo = createRepository(db)
    await repo.deletePhoto(photo.id)
    expect(await repo.listPhotos()).toEqual([])
    expect(await repo.getPhotoImage(photo.id)).toBeUndefined()
    expect(await repo.listPhotoThumbs()).toEqual([])
  })
})

const bytes1 = () => new Uint8Array([1])

import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import {
  INJECTION_SITES,
  type DoseRow,
  type GlucoseRow,
  type MedicationRow,
  type PhotoBytesRow,
  type PhotoRow,
  type SettingRow,
  type SymptomRow,
  type GliplogDb,
  type WeightRow,
} from './database'
import { A1C_UNITS, GLUCOSE_CONTEXTS, GLUCOSE_UNITS } from '@/domain/glucose'
import { PHOTO_POSES } from '@/domain/photos'
import { SEVERITIES, SYMPTOMS } from '@/domain/symptoms'
import { WEIGHT_UNITS } from '@/domain/units'
import { nowIso, systemClock, type Clock } from '@/services/time'

/**
 * Backups are the only protection against the browser evicting site data (iOS in
 * particular), since nothing is stored off the device. The data is plain JSON so a user can
 * inspect exactly what it contains. With progress photos it goes in a zip beside the JPEGs,
 * which a phone's Files app can open; without them it stays a single .json file.
 */
const BACKUP_FORMAT = 'gliplog-backup'
/*
 * 2 added side effects and blood sugar; 3 added progress photos. An older file restores with
 * the newer tables empty; an app that only knows an older version refuses a newer file rather
 * than dropping what it cannot read.
 */
const BACKUP_VERSION = 3

/** The data's name inside a zip backup; photos sit beside it as `photos/<id>.jpg`. */
const ARCHIVE_DATA = 'gliplog-backup.json'
const imagePath = (id: string) => `photos/${id}.jpg`
const thumbPath = (id: string) => `thumbs/${id}.jpg`
/*
 * Limits on an untrusted zip before anything is decompressed. A stored photo is about 250 KB,
 * so these leave ample room for years of photos while refusing a zip bomb.
 */
const MAX_ENTRY_BYTES = 20 * 1024 * 1024
const MAX_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  medications: MedicationRow[]
  doses: DoseRow[]
  weights: WeightRow[]
  symptoms: SymptomRow[]
  glucose: GlucoseRow[]
  /** Photo details; the JPEGs travel beside them in a zip backup. */
  photos: PhotoRow[]
  settings: SettingRow[]
}

/** A photo's image and thumbnail bytes, as read from a zip backup. */
export interface PhotoFiles {
  id: string
  image: ArrayBuffer
  thumb: ArrayBuffer
}

export class BackupFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupFormatError'
  }
}

/** Everything on this device as a backup, photo details included when `withPhotos`. */
export async function exportBackup(
  db: GliplogDb,
  clock: Clock = systemClock,
  withPhotos = false,
): Promise<BackupFile> {
  const [medications, doses, weights, symptoms, glucose, photos, settings] = await Promise.all([
    db.medications.toArray(),
    db.doses.toArray(),
    db.weights.toArray(),
    db.symptoms.toArray(),
    db.glucose.toArray(),
    withPhotos ? db.photos.toArray() : [],
    db.settings.toArray(),
  ])
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: nowIso(clock),
    medications,
    doses,
    weights,
    symptoms,
    glucose,
    photos,
    settings,
  }
}

/**
 * Everything on this device, photos included, as a zip: the backup JSON and each photo's image
 * and thumbnail. JPEGs are stored, not compressed again, since they would not shrink.
 */
export async function exportBackupArchive(
  db: GliplogDb,
  clock: Clock = systemClock,
): Promise<{ backup: BackupFile; bytes: Uint8Array }> {
  const backup = await exportBackup(db, clock, true)
  const [images, thumbs] = await Promise.all([db.photoImages.toArray(), db.photoThumbs.toArray()])
  const entries: Zippable = { [ARCHIVE_DATA]: strToU8(JSON.stringify(backup, null, 2)) }
  const add = (rows: PhotoBytesRow[], path: (id: string) => string) => {
    for (const row of rows) entries[path(row.id)] = [new Uint8Array(row.bytes), { level: 0 }]
  }
  add(images, imagePath)
  add(thumbs, thumbPath)
  return { backup, bytes: zipSync(entries, { level: 6 }) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIso(value: unknown): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isPositive(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isPkOverride(value: unknown): boolean {
  return (
    value === null ||
    (isRecord(value) && isPositive(value.halfLifeHours) && isPositive(value.tmaxHours))
  )
}

/*
 * Restore must never write rows the app cannot compute with: a zero interval, a negative dose
 * or a non-positive half-life would throw while rendering Today or a chart.
 */
function checkMedication(m: unknown, i: number): asserts m is MedicationRow {
  const ok =
    isRecord(m) &&
    typeof m.id === 'string' &&
    (m.productId === null || typeof m.productId === 'string') &&
    typeof m.name === 'string' &&
    Number.isInteger(m.intervalDays) &&
    isPositive(m.intervalDays) &&
    (m.concentrationMgPerMl === null || isPositive(m.concentrationMgPerMl)) &&
    isPkOverride(m.pkOverride) &&
    (m.status === 'active' || m.status === 'archived') &&
    typeof m.notes === 'string' &&
    isIso(m.createdAt)
  if (!ok)
    throw new BackupFormatError(
      `Medication ${i + 1} is missing required fields or has invalid values.`,
    )
}

function checkDose(d: unknown, i: number, medicationIds: Set<string>): asserts d is DoseRow {
  const ok =
    isRecord(d) &&
    typeof d.id === 'string' &&
    typeof d.medicationId === 'string' &&
    medicationIds.has(d.medicationId) &&
    isIso(d.takenAt) &&
    isPositive(d.doseMg) &&
    (d.site === null || INJECTION_SITES.includes(d.site as never)) &&
    typeof d.notes === 'string'
  if (!ok)
    throw new BackupFormatError(`Dose ${i + 1} is invalid or refers to a missing medication.`)
}

function checkWeight(w: unknown, i: number): asserts w is WeightRow {
  const ok =
    isRecord(w) &&
    typeof w.id === 'string' &&
    isIso(w.measuredAt) &&
    isPositive(w.kg) &&
    WEIGHT_UNITS.includes(w.enteredUnit as never) &&
    typeof w.notes === 'string'
  if (!ok)
    throw new BackupFormatError(`Weight ${i + 1} is missing required fields or has invalid values.`)
}

function checkSymptom(s: unknown, i: number): asserts s is SymptomRow {
  const ok =
    isRecord(s) &&
    typeof s.id === 'string' &&
    isIso(s.occurredAt) &&
    SYMPTOMS.includes(s.symptom as never) &&
    typeof s.otherText === 'string' &&
    SEVERITIES.includes(s.severity as never) &&
    typeof s.notes === 'string'
  if (!ok)
    throw new BackupFormatError(
      `Side effect ${i + 1} is missing required fields or has invalid values.`,
    )
}

function checkGlucose(g: unknown, i: number): asserts g is GlucoseRow {
  const ok =
    isRecord(g) &&
    typeof g.id === 'string' &&
    isIso(g.measuredAt) &&
    isPositive(g.value) &&
    typeof g.notes === 'string' &&
    ((g.kind === 'a1c' && A1C_UNITS.includes(g.enteredUnit as never) && g.context === null) ||
      (g.kind === 'glucose' &&
        GLUCOSE_UNITS.includes(g.enteredUnit as never) &&
        GLUCOSE_CONTEXTS.includes(g.context as never)))
  if (!ok)
    throw new BackupFormatError(
      `Blood sugar reading ${i + 1} is missing required fields or has invalid values.`,
    )
}

function checkPhoto(p: unknown, i: number): asserts p is PhotoRow {
  const ok =
    isRecord(p) &&
    typeof p.id === 'string' &&
    isIso(p.takenAt) &&
    PHOTO_POSES.includes(p.pose as never) &&
    typeof p.notes === 'string' &&
    isPositive(p.width) &&
    isPositive(p.height) &&
    isIso(p.createdAt)
  if (!ok)
    throw new BackupFormatError(`Photo ${i + 1} is missing required fields or has invalid values.`)
}

/** Validate untrusted JSON before anything touches the database. */
export function parseBackup(text: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupFormatError('This file is not valid JSON.')
  }
  if (!isRecord(data) || data.format !== BACKUP_FORMAT) {
    throw new BackupFormatError('This is not a Gliplog backup file.')
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new BackupFormatError(
      'This backup was made by a newer version of Gliplog. Update the app first.',
    )
  }
  const { medications, doses, weights, settings } = data
  // Version 1 files predate these tables.
  const symptoms = data.version < 2 ? [] : data.symptoms
  const glucose = data.version < 2 ? [] : data.glucose
  const photos = data.version < 3 ? [] : data.photos
  if (
    !Array.isArray(medications) ||
    !Array.isArray(doses) ||
    !Array.isArray(weights) ||
    !Array.isArray(symptoms) ||
    !Array.isArray(glucose) ||
    !Array.isArray(photos) ||
    !Array.isArray(settings)
  ) {
    throw new BackupFormatError('The backup is incomplete.')
  }
  medications.forEach(checkMedication)
  const ids = new Set((medications as MedicationRow[]).map((m) => m.id))
  doses.forEach((d, i) => checkDose(d, i, ids))
  weights.forEach(checkWeight)
  symptoms.forEach(checkSymptom)
  glucose.forEach(checkGlucose)
  photos.forEach(checkPhoto)
  const validSettings = settings.filter(
    (s): s is SettingRow => isRecord(s) && typeof s.key === 'string',
  )
  return {
    format: BACKUP_FORMAT,
    version: data.version,
    exportedAt: isIso(data.exportedAt) ? (data.exportedAt as string) : '',
    medications: medications as MedicationRow[],
    doses: doses as DoseRow[],
    weights: weights as WeightRow[],
    symptoms: symptoms as SymptomRow[],
    glucose: glucose as GlucoseRow[],
    photos: photos as PhotoRow[],
    settings: validSettings,
  }
}

const isZip = (bytes: Uint8Array) =>
  bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04

const copyBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

/**
 * Read a backup file, either a .json or a .zip with photos, validating all of it before
 * anything touches the database. A zip may hold only the backup JSON and the image and
 * thumbnail of each photo it lists; anything else, or anything too large, is refused before it
 * is decompressed.
 */
export function readBackupFile(bytes: Uint8Array): {
  backup: BackupFile
  photoFiles: PhotoFiles[]
} {
  if (!isZip(bytes)) {
    const backup = parseBackup(new TextDecoder().decode(bytes))
    if (backup.photos.length)
      throw new BackupFormatError(
        'This backup lists photos that are not in the file. Restore the .zip backup instead.',
      )
    return { backup, photoFiles: [] }
  }
  let entries: Record<string, Uint8Array>
  let total = 0
  try {
    entries = unzipSync(bytes, {
      filter: (file) => {
        const allowed =
          file.name === ARCHIVE_DATA || /^(photos|thumbs)\/[^/]+\.jpg$/.test(file.name)
        if (!allowed) throw new BackupFormatError('This zip is not a Gliplog backup.')
        total += file.originalSize
        if (file.originalSize > MAX_ENTRY_BYTES || total > MAX_ARCHIVE_BYTES)
          throw new BackupFormatError('This backup is too large to restore.')
        return true
      },
    })
  } catch (e) {
    if (e instanceof BackupFormatError) throw e
    throw new BackupFormatError('This zip file is damaged.')
  }
  const data = entries[ARCHIVE_DATA]
  if (!data) throw new BackupFormatError('This zip is not a Gliplog backup.')
  const backup = parseBackup(strFromU8(data))
  const listed = new Set(backup.photos.map((p) => p.id))
  for (const name of Object.keys(entries)) {
    const id = /^(?:photos|thumbs)\/([^/]+)\.jpg$/.exec(name)?.[1]
    if (id !== undefined && !listed.has(id))
      throw new BackupFormatError('This backup holds a photo it does not list.')
  }
  const photoFiles = backup.photos.map((p, i) => {
    const image = entries[imagePath(p.id)]
    const thumb = entries[thumbPath(p.id)]
    if (!image || !thumb) throw new BackupFormatError(`Photo ${i + 1} is missing from the backup.`)
    return { id: p.id, image: copyBuffer(image), thumb: copyBuffer(thumb) }
  })
  return { backup, photoFiles }
}

/**
 * Replace everything on this device with the backup's contents, atomically. Photos come back
 * only from a zip backup (`photoFiles`); restoring a .json leaves none.
 */
export async function restoreBackup(
  db: GliplogDb,
  backup: BackupFile,
  photoFiles: PhotoFiles[] = [],
): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
    await db.medications.bulkAdd(backup.medications)
    await db.doses.bulkAdd(backup.doses)
    await db.weights.bulkAdd(backup.weights)
    await db.symptoms.bulkAdd(backup.symptoms)
    await db.glucose.bulkAdd(backup.glucose)
    await db.photos.bulkAdd(backup.photos)
    await db.photoImages.bulkAdd(photoFiles.map((f) => ({ id: f.id, bytes: f.image })))
    await db.photoThumbs.bulkAdd(photoFiles.map((f) => ({ id: f.id, bytes: f.thumb })))
    await db.settings.bulkPut(backup.settings)
  })
}

export function backupFileName(exportedAt: string, archive = false): string {
  return `gliplog-backup-${exportedAt.slice(0, 10)}.${archive ? 'zip' : 'json'}`
}

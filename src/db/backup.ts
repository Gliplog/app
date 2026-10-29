import {
  INJECTION_SITES,
  type DoseRow,
  type MedicationRow,
  type SettingRow,
  type TidebookDb,
  type WeightRow,
} from './database'
import { WEIGHT_UNITS } from '@/domain/units'
import { nowIso, systemClock, type Clock } from '@/services/time'

/**
 * Backups are the only protection against the browser evicting site data (iOS in
 * particular), since nothing is stored off the device. The file is plain JSON so a user can
 * inspect exactly what it contains.
 */
const BACKUP_FORMAT = 'tidebook-backup'
const BACKUP_VERSION = 1

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  medications: MedicationRow[]
  doses: DoseRow[]
  weights: WeightRow[]
  settings: SettingRow[]
}

export class BackupFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupFormatError'
  }
}

export async function exportBackup(
  db: TidebookDb,
  clock: Clock = systemClock,
): Promise<BackupFile> {
  const [medications, doses, weights, settings] = await Promise.all([
    db.medications.toArray(),
    db.doses.toArray(),
    db.weights.toArray(),
    db.settings.toArray(),
  ])
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: nowIso(clock),
    medications,
    doses,
    weights,
    settings,
  }
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

/** Validate untrusted JSON before anything touches the database. */
export function parseBackup(text: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupFormatError('This file is not valid JSON.')
  }
  if (!isRecord(data) || data.format !== BACKUP_FORMAT) {
    throw new BackupFormatError('This is not a Tidebook backup file.')
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new BackupFormatError(
      'This backup was made by a newer version of Tidebook. Update the app first.',
    )
  }
  const { medications, doses, weights, settings } = data
  if (
    !Array.isArray(medications) ||
    !Array.isArray(doses) ||
    !Array.isArray(weights) ||
    !Array.isArray(settings)
  ) {
    throw new BackupFormatError('The backup is incomplete.')
  }
  medications.forEach(checkMedication)
  const ids = new Set((medications as MedicationRow[]).map((m) => m.id))
  doses.forEach((d, i) => checkDose(d, i, ids))
  weights.forEach(checkWeight)
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
    settings: validSettings,
  }
}

/** Replace everything on this device with the backup's contents, atomically. */
export async function restoreBackup(db: TidebookDb, backup: BackupFile): Promise<void> {
  await db.transaction('rw', [db.medications, db.doses, db.weights, db.settings], async () => {
    await Promise.all([
      db.medications.clear(),
      db.doses.clear(),
      db.weights.clear(),
      db.settings.clear(),
    ])
    await db.medications.bulkAdd(backup.medications)
    await db.doses.bulkAdd(backup.doses)
    await db.weights.bulkAdd(backup.weights)
    await db.settings.bulkPut(backup.settings)
  })
}

export function backupFileName(exportedAt: string): string {
  return `tidebook-backup-${exportedAt.slice(0, 10)}.json`
}

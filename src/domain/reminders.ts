/**
 * Dose reminders: when to remind, from the user's own schedule (last dose plus interval) and
 * the time of day they chose. Like `schedule.ts`, this restates the user's schedule; it never
 * suggests a dose. Local wall-clock times come from an injected function, so this module stays
 * free of the clock and the time zone.
 */

/** One medication's reminder choices. */
export interface MedicationReminder {
  enabled: boolean
  /** Local time of day, 0 to 23 and 0 to 59. */
  hour: number
  minute: number
  /** Also remind the day before a dose that is due less often than daily. */
  dayBefore: boolean
}

export interface ReminderSettings {
  /** Show the medication's name on the lock screen; off so a glance reveals nothing. */
  showNames: boolean
  medications: Record<string, MedicationReminder>
}

export const DEFAULT_REMINDER: MedicationReminder = {
  enabled: false,
  hour: 9,
  minute: 0,
  dayBefore: false,
}

const isInt = (v: unknown, min: number, max: number): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max

/** Stored or restored reminder settings are untrusted input; keep only valid entries. */
export function sanitizeReminderSettings(value: unknown): ReminderSettings {
  if (typeof value !== 'object' || value === null) return { showNames: false, medications: {} }
  const v = value as Record<string, unknown>
  const medications: Record<string, MedicationReminder> = {}
  if (typeof v.medications === 'object' && v.medications !== null) {
    for (const [id, raw] of Object.entries(v.medications as Record<string, unknown>)) {
      if (typeof raw !== 'object' || raw === null) continue
      const r = raw as Record<string, unknown>
      if (!isInt(r.hour, 0, 23) || !isInt(r.minute, 0, 59)) continue
      medications[id] = {
        enabled: r.enabled === true,
        hour: r.hour,
        minute: r.minute,
        dayBefore: r.dayBefore === true,
      }
    }
  }
  return { showNames: v.showNames === true, medications }
}

/** "09:05" for an <input type="time">. */
export function toTimeValue(r: Pick<MedicationReminder, 'hour' | 'minute'>): string {
  return `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}`
}

/** Parses an <input type="time"> value; null when it is empty or malformed. */
export function fromTimeValue(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})/.exec(value)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  return isInt(hour, 0, 23) && isInt(minute, 0, 59) ? { hour, minute } : null
}

export type ReminderKind = 'day-before' | 'due' | 'late'

export interface PlannedReminder {
  medicationId: string
  kind: ReminderKind
  /** Epoch ms. */
  at: number
}

/** Epoch ms of a local wall-clock time `dayOffset` days after the day of `epochMs`. */
export type AtLocalTime = (
  epochMs: number,
  dayOffset: number,
  hour: number,
  minute: number,
) => number

/**
 * Daily medicines get the next week of reminders, so they keep coming if the app is not
 * opened; every launch and every logged dose plans again.
 */
const DAILY_AHEAD = 7
const DAY_MS = 86_400_000

/**
 * The reminders still to come for one medication, soonest first. A weekly (or longer)
 * medicine is reminded on the day it falls due, optionally the day before, and once more the
 * next day if no dose has been logged. Nothing is planned before the first dose, because there
 * is no schedule to restate yet.
 */
export function planReminders(input: {
  medicationId: string
  dueAt: number | null
  intervalDays: number
  reminder: MedicationReminder
  now: number
  atLocalTime: AtLocalTime
}): PlannedReminder[] {
  const { medicationId, dueAt, intervalDays, reminder, now, atLocalTime } = input
  if (!reminder.enabled || dueAt === null || !(intervalDays > 0)) return []
  const at = (offset: number) => atLocalTime(dueAt, offset, reminder.hour, reminder.minute)
  if (intervalDays === 1) {
    // From today if the last logged dose is days old, so reminders do not stop after a week.
    const start = Math.max(0, Math.floor((now - dueAt) / DAY_MS))
    return Array.from({ length: DAILY_AHEAD + 1 }, (_, k) => ({
      medicationId,
      kind: 'due' as const,
      at: at(start + k),
    }))
      .filter((r) => r.at > now)
      .slice(0, DAILY_AHEAD)
  }
  const planned: PlannedReminder[] = [
    ...(reminder.dayBefore ? [{ medicationId, kind: 'day-before' as const, at: at(-1) }] : []),
    { medicationId, kind: 'due', at: at(0) },
    { medicationId, kind: 'late', at: at(1) },
  ]
  return planned.filter((r) => r.at > now)
}

/**
 * Notification wording. Generic unless the user opted in to names, because a notification can
 * show on a locked screen. Neutral about a late dose: it was due, nothing more.
 */
export function reminderText(
  kind: ReminderKind,
  name: string | null,
): { title: string; body: string } {
  const dose = name ? `Your ${name} dose` : 'Your dose'
  switch (kind) {
    case 'day-before':
      return { title: 'Dose due tomorrow', body: `${dose} is due tomorrow.` }
    case 'due':
      return { title: 'Dose due today', body: `${dose} is due today. Tap to log it.` }
    case 'late':
      return {
        title: 'Dose was due yesterday',
        body: `${dose} was due yesterday. Tap to log it when you take it.`,
      }
  }
}

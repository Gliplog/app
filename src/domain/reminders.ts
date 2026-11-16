/**
 * Dose reminders: when to remind on a list of due days at the user's chosen time of day, plus
 * notification wording and settings sanitisation. It restates the user's schedule; it never
 * suggests a dose. Local wall-clock times come from an injected function, so this module stays
 * free of the clock and the time zone.
 */

import type { TimeOfDay } from './timeOfDay'

export { fromTimeValue, toTimeValue } from './timeOfDay'

/** One medication's reminder choices. */
export interface MedicationReminder extends TimeOfDay {
  enabled: boolean
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

export type ReminderKind = 'day-before' | 'due' | 'late'

/**
 * The local days a dose falls due, as epoch ms anywhere inside each day, soonest first. The
 * planner places reminders on these days; it does not know how the schedule produced them.
 */
export type DueDays = readonly number[]

export interface ReminderRule {
  enabled: boolean
  hour: number
  minute: number
  /** Also remind the day before. Ignored for a repeating schedule. */
  dayBefore: boolean
}

export interface PlannedReminder {
  /** What the reminder is for: a medication's id in Gliplog, a protocol's in PepCalc. */
  subjectId: string
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
 * Repeating schedules get the next week of reminders, so they keep coming if the app is not
 * opened; every launch and every logged dose plans again.
 */
export const REPEATING_AHEAD = 7

/**
 * The reminders still to come for one subject, soonest first. On each due day: a reminder at
 * the rule's time. For a schedule that is not repeating, also the day before when asked, and
 * once more the day after in case the dose was not logged. A repeating schedule is reminded on
 * its days only, at most `REPEATING_AHEAD` of them, because the next day's reminder already
 * follows.
 */
export function planReminders(input: {
  subjectId: string
  days: DueDays
  repeating: boolean
  rule: ReminderRule
  now: number
  atLocalTime: AtLocalTime
}): PlannedReminder[] {
  const { subjectId, days, repeating, rule, now, atLocalTime } = input
  if (!rule.enabled || !days.length) return []
  const at = (day: number, offset = 0) => atLocalTime(day, offset, rule.hour, rule.minute)
  if (repeating) {
    return days
      .map((day) => ({ subjectId, kind: 'due' as const, at: at(day) }))
      .filter((r) => r.at > now)
      .slice(0, REPEATING_AHEAD)
  }
  const planned: PlannedReminder[] = days.flatMap((day) => [
    ...(rule.dayBefore ? [{ subjectId, kind: 'day-before' as const, at: at(day, -1) }] : []),
    { subjectId, kind: 'due' as const, at: at(day) },
    { subjectId, kind: 'late' as const, at: at(day, 1) },
  ])
  return planned.filter((r) => r.at > now).sort((a, b) => a.at - b.at)
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

/**
 * A first reminder time from when the user last took a dose, to the nearest quarter hour:
 * someone who doses at 20:10 is reminded at 20:15, not at a default 9:00.
 */
export function suggestReminderTime(
  hour: number,
  minute: number,
): { hour: number; minute: number } {
  const total = Math.min(Math.round((hour * 60 + minute) / 15) * 15, 23 * 60 + 45)
  return { hour: Math.floor(total / 60), minute: total % 60 }
}

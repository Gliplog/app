import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REMINDER,
  fromTimeValue,
  planReminders,
  reminderText,
  sanitizeReminderSettings,
  toTimeValue,
  type AtLocalTime,
} from '@/domain/reminders'

const H = 3_600_000
const DAY = 24 * H

// A UTC "local" day keeps the arithmetic obvious; the real one lives in services/time.ts.
const utcAt: AtLocalTime = (ms, offset, hour, minute) =>
  Math.floor(ms / DAY) * DAY + offset * DAY + hour * H + minute * 60_000

const on = { ...DEFAULT_REMINDER, enabled: true }

describe('planReminders', () => {
  it('plans nothing when off or before the first dose', () => {
    const base = { medicationId: 'm', intervalDays: 7, now: 0, atLocalTime: utcAt }
    expect(planReminders({ ...base, dueAt: 7 * DAY, reminder: DEFAULT_REMINDER })).toEqual([])
    expect(planReminders({ ...base, dueAt: null, reminder: on })).toEqual([])
  })

  it('reminds a weekly dose on its day, the day before if asked, and the day after', () => {
    const plan = planReminders({
      medicationId: 'm',
      dueAt: 7 * DAY + 20 * H,
      intervalDays: 7,
      reminder: { ...on, dayBefore: true },
      now: 0,
      atLocalTime: utcAt,
    })
    expect(plan).toEqual([
      { medicationId: 'm', kind: 'day-before', at: 6 * DAY + 9 * H },
      { medicationId: 'm', kind: 'due', at: 7 * DAY + 9 * H },
      { medicationId: 'm', kind: 'late', at: 8 * DAY + 9 * H },
    ])
  })

  it('drops reminders already past', () => {
    const plan = planReminders({
      medicationId: 'm',
      dueAt: 7 * DAY,
      intervalDays: 7,
      reminder: on,
      now: 7 * DAY + 12 * H,
      atLocalTime: utcAt,
    })
    expect(plan.map((r) => r.kind)).toEqual(['late'])
  })

  it('plans a week ahead for a daily medicine', () => {
    const plan = planReminders({
      medicationId: 'm',
      dueAt: DAY + 8 * H,
      intervalDays: 1,
      reminder: { ...on, hour: 21, dayBefore: true },
      now: 0,
      atLocalTime: utcAt,
    })
    expect(plan).toHaveLength(7)
    expect(plan.every((r) => r.kind === 'due')).toBe(true)
    expect(plan[0]!.at).toBe(DAY + 21 * H)
    expect(plan[6]!.at).toBe(7 * DAY + 21 * H)
  })

  it('keeps reminding a daily medicine from today when doses have not been logged', () => {
    const plan = planReminders({
      medicationId: 'm',
      dueAt: DAY,
      intervalDays: 1,
      reminder: on,
      now: 10 * DAY + 12 * H,
      atLocalTime: utcAt,
    })
    expect(plan).toHaveLength(7)
    expect(plan[0]!.at).toBe(11 * DAY + 9 * H)
  })
})

describe('reminder settings', () => {
  it('keeps valid entries and drops the rest', () => {
    expect(
      sanitizeReminderSettings({
        showNames: true,
        medications: {
          a: { enabled: true, hour: 8, minute: 30, dayBefore: true },
          b: { enabled: true, hour: 25, minute: 0 },
          c: 'nope',
        },
      }),
    ).toEqual({
      showNames: true,
      medications: { a: { enabled: true, hour: 8, minute: 30, dayBefore: true } },
    })
    expect(sanitizeReminderSettings(null)).toEqual({ showNames: false, medications: {} })
  })

  it('round-trips time input values', () => {
    expect(toTimeValue({ hour: 9, minute: 5 })).toBe('09:05')
    expect(fromTimeValue('21:45')).toEqual({ hour: 21, minute: 45 })
    expect(fromTimeValue('')).toBeNull()
  })
})

describe('reminderText', () => {
  it('names the medication only when asked', () => {
    expect(reminderText('due', null).body).toBe('Your dose is due today. Tap to log it.')
    expect(reminderText('day-before', 'Wegovy').body).toBe('Your Wegovy dose is due tomorrow.')
  })
})

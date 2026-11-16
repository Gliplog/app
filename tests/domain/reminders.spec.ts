import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REMINDER,
  planReminders,
  REPEATING_AHEAD,
  reminderText,
  sanitizeReminderSettings,
  suggestReminderTime,
  type AtLocalTime,
} from '@/domain/reminders'

const H = 3_600_000
const DAY = 24 * H

// A UTC "local" day keeps the arithmetic obvious; the real one lives in services/time.ts.
const utcAt: AtLocalTime = (ms, offset, hour, minute) =>
  Math.floor(ms / DAY) * DAY + offset * DAY + hour * H + minute * 60_000

const on = { ...DEFAULT_REMINDER, enabled: true }

describe('planReminders', () => {
  it('plans nothing when off or given no days', () => {
    const base = { subjectId: 'm', repeating: false, now: 0, atLocalTime: utcAt }
    expect(planReminders({ ...base, days: [7 * DAY], rule: DEFAULT_REMINDER })).toEqual([])
    expect(planReminders({ ...base, days: [], rule: on })).toEqual([])
  })

  it('reminds a non-repeating dose on its day, the day before if asked, and the day after', () => {
    const plan = planReminders({
      subjectId: 'm',
      days: [7 * DAY + 20 * H],
      repeating: false,
      rule: { ...on, dayBefore: true },
      now: 0,
      atLocalTime: utcAt,
    })
    expect(plan).toEqual([
      { subjectId: 'm', kind: 'day-before', at: 6 * DAY + 9 * H },
      { subjectId: 'm', kind: 'due', at: 7 * DAY + 9 * H },
      { subjectId: 'm', kind: 'late', at: 8 * DAY + 9 * H },
    ])
  })

  it('drops reminders already past', () => {
    const plan = planReminders({
      subjectId: 'm',
      days: [7 * DAY],
      repeating: false,
      rule: on,
      now: 7 * DAY + 12 * H,
      atLocalTime: utcAt,
    })
    expect(plan.map((r) => r.kind)).toEqual(['late'])
  })

  it('plans a week ahead for a repeating schedule', () => {
    const days = Array.from({ length: 8 }, (_, k) => (1 + k) * DAY + 8 * H)
    const plan = planReminders({
      subjectId: 'm',
      days,
      repeating: true,
      rule: { ...on, hour: 21, dayBefore: true },
      now: 0,
      atLocalTime: utcAt,
    })
    expect(plan).toHaveLength(7)
    expect(plan.every((r) => r.kind === 'due')).toBe(true)
    expect(plan[0]!.at).toBe(DAY + 21 * H)
    expect(plan[6]!.at).toBe(7 * DAY + 21 * H)
  })

  it('drops past days on a repeating schedule and still plans a week ahead', () => {
    const days = Array.from({ length: 8 }, (_, k) => (10 + k) * DAY)
    const plan = planReminders({
      subjectId: 'm',
      days,
      repeating: true,
      rule: on,
      now: 10 * DAY + 12 * H,
      atLocalTime: utcAt,
    })
    expect(plan).toHaveLength(7)
    expect(plan[0]!.at).toBe(11 * DAY + 9 * H)
  })

  it('plans reminders for multiple non-repeating days, soonest first', () => {
    const plan = planReminders({
      subjectId: 'm',
      days: [7 * DAY, 8 * DAY],
      repeating: false,
      rule: { ...on, dayBefore: true },
      now: 0,
      atLocalTime: utcAt,
    })
    expect(plan).toEqual([
      { subjectId: 'm', kind: 'day-before', at: 6 * DAY + 9 * H },
      { subjectId: 'm', kind: 'due', at: 7 * DAY + 9 * H },
      { subjectId: 'm', kind: 'day-before', at: 7 * DAY + 9 * H },
      { subjectId: 'm', kind: 'late', at: 8 * DAY + 9 * H },
      { subjectId: 'm', kind: 'due', at: 8 * DAY + 9 * H },
      { subjectId: 'm', kind: 'late', at: 9 * DAY + 9 * H },
    ])
  })

  it('caps repeating schedules at REPEATING_AHEAD reminders even when 30 days are given', () => {
    const days = Array.from({ length: 30 }, (_, k) => (1 + k) * DAY)
    const plan = planReminders({
      subjectId: 'm',
      days,
      repeating: true,
      rule: on,
      now: 0,
      atLocalTime: utcAt,
    })
    expect(plan).toHaveLength(REPEATING_AHEAD)
  })

  it('plans nothing when the rule is off, regardless of days or repeating', () => {
    const days = [7 * DAY, 14 * DAY]
    expect(
      planReminders({
        subjectId: 'm',
        days,
        repeating: false,
        rule: DEFAULT_REMINDER,
        now: 0,
        atLocalTime: utcAt,
      }),
    ).toEqual([])
    expect(
      planReminders({
        subjectId: 'm',
        days,
        repeating: true,
        rule: { ...DEFAULT_REMINDER, dayBefore: true },
        now: 0,
        atLocalTime: utcAt,
      }),
    ).toEqual([])
  })

  it('ignores dayBefore on a repeating schedule', () => {
    const plan = planReminders({
      subjectId: 'm',
      days: [7 * DAY],
      repeating: true,
      rule: { ...on, dayBefore: true },
      now: 0,
      atLocalTime: utcAt,
    })
    expect(plan).toEqual([{ subjectId: 'm', kind: 'due', at: 7 * DAY + 9 * H }])
  })
})

describe('reminder settings', () => {
  it('keeps valid entries and drops the rest', () => {
    expect(
      sanitizeReminderSettings({
        showNames: true,
        subjects: {
          a: { enabled: true, hour: 8, minute: 30, dayBefore: true },
          b: { enabled: true, hour: 25, minute: 0 },
          c: 'nope',
        },
      }),
    ).toEqual({
      showNames: true,
      subjects: { a: { enabled: true, hour: 8, minute: 30, dayBefore: true } },
    })
    expect(sanitizeReminderSettings(null)).toEqual({ showNames: false, subjects: {} })
  })

  it('falls back to legacy medications key when subjects is absent', () => {
    expect(
      sanitizeReminderSettings({
        showNames: true,
        medications: {
          a: { enabled: true, hour: 9, minute: 15, dayBefore: false },
        },
      }),
    ).toEqual({
      showNames: true,
      subjects: { a: { enabled: true, hour: 9, minute: 15, dayBefore: false } },
    })
  })
})

describe('reminderText', () => {
  it('names the medication only when asked', () => {
    expect(reminderText('due', null).body).toBe('Your dose is due today. Tap to log it.')
    expect(reminderText('day-before', 'Wegovy').body).toBe('Your Wegovy dose is due tomorrow.')
  })
})

describe('suggestReminderTime', () => {
  it('rounds the last dose time to the nearest quarter hour', () => {
    expect(suggestReminderTime(20, 10)).toEqual({ hour: 20, minute: 15 })
    expect(suggestReminderTime(8, 53)).toEqual({ hour: 9, minute: 0 })
    expect(suggestReminderTime(23, 58)).toEqual({ hour: 23, minute: 45 })
  })
})

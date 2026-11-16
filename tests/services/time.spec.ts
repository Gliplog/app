import { describe, expect, it, vi } from 'vitest'
import {
  atLocalTime,
  calendarFirstDayOfWeek,
  dateOfDay,
  dayOfDate,
  dayOfIsoDate,
  daysBetween,
  firstDayOfWeek,
  formatDate,
  formatDay,
  formatHours,
  formatMonth,
  formatTime,
  fromLocalInputValue,
  monthStartOf,
  monthYearOf,
  nowIso,
  toLocalInputValue,
} from '@/services/time'

describe('time', () => {
  it('formats PK durations at a readable scale', () => {
    expect(formatHours(0.183)).toBe('11 min')
    expect(formatHours(24)).toBe('24 h')
    expect(formatHours(168)).toBe('7 days')
  })

  it('reads the injected clock as UTC ISO', () => {
    expect(nowIso(() => new Date('2026-10-25T12:00:00Z'))).toBe('2026-10-25T12:00:00.000Z')
  })

  it('round-trips datetime-local values', () => {
    const iso = '2026-10-25T12:34:00.000Z'
    expect(fromLocalInputValue(toLocalInputValue(iso))).toBe(iso)
  })

  it('counts whole days', () => {
    expect(daysBetween('2026-10-20T12:00:00Z', new Date('2026-10-25T11:00:00Z'))).toBe(4)
  })
})

describe('atLocalTime', () => {
  it('lands on a local wall-clock time a whole number of days later', () => {
    const start = new Date(2026, 9, 20, 21, 30).getTime()
    const at = new Date(atLocalTime(start, 2, 9, 5))
    expect([at.getFullYear(), at.getMonth(), at.getDate(), at.getHours(), at.getMinutes()]).toEqual(
      [2026, 9, 22, 9, 5],
    )
  })
})

describe('formatDay and formatTime', () => {
  it('labels today, yesterday and earlier local days', () => {
    const now = new Date(2026, 10, 16, 14, 0).getTime()
    expect(formatDay(new Date(2026, 10, 16, 8, 10).getTime(), now)).toBe('Today')
    expect(formatDay(new Date(2026, 10, 15, 23, 50).getTime(), now)).toBe('Yesterday')
    const older = new Date(2026, 10, 10, 9, 0).getTime()
    expect(formatDay(older, now)).toBe(formatDate(atLocalTime(older, 0, 0, 0)))
  })

  it('formats a local time of day', () => {
    const text = formatTime(new Date(2026, 10, 16, 8, 5).getTime())
    expect(text).toMatch(/8:05/)
  })
})

describe('calendar time helpers', () => {
  it('round-trips local day between epoch ms, Date, and ISO date', () => {
    const midDay = new Date(2026, 10, 16, 15, 42).getTime()
    const expectedStart = new Date(2026, 10, 16, 0, 0, 0, 0).getTime()
    expect(dayOfDate(dateOfDay(midDay))).toBe(expectedStart)
    expect(dayOfIsoDate('2026-11-16')).toBe(expectedStart)
    expect(dayOfIsoDate('bad')).toBeNaN()
  })

  it('extracts and builds 0-indexed month and year and formats month title', () => {
    const d = new Date(2026, 10, 16, 9, 0).getTime()
    expect(monthYearOf(d)).toEqual({ month: 10, year: 2026 })
    expect(monthStartOf(2026, 10)).toBe(new Date(2026, 10, 1).getTime())
    const label = formatMonth(d)
    expect(label).toContain('2026')
    expect(label.length).toBeGreaterThan(5)
  })

  it('maps Sunday to 0 in calendarFirstDayOfWeek and defaults to Monday when unavailable', () => {
    expect(firstDayOfWeek('en-US')).toBe(7)
    expect(calendarFirstDayOfWeek('en-US')).toBe(0)
    expect(calendarFirstDayOfWeek('de-DE')).toBe(1)

    const OriginalLocale = Intl.Locale
    vi.stubGlobal(
      'Intl',
      Object.assign({}, Intl, {
        Locale: function MockLocale() {
          return {}
        },
      }),
    )
    try {
      expect(calendarFirstDayOfWeek('en-US')).toBe(1)
    } finally {
      vi.stubGlobal('Intl', Object.assign({}, Intl, { Locale: OriginalLocale }))
    }
  })
})

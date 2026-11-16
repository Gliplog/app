import { describe, expect, it } from 'vitest'
import { dueDaysFor } from '@/domain/reminderDays'

const H = 3_600_000
const DAY = 24 * H

describe('dueDaysFor', () => {
  it('returns no days when there is no due time', () => {
    expect(dueDaysFor({ dueAt: null, intervalDays: 7, now: 0 })).toEqual({
      days: [],
      repeating: false,
    })
  })

  it('returns no days when the interval is zero or negative', () => {
    expect(dueDaysFor({ dueAt: 5 * DAY, intervalDays: 0, now: 0 })).toEqual({
      days: [],
      repeating: false,
    })
    expect(dueDaysFor({ dueAt: 5 * DAY, intervalDays: -3, now: 0 })).toEqual({
      days: [],
      repeating: false,
    })
  })

  it('returns one non-repeating day for a weekly medicine', () => {
    expect(dueDaysFor({ dueAt: 3 * DAY, intervalDays: 7, now: 0 })).toEqual({
      days: [3 * DAY],
      repeating: false,
    })
  })

  it('returns eight repeating days from tomorrow for a daily medicine due tomorrow', () => {
    const result = dueDaysFor({ dueAt: DAY + 8 * H, intervalDays: 1, now: 0 })
    expect(result.repeating).toBe(true)
    expect(result.days).toHaveLength(8)
    expect(result.days[0]).toBe(DAY + 8 * H)
    expect(result.days[7]).toBe(8 * DAY + 8 * H)
  })

  it('starts from today when a daily medicine was last due 5 days ago', () => {
    const result = dueDaysFor({ dueAt: 5 * DAY, intervalDays: 1, now: 10 * DAY })
    expect(result.repeating).toBe(true)
    expect(result.days).toHaveLength(8)
    expect(result.days[0]).toBe(10 * DAY)
    expect(result.days[7]).toBe(17 * DAY)
  })

  it('starts at offset 0 when a daily medicine is due exactly now', () => {
    const result = dueDaysFor({ dueAt: 5 * DAY, intervalDays: 1, now: 5 * DAY })
    expect(result.repeating).toBe(true)
    expect(result.days).toHaveLength(8)
    expect(result.days[0]).toBe(5 * DAY)
  })
})

import { describe, expect, it } from 'vitest'
import { dueState, nextDueAt, remainingFraction, syringeReading } from '@/domain/schedule'

const MIN = 60_000
const H = 60 * MIN
const DAY = 24 * H

describe('next dose', () => {
  it('adds the interval to the last dose', () => {
    expect(nextDueAt(0, 7)).toBe(7 * DAY)
    expect(nextDueAt(null, 7)).toBeNull()
  })

  it('reads days ahead, hours when close, due within a day either side, then late', () => {
    expect(dueState(3 * DAY, 0)).toEqual({ kind: 'later', days: 3 })
    expect(dueState(5 * H, 0)).toEqual({ kind: 'soon', hours: 5 })
    expect(dueState(0, 10 * H)).toEqual({ kind: 'due' })
    expect(dueState(0, 2.5 * DAY)).toEqual({ kind: 'late', days: 2 })
  })

  it('switches from days to hours at 24 hours, never showing 24 hours', () => {
    expect(dueState(DAY, 0)).toEqual({ kind: 'later', days: 1 })
    expect(dueState(DAY - 1, 0)).toEqual({ kind: 'soon', hours: 23 })
    expect(dueState(23.4 * H, 0)).toEqual({ kind: 'soon', hours: 23 })
  })

  it('reads about an hour from 46 to 89 minutes', () => {
    expect(dueState(89 * MIN, 0)).toEqual({ kind: 'soon', hours: 1 })
    expect(dueState(46 * MIN, 0)).toEqual({ kind: 'soon', hours: 1 })
  })

  it('counts the last 45 minutes in quarter hours, rounding up, then now', () => {
    expect(dueState(45 * MIN, 0)).toEqual({ kind: 'minutes', minutes: 45 })
    expect(dueState(31 * MIN, 0)).toEqual({ kind: 'minutes', minutes: 45 })
    expect(dueState(30 * MIN, 0)).toEqual({ kind: 'minutes', minutes: 30 })
    expect(dueState(16 * MIN, 0)).toEqual({ kind: 'minutes', minutes: 30 })
    expect(dueState(15 * MIN, 0)).toEqual({ kind: 'minutes', minutes: 15 })
    expect(dueState(1, 0)).toEqual({ kind: 'minutes', minutes: 15 })
    expect(dueState(0, 0)).toEqual({ kind: 'due' })
  })
})

describe('remainingFraction', () => {
  it('runs from 1 after a dose to 0 when due, and stays at 0 once late', () => {
    expect(remainingFraction(7 * DAY, 7, 0)).toBe(1)
    expect(remainingFraction(7 * DAY, 7, 3.5 * DAY)).toBeCloseTo(0.5, 12)
    expect(remainingFraction(7 * DAY, 7, 7 * DAY)).toBe(0)
    expect(remainingFraction(7 * DAY, 7, 9 * DAY)).toBe(0)
    expect(remainingFraction(7 * DAY, 0, 0)).toBe(0)
  })

  it('zooms to the last day once hours remain, and to the last hour once minutes remain', () => {
    expect(remainingFraction(7 * DAY, 7, 6 * DAY)).toBeCloseTo(1 / 7, 12)
    expect(remainingFraction(7 * DAY, 7, 6 * DAY + 1)).toBeCloseTo(1, 6)
    expect(remainingFraction(7 * DAY, 7, 7 * DAY - 12 * H)).toBeCloseTo(0.5, 12)
    expect(remainingFraction(7 * DAY, 7, 7 * DAY - 30 * MIN)).toBeCloseTo(0.5, 12)
    expect(remainingFraction(DAY, 1, 12 * H)).toBeCloseTo(0.5, 12)
  })
})

describe('syringeReading', () => {
  it('turns a dose into mL and U-100 units', () => {
    const r = syringeReading(0.25, 2.5)
    expect(r.ml).toBeCloseTo(0.1, 12)
    expect(r.units).toBeCloseTo(10, 12)
    expect(() => syringeReading(0, 2.5)).toThrow(RangeError)
  })
})

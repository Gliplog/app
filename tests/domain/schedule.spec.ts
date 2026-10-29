import { describe, expect, it } from 'vitest'
import { dueState, nextDueAt, syringeReading } from '@/domain/schedule'

const H = 3_600_000
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
})

describe('syringeReading', () => {
  it('turns a dose into mL and U-100 units', () => {
    const r = syringeReading(0.25, 2.5)
    expect(r.ml).toBeCloseTo(0.1, 12)
    expect(r.units).toBeCloseTo(10, 12)
    expect(() => syringeReading(0, 2.5)).toThrow(RangeError)
  })
})

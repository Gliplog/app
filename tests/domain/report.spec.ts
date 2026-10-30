import { describe, expect, it } from 'vitest'
import { niceRange, periodStart } from '@/domain/report'

const DAY = 86_400_000

describe('report helpers', () => {
  it('starts each period the right number of days back', () => {
    expect(periodStart('30d', 100 * DAY)).toBe(70 * DAY)
    expect(periodStart('90d', 100 * DAY)).toBe(10 * DAY)
    expect(periodStart('all', 100 * DAY)).toBe(-Infinity)
  })

  it('spans the data with round steps', () => {
    expect(niceRange(88.4, 101.2)).toEqual([85, 90, 95, 100, 105])
    expect(niceRange(6.1, 7.4)).toEqual([6, 6.5, 7, 7.5])
    const flat = niceRange(80, 80)
    expect(flat[0]).toBeLessThanOrEqual(79)
    expect(flat[flat.length - 1]).toBeGreaterThanOrEqual(81)
  })
})

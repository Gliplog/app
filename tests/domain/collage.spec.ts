import { describe, expect, it } from 'vitest'
import { coverCrop, gridLayout, weekLabel } from '@/domain/collage'

const box = { x: 0, y: 0, width: 1000, height: 1000 }

describe('gridLayout', () => {
  it('puts two photos side by side and four in a square', () => {
    const two = gridLayout(2, box, 20)
    expect(two).toHaveLength(2)
    expect(two[0]!.y).toBe(two[1]!.y)
    expect(two[1]!.x).toBeGreaterThan(two[0]!.x)

    const four = gridLayout(4, box, 20)
    expect(new Set(four.map((r) => r.y)).size).toBe(2)
    expect(new Set(four.map((r) => r.x)).size).toBe(2)
  })

  it('keeps tiles 3:4 and inside the box', () => {
    for (const count of [2, 3, 4, 6]) {
      for (const r of gridLayout(count, { x: 50, y: 100, width: 960, height: 1500 }, 24)) {
        expect(r.width / r.height).toBeCloseTo(0.75)
        expect(r.x).toBeGreaterThanOrEqual(50 - 1e-6)
        expect(r.y).toBeGreaterThanOrEqual(100 - 1e-6)
        expect(r.x + r.width).toBeLessThanOrEqual(1010 + 1e-6)
        expect(r.y + r.height).toBeLessThanOrEqual(1600 + 1e-6)
      }
    }
  })

  it('centres a short last row', () => {
    const three = gridLayout(3, { x: 0, y: 0, width: 1000, height: 2000 }, 0)
    const [a, b, c] = three
    if (a!.y === c!.y) return // one row: nothing to centre
    expect(c!.x + c!.width / 2).toBeCloseTo((a!.x + b!.x + b!.width) / 2)
  })
})

describe('coverCrop', () => {
  it('trims the sides of a wide photo, centred', () => {
    expect(coverCrop(1600, 1200, 300, 400)).toEqual({ x: 350, y: 0, width: 900, height: 1200 })
  })

  it('trims a tall photo mostly from the bottom', () => {
    const r = coverCrop(900, 1600, 300, 400)
    expect(r.width).toBe(900)
    expect(r.height).toBe(1200)
    expect(r.y).toBeCloseTo(160)
  })
})

describe('weekLabel', () => {
  const WEEK = 7 * 86_400_000
  it('counts weeks from the first dose', () => {
    expect(weekLabel(6 * WEEK + 1, 0)).toBe('Week 6')
    expect(weekLabel(-1, 0)).toBe('Before week 1')
    expect(weekLabel(0, null)).toBeNull()
  })
})

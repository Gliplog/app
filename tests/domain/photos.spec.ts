import { describe, expect, it } from 'vitest'
import { defaultComparison, fitWithin, nearestWeight, photoGap } from '@/domain/photos'

const DAY = 86_400_000

describe('fitWithin', () => {
  it('scales the long edge down and never up', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 })
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })

  it('rejects an empty image', () => {
    expect(() => fitWithin(0, 100, 1600)).toThrow(RangeError)
  })
})

describe('nearestWeight', () => {
  const weights = [
    { at: 0, kg: 90 },
    { at: 10 * DAY, kg: 88 },
  ]

  it('picks the closest weigh-in within the window', () => {
    expect(nearestWeight(weights, 9 * DAY)?.kg).toBe(88)
    expect(nearestWeight(weights, 5 * DAY)).toBeNull()
  })

  it('breaks a tie toward the earlier weigh-in', () => {
    expect(nearestWeight(weights, 5 * DAY, 5)?.kg).toBe(90)
  })
})

describe('defaultComparison', () => {
  it('pairs the newest photo with the oldest of the same pose', () => {
    const photos = [
      { id: 'a', at: 0, pose: 'side' as const },
      { id: 'b', at: DAY, pose: 'front' as const },
      { id: 'c', at: 2 * DAY, pose: 'front' as const },
      { id: 'd', at: 3 * DAY, pose: 'front' as const },
    ]
    const pair = defaultComparison(photos)
    expect(pair?.before.id).toBe('b')
    expect(pair?.after.id).toBe('d')
  })

  it('needs two photos of one pose', () => {
    expect(
      defaultComparison([
        { id: 'a', at: 0, pose: 'side' as const },
        { id: 'b', at: DAY, pose: 'front' as const },
      ]),
    ).toBeNull()
  })
})

describe('photoGap', () => {
  it('counts days, then weeks, and the weight change in time order', () => {
    const early = { at: 0, weight: { kg: 100 } }
    const late = { at: 30 * DAY, weight: { kg: 96 } }
    expect(photoGap(late, early)).toEqual({ days: 30, weeks: 4, changeKg: -4 })
    expect(photoGap(early, { at: 3 * DAY, weight: null })).toEqual({
      days: 3,
      weeks: null,
      changeKg: null,
    })
  })
})

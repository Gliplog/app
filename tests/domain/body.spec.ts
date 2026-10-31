import { describe, expect, it } from 'vitest'
import { bmi, bmiBand } from '@/domain/body'

describe('bmi', () => {
  it('is weight over height squared', () => {
    expect(bmi(70, 175)).toBeCloseTo(22.857, 3)
    expect(() => bmi(0, 170)).toThrow(RangeError)
  })

  it('uses the WHO adult bands at their inclusive lower edges', () => {
    expect(bmiBand(18.49).category).toBe('underweight')
    expect(bmiBand(18.5).category).toBe('healthy')
    expect(bmiBand(25).category).toBe('overweight')
    expect(bmiBand(30).category).toBe('obesity-1')
    expect(bmiBand(41).category).toBe('obesity-3')
  })
})

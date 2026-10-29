import { describe, expect, it } from 'vitest'
import { ageOn, bmi, bmiBand, isBirthMonth } from '@/domain/body'

describe('ageOn', () => {
  it('counts completed years, treating the birth month as reached', () => {
    expect(ageOn('1990-06', { year: 2026, month: 5 })).toBe(35)
    expect(ageOn('1990-06', { year: 2026, month: 6 })).toBe(36)
    expect(ageOn('1990-06', { year: 2026, month: 12 })).toBe(36)
  })

  it('rejects malformed or future birth months', () => {
    expect(ageOn('1990-13', { year: 2026, month: 1 })).toBeNull()
    expect(ageOn('2030-01', { year: 2026, month: 1 })).toBeNull()
    expect(isBirthMonth('1990-6')).toBe(false)
    expect(isBirthMonth('1990-06')).toBe(true)
  })
})

describe('bmi', () => {
  it('is weight over height squared', () => {
    expect(bmi(70, 175)).toBeCloseTo(22.857, 3)
    expect(() => bmi(0, 170)).toThrow(RangeError)
  })

  it('uses the WHO adult bands at their inclusive lower edges', () => {
    expect(bmiBand(18.49, 30)!.category).toBe('underweight')
    expect(bmiBand(18.5, 30)!.category).toBe('healthy')
    expect(bmiBand(25, 30)!.category).toBe('overweight')
    expect(bmiBand(30, 30)!.category).toBe('obesity-1')
    expect(bmiBand(41, null)!.category).toBe('obesity-3')
  })

  it('gives no adult band under 18', () => {
    expect(bmiBand(31, 17)).toBeNull()
  })
})

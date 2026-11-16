import { describe, expect, it } from 'vitest'
import { formatAmount, formatDose, roundTo } from '@/domain/units'

describe('dose formatting', () => {
  it('rounds without float noise', () => {
    expect(roundTo(0.1 + 0.2, 4)).toBe(0.3)
  })

  it('formats doses in mg', () => {
    expect(formatDose(0.25)).toBe('0.25 mg')
    expect(formatAmount(2.5, 'mg')).toBe('2.5 mg')
  })
})

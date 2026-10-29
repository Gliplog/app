import { describe, expect, it } from 'vitest'
import {
  daysBetween,
  formatHours,
  fromLocalInputValue,
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

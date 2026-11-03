import { describe, expect, it } from 'vitest'
import {
  LEVEL_STRIP_MAX,
  assignSlots,
  levelStrip,
  stripReadings,
  stripWindow,
  type StripInput,
} from '@/domain/levelStrip'

const H = 3_600_000
const DAY = 24 * H
const now = 200 * DAY

const sema: StripInput = {
  key: 'semaglutide-injection',
  label: 'Ozempic',
  params: { halfLifeHours: 168, tmaxHours: 56 },
  doses: [0, 7, 14, 21, 28].map((d) => ({ at: now - 60 * DAY + d * DAY, amount: 0.25 })),
}
const tirz: StripInput = {
  key: 'tirzepatide-injection',
  label: 'Mounjaro',
  params: { halfLifeHours: 120, tmaxHours: 24 },
  doses: [35, 42, 49, 56].map((d) => ({ at: now - 60 * DAY + d * DAY, amount: 2.5 })),
}

describe('stripWindow', () => {
  it('runs from the first entry to now', () => {
    expect(stripWindow([now - 30 * DAY, now - 2 * DAY], now)).toEqual({
      start: now - 30 * DAY,
      end: now,
    })
  })

  it('reaches back a week for a lone entry from now', () => {
    expect(stripWindow([now], now)).toEqual({ start: now - 7 * DAY, end: now })
    expect(stripWindow([], now)).toEqual({ start: now - 7 * DAY, end: now })
  })
})

describe('levelStrip', () => {
  const window = { start: now - 60 * DAY, end: now }

  it('scales each medicine to its own peak, so a switch does not read as more drug', () => {
    const [s, t] = levelStrip([sema, tirz], window)
    expect(Math.max(...s!.points.map((p) => p[1]))).toBeCloseTo(100, 6)
    expect(Math.max(...t!.points.map((p) => p[1]))).toBeCloseTo(100, 6)
    expect(t!.peakMg).toBeGreaterThan(s!.peakMg)
  })

  it('counts doses before the window toward levels inside it', () => {
    const late = { start: now - 30 * DAY, end: now }
    const [s] = levelStrip([sema], late)
    expect(s!.points[0]![2]).toBeGreaterThan(0)
  })

  it('draws a long-cleared medicine flat rather than scaling up its residue', () => {
    const old = { ...tirz, doses: [{ at: now - 400 * DAY, amount: 2.5 }] }
    const [t] = levelStrip([old], window)
    expect(t!.peakMg).toBe(0)
    expect(t!.points.every((p) => p[1] === 0)).toBe(true)
  })
})

describe('stripReadings', () => {
  it('reads every line exactly at one moment, in percent and mg', () => {
    const window = { start: now - 60 * DAY, end: now }
    const series = levelStrip([sema, tirz], window)
    const readings = stripReadings([sema, tirz], series, now - 10 * DAY)
    expect(readings.map((r) => r.label)).toEqual(['Ozempic', 'Mounjaro'])
    for (const [i, r] of readings.entries()) {
      expect(r.percent).toBeCloseTo((r.mg / series[i]!.peakMg) * 100, 9)
    }
  })
})

describe('assignSlots', () => {
  it('keeps a medicine’s colour when another comes or goes, and caps at the maximum', () => {
    const first = assignSlots(['a', 'b', 'c', 'd'], new Map())
    expect(first.size).toBe(LEVEL_STRIP_MAX)
    const next = assignSlots(['c', 'e'], first)
    expect(next.get('c')).toBe(2)
    expect(next.get('e')).toBe(0)
  })
})

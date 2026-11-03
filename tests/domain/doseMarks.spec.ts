import { describe, expect, it } from 'vitest'
import { doseMarks, type DoseMarkInput } from '@/domain/doseMarks'

const DAY = 86_400_000
const line = [
  { at: 10 * DAY, value: 100 },
  { at: 40 * DAY, value: 97 },
]
const dose = (day: number, mg: number, key = 'sema'): DoseMarkInput => ({
  key,
  label: key,
  at: day * DAY,
  mg,
})

describe('doseMarks', () => {
  it('sits each dose on the line at its date', () => {
    const [mark] = doseMarks([dose(25, 0.5)], line)
    expect(mark!.value).toBeCloseTo(98.5, 9)
  })

  it('labels only the first dose and each change of strength, per medicine', () => {
    const marks = doseMarks(
      [dose(10, 0.25), dose(17, 0.25), dose(24, 0.5), dose(31, 0.5), dose(31, 2.5, 'tirz')],
      line,
    )
    expect(marks.map((m) => m.changed)).toEqual([true, false, true, false, true])
    // Each medicine's first mark is flagged, so a switch can be named rather than read as a dose.
    expect(marks.map((m) => m.first)).toEqual([true, false, false, false, true])
  })

  it('leaves off doses with no measured height and labels the first one on the line', () => {
    const marks = doseMarks([dose(0, 0.25), dose(12, 0.25), dose(60, 0.5)], line)
    expect(marks).toHaveLength(1)
    expect(marks[0]).toMatchObject({ at: 12 * DAY, changed: true })
  })

  it('orders doses by date whatever order they arrive in', () => {
    const marks = doseMarks([dose(31, 0.5), dose(17, 0.25)], line)
    expect(marks.map((m) => m.at)).toEqual([17 * DAY, 31 * DAY])
  })
})

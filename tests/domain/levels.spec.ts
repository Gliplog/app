import { describe, expect, it } from 'vitest'
import { groupLevels, levelKey, levelsModel, type LevelMedication } from '@/domain/levels'

const H = 3_600_000
const SEMA = { params: { halfLifeHours: 168, tmaxHours: 56 }, userSupplied: false }

const med = (
  id: string,
  pkProfile: string | null,
  extra: Partial<LevelMedication> = {},
): LevelMedication => ({ id, pkProfile, label: pkProfile ?? id, pk: null, ...extra })

describe('groupLevels', () => {
  it('pools doses of the same medicine and route across medications, oldest first', () => {
    const groups = groupLevels(
      [
        med('ozempic', 'semaglutide-injection', { pk: SEMA }),
        med('compounded', 'semaglutide-injection', { pk: SEMA }),
      ],
      [
        { medicationId: 'compounded', at: 14 * 24 * H, doseMg: 0.5 },
        { medicationId: 'ozempic', at: 0, doseMg: 0.25 },
      ],
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ key: 'semaglutide-injection', medicationCount: 2 })
    expect(groups[0]!.doses.map((d) => d.amount)).toEqual([0.25, 0.5])
  })

  it('keeps a medication outside the catalog in its own group, and skips orphaned doses', () => {
    const groups = groupLevels(
      [med('a', null), med('b', null)],
      [
        { medicationId: 'a', at: 1 * H, doseMg: 1 },
        { medicationId: 'b', at: 2 * H, doseMg: 1 },
        { medicationId: 'gone', at: 3 * H, doseMg: 1 },
      ],
    )
    expect(groups.map((g) => g.key)).toEqual(['med:b', 'med:a'])
    expect(levelKey({ id: 'a', pkProfile: null })).toBe('med:a')
  })
})

describe('levelsModel', () => {
  it('peaks near the label time to peak after one weekly dose', () => {
    const model = levelsModel({
      params: SEMA.params,
      doses: [{ at: 0, amount: 1 }],
      preview: null,
      unitLabel: 'mg',
      now: 24 * H,
    })
    const peakHours = model.summary.peak!.at / H
    expect(peakHours).toBeGreaterThan(48)
    expect(peakHours).toBeLessThan(64)
  })
})

import { describe, expect, it } from 'vitest'
import {
  findOverlap,
  joinNames,
  overlapText,
  sanitizeDismissed,
  type OverlapMedication,
} from '@/domain/overlap'

const med = (
  id: string,
  name: string,
  pkProfile: string | null,
  molecule: string | null,
  route: 'injection' | 'tablet' | null,
): OverlapMedication => ({ id, name, pkProfile, molecule, route })

const ozempic = med('1', 'Ozempic', 'semaglutide-injection', 'semaglutide', 'injection')
const wegovy = med('2', 'Wegovy', 'semaglutide-injection', 'semaglutide', 'injection')
const compounded = med(
  '3',
  'Compounded semaglutide',
  'semaglutide-injection',
  'semaglutide',
  'injection',
)
const rybelsus = med('4', 'Rybelsus', 'semaglutide-tablet', 'semaglutide', 'tablet')
const mounjaro = med('5', 'Mounjaro', 'tirzepatide-injection', 'tirzepatide', 'injection')
const zepbound = med('6', 'Zepbound', 'tirzepatide-injection', 'tirzepatide', 'injection')
const custom = med('7', 'My GLP-1', null, null, null)

describe('findOverlap', () => {
  it('stays quiet for one medicine, however many brands or compounded versions', () => {
    expect(findOverlap([])).toBeNull()
    expect(findOverlap([ozempic])).toBeNull()
    expect(findOverlap([ozempic, wegovy])).toBeNull()
    expect(findOverlap([ozempic, compounded])).toBeNull()
    expect(findOverlap([mounjaro, zepbound])).toBeNull()
  })

  it('flags different molecules', () => {
    expect(findOverlap([ozempic, mounjaro])).toMatchObject({
      kind: 'molecules',
      molecules: ['semaglutide', 'tirzepatide'],
    })
  })

  it('flags one molecule by two routes', () => {
    expect(findOverlap([wegovy, rybelsus])).toMatchObject({
      kind: 'routes',
      molecules: ['semaglutide'],
    })
  })

  it('flags a medication outside the catalog alongside another, as unknown', () => {
    expect(findOverlap([custom, ozempic])?.kind).toBe('unknown')
  })

  it('keys on the medicines, so another brand of one already listed keeps a dismissal', () => {
    const a = findOverlap([ozempic, mounjaro])!
    const b = findOverlap([ozempic, compounded, mounjaro])!
    expect(b.key).toBe(a.key)
    expect(findOverlap([ozempic, mounjaro, rybelsus])!.key).not.toBe(a.key)
  })
})

describe('overlapText', () => {
  it('says what the records show and how to fix a switch, without advice', () => {
    const t = overlapText(findOverlap([ozempic, mounjaro])!)
    expect(t.title).toBe('Ozempic and Mounjaro are both marked as in use')
    expect(t.body).toContain('different medicines: semaglutide and tirzepatide')
    expect(t.body).toContain('mark the old one as stopped')
  })

  it('names the two routes of one molecule', () => {
    const t = overlapText(findOverlap([wegovy, rybelsus])!)
    expect(t.body).toContain('semaglutide taken two ways')
  })

  it('reads "all" for three or more', () => {
    expect(overlapText(findOverlap([ozempic, mounjaro, rybelsus])!).title).toBe(
      'Ozempic, Mounjaro and Rybelsus are all marked as in use',
    )
  })
})

describe('joinNames', () => {
  it('joins with commas and "and"', () => {
    expect(joinNames(['A'])).toBe('A')
    expect(joinNames(['A', 'B'])).toBe('A and B')
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C')
  })
})

describe('sanitizeDismissed', () => {
  it('keeps strings only, and a bounded number', () => {
    expect(sanitizeDismissed(null)).toEqual([])
    expect(sanitizeDismissed(['a', 1, 'b'])).toEqual(['a', 'b'])
    expect(sanitizeDismissed(Array.from({ length: 80 }, (_, i) => `k${i}`))).toHaveLength(50)
  })
})

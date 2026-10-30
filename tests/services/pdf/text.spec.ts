import { describe, expect, it } from 'vitest'
import { ellipsise, measure, pdfString, toWinAnsi, wrap } from '@/services/pdf/text'

describe('toWinAnsi', () => {
  it('keeps ASCII and Latin-1 as they are', () => {
    expect(toWinAnsi('BPC-157 · t½ 7 days, 5 µg, café')).toBe('BPC-157 · t½ 7 days, 5 µg, café')
  })

  it('maps the Windows-1252 extras to their single bytes', () => {
    expect(toWinAnsi('€ … – — ‘’ “” •')).toBe('\x80 \x85 \x96 \x97 \x91\x92 \x93\x94 \x95')
  })

  it('spells out common symbols and strips accents the font lacks', () => {
    expect(toWinAnsi('≥ 2 mg, β-alanine, Łódź, μ')).toBe('>= 2 mg, beta-alanine, Lódz, µ')
  })

  it('turns other scripts and emoji into "?"', () => {
    expect(toWinAnsi('ok 💉 пептид')).toBe('ok ? ??????')
  })

  it('turns line breaks, controls and Unicode spaces into plain spaces', () => {
    expect(toWinAnsi('a\nb\tc d e\u0085f')).toBe('a b c d e f')
  })

  it('never yields a char above 0xFF', () => {
    const all = Array.from({ length: 0x3000 }, (_, i) => String.fromCodePoint(i)).join('')
    expect([...toWinAnsi(all)].every((c) => c.charCodeAt(0) <= 0xff)).toBe(true)
  })
})

describe('measure', () => {
  it('uses the Helvetica metrics every viewer lays out with', () => {
    // H 722, e 556, l 222, l 222, o 556 (regular); H 722, e 556, l 278, l 278, o 611 (bold).
    expect(measure('Hello', 'regular', 10)).toBeCloseTo(22.78)
    expect(measure('Hello', 'bold', 10)).toBeCloseTo(24.45)
    expect(measure('…', 'regular', 10)).toBeCloseTo(10)
  })
})

describe('wrap and ellipsise', () => {
  it('breaks between words within the width', () => {
    const lines = wrap('one two three four five six', 'regular', 10, 60)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(measure(line, 'regular', 10)).toBeLessThanOrEqual(60)
    expect(lines.join(' ')).toBe('one two three four five six')
  })

  it('keeps an over-long word whole rather than splitting it', () => {
    expect(wrap('Supercalifragilistic', 'regular', 10, 20)).toEqual(['Supercalifragilistic'])
  })

  it('ellipsises the last allowed line', () => {
    const lines = wrap('one two three four five six', 'regular', 10, 60, 1)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/…$/)
    expect(measure(lines[0]!, 'regular', 10)).toBeLessThanOrEqual(60)
  })

  it('shortens text to fit, or leaves it alone when it fits', () => {
    expect(ellipsise('short', 'regular', 10, 100)).toBe('short')
    const cut = ellipsise('a much longer vial name', 'regular', 10, 50)
    expect(cut).toMatch(/…$/)
    expect(measure(cut, 'regular', 10)).toBeLessThanOrEqual(50)
  })
})

describe('pdfString', () => {
  it('escapes the characters that could end the string or start an escape', () => {
    expect(pdfString('a(b)c\\d')).toBe('(a\\(b\\)c\\\\d)')
  })
})

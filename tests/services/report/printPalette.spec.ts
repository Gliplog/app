import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MARK_COLOURS, PRINT_TOKENS } from '@/services/report/printPalette'

const tokens = readFileSync(resolve('src/styles/tokens.css'), 'utf8')
const light = tokens.slice(tokens.indexOf('.v-theme--light {'), tokens.indexOf('.v-theme--dark {'))

describe('print palette', () => {
  it('matches the light theme tokens', () => {
    for (const [name, hex] of Object.entries(PRINT_TOKENS)) {
      const m = new RegExp(`--gl-${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(light)
      expect(m?.[1]?.toLowerCase(), `--gl-${name}`).toBe(hex)
    }
  })

  it('draws the mark in the brand mark’s colours', () => {
    const mark = readFileSync(resolve('src/assets/brand/gliplog-mark.svg'), 'utf8')
    const { tile: _tile, ...drawn } = MARK_COLOURS
    for (const hex of Object.values(drawn)) expect(mark).toContain(hex)
  })
})

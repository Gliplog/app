// Fails when a text token in src/styles/tokens.css drops below WCAG AA (4.5:1) against the
// surfaces it is used on, in either theme. Run by `npm run check:contrast` and `make check`.
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')

function block(selector) {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`tokens.css: ${selector} block not found`)
  const body = css.slice(start, css.indexOf('\n  }', start))
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]),
  )
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const PAIRS = [
  ['gl-text-1', ['gl-bg', 'gl-surface', 'gl-surface-2']],
  ['gl-text-2', ['gl-bg', 'gl-surface', 'gl-surface-2']],
  ['gl-text-3', ['gl-bg', 'gl-surface']],
  ['gl-brand', ['gl-bg', 'gl-surface']],
  ['gl-accent', ['gl-surface', 'gl-accent-soft']],
  ['gl-good-fg', ['gl-good-bg']],
  ['gl-notice-fg', ['gl-notice-bg']],
  ['gl-alert-fg', ['gl-alert-bg']],
  ['gl-info-fg', ['gl-info-bg']],
]

let failed = false
for (const theme of ['.v-theme--light', '.v-theme--dark']) {
  const tokens = block(theme)
  for (const [fg, bgs] of PAIRS) {
    for (const bg of bgs) {
      if (!tokens[fg] || !tokens[bg]) {
        console.error(`${theme}: missing --${fg} or --${bg}`)
        failed = true
        continue
      }
      const r = ratio(tokens[fg], tokens[bg])
      if (r < 4.5) {
        console.error(`${theme}: --${fg} on --${bg} is ${r.toFixed(2)}:1 (needs 4.5:1)`)
        failed = true
      }
    }
  }
}
if (failed) process.exit(1)
console.log('contrast: all text tokens meet WCAG AA in light and dark')

// Markdown gate: no em-dashes (U+2014) in any tracked markdown file. A line that must quote
// one verbatim carries <!-- em-dash-ok -->. Run by `npm run check:md` and `make check`.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const SKIP = new Set([
  'node_modules',
  'dist',
  'dev-dist',
  '.git',
  'playwright-report',
  'test-results',
])
const EM_DASH = '—'

function* markdownFiles(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* markdownFiles(path)
    else if (name.endsWith('.md')) yield path
  }
}

let failures = 0
for (const file of markdownFiles(root)) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (line.includes(EM_DASH) && !line.includes('<!-- em-dash-ok -->')) {
        console.error(
          `${relative(root, file)}:${i + 1}: em-dash; use a colon, comma, semicolon, or parentheses`,
        )
        failures++
      }
    })
}
if (failures) process.exit(1)
console.log('markdown: no em-dashes')

// Styling gate: colours live only in src/styles/tokens.css and src/plugins/vuetify.ts.
// Components and views use --gl-* tokens or Vuetify theme colours, never raw hex/rgb values or
// Material colour names. Run by `npm run check:tokens` and `make check`.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const SCAN = ['src/components', 'src/views', 'src/App.vue', 'src/styles/theme.css']
const RAW_COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/
const MATERIAL_NAME =
  /\bcolor="(red|pink|purple|indigo|blue|cyan|teal|green|lime|yellow|amber|orange|brown|grey|gray)"/
const TOKEN_USE = /var\(--gl-([\w-]+)/g

const defined = new Set(
  [...readFileSync(join(root, 'src/styles/tokens.css'), 'utf8').matchAll(/--gl-([\w-]+):/g)].map(
    (m) => m[1],
  ),
)

function* files(path) {
  const full = join(root, path)
  if (statSync(full).isDirectory()) {
    for (const name of readdirSync(full)) yield* files(join(path, name))
  } else if (/\.(vue|css|ts)$/.test(path)) yield full
}

let failures = 0
for (const entry of SCAN) {
  for (const file of files(entry)) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const where = `${relative(root, file)}:${i + 1}`
        // theme.css may use rgb(var(--v-theme-*)) to read Vuetify theme colours.
        const stripped = line.replace(/rgba?\(var\(--v-theme-[\w-]+\)[^)]*\)/g, '')
        if (RAW_COLOUR.test(stripped) && !/\/\/|\/\*|^\s*\*/.test(line.trim().slice(0, 2))) {
          console.error(`${where}: raw colour; use a --gl-* token or a Vuetify theme colour`)
          failures++
        }
        if (MATERIAL_NAME.test(line)) {
          console.error(
            `${where}: Material colour name; use primary/secondary/success/warning/error/info`,
          )
          failures++
        }
        for (const m of line.matchAll(TOKEN_USE)) {
          if (!defined.has(m[1])) {
            console.error(
              `${where}: --gl-${m[1]} is not defined in tokens.css (it would fall back silently)`,
            )
            failures++
          }
        }
      })
  }
}
if (failures) process.exit(1)
console.log('tokens: no raw colours, every --gl-* token exists')

/*
 * Captures the Today and Progress screenshots for the project site (gliplog.com) from the
 * production build, light and dark. Run `npm run screenshots:site` after a change to either
 * screen; the site-screenshots skill has the full steps.
 *
 * The data is the made-up course in sample-backup.mjs, restored through Settings, so the shot
 * shows exactly what restored data renders as.
 *
 * Usage: node scripts/site-screenshots.mjs [output dir]
 * The default output is ../gliplog.github.io/site/assets/screens, the site's sibling checkout.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
import { preview } from 'vite'
import { sampleBackup } from './sample-backup.mjs'

const OUT = resolve(process.argv[2] ?? '../gliplog.github.io/site/assets/screens')
const PORT = 4175

// The site's phone frames are 540 x 1099: a 360-wide phone at 1.5x.
const VIEWPORT = { width: 360, height: 733 }
const SCALE = 1.5
const SIZE = { width: 540, height: 1099 }

const work = mkdtempSync(join(tmpdir(), 'gliplog-shots-'))
const backupPath = join(work, 'sample-backup.json')
writeFileSync(backupPath, JSON.stringify(sampleBackup()))
mkdirSync(OUT, { recursive: true })

/** Each shot is the top of a tab, once the content that makes it worth showing has rendered. */
const SHOTS = [
  {
    name: 'today',
    tab: 'Today',
    ready: (page) => page.getByRole('img', { name: /Estimated amount in the body now/ }),
  },
  { name: 'progress', tab: 'Progress', ready: (page) => page.getByText('Since you started') },
]

const server = await preview({ preview: { port: PORT, strictPort: true } })
const browser = await chromium.launch()
try {
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: SCALE,
      isMobile: true,
      hasTouch: true,
      colorScheme: scheme,
      locale: 'en-US',
      reducedMotion: 'reduce',
      // Lets the shot hide notifications with a style tag under the app's CSP.
      bypassCSP: true,
    })
    const page = await context.newPage()
    await page.goto(`http://localhost:${PORT}/app/`)
    await page.getByRole('button', { name: "I'm 18 or older and understand" }).click()
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
    await page.getByLabel('Backup file').setInputFiles(backupPath)
    await page.getByRole('button', { name: 'Restore backup' }).click()
    await page.getByText('Backup restored').waitFor()
    await page.addStyleTag({ content: '.v-snackbar { display: none !important; }' })
    for (const shot of SHOTS) {
      await page.getByRole('link', { name: shot.tab, exact: true }).first().click()
      await shot.ready(page).waitFor()
      // Fonts and the chart's first paint settle after the content is in the tree.
      await page.waitForTimeout(1500)
      const png = await page.screenshot({
        clip: { x: 0, y: 0, width: VIEWPORT.width, height: SIZE.height / SCALE },
      })
      const file = join(OUT, `${shot.name}-${scheme}.webp`)
      await sharp(png).resize(SIZE.width, SIZE.height).webp({ quality: 82 }).toFile(file)
      console.log(`wrote ${file}`)
    }
    await context.close()
  }
} finally {
  await browser.close()
  await new Promise((done) => server.httpServer.close(done))
  rmSync(work, { recursive: true, force: true })
}

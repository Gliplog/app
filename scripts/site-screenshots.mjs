/*
 * Captures the Today screenshots for the project site (tidebook.github.io) from the production
 * build, light and dark. Run `npm run screenshots:site` after a change to the Today screen; the
 * site-screenshots skill has the full steps.
 *
 * The data is a made-up 20-week Wegovy course, never real records. It goes in through Settings,
 * Restore, the same path a user takes, so the shot shows exactly what restored data renders as.
 * Dates are relative to now, so "next dose in 2 days" stays true whenever this runs.
 *
 * Usage: node scripts/site-screenshots.mjs [output dir]
 * The default output is ../tidebook.github.io/site/assets/screens, the site's sibling checkout.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'
import { preview } from 'vite'

const OUT = resolve(process.argv[2] ?? '../tidebook.github.io/site/assets/screens')
const PORT = 4175

// The site's phone frames are 540 x 1099: a 360-wide phone at 1.5x.
const VIEWPORT = { width: 360, height: 733 }
const SCALE = 1.5
const SIZE = { width: 540, height: 1099 }

const DAY = 86_400_000
const now = Date.now()
const iso = (ms) => new Date(ms).toISOString()
/** A local time of day `daysAgo` days back, so entries read like a real routine. */
const at = (daysAgo, hour) => {
  const d = new Date(now - daysAgo * DAY)
  d.setHours(hour, 7, 0, 0)
  return d.getTime()
}
const created = iso(now - 150 * DAY)

/** A weekly course stepping up the label's titration every four weeks, last dose 5 days ago. */
function sampleBackup() {
  const firstDoseDaysAgo = 19 * 7 + 5
  const steps = [0.25, 0.5, 1, 1.7, 2.4]
  const sites = ['abdomen-left', 'abdomen-right', 'thigh-left', 'thigh-right']
  const doses = Array.from({ length: 20 }, (_, i) => ({
    id: `d${i}`,
    medicationId: 'm1',
    takenAt: iso(at(firstDoseDaysAgo - i * 7, 19)),
    doseMg: steps[Math.floor(i / 4)],
    site: sites[i % 4],
    notes: '',
    createdAt: created,
  }))
  // A baseline the day before the first dose, then weekly weigh-ins easing towards 92.6 kg.
  const weights = Array.from({ length: 21 }, (_, i) => {
    const daysAgo = i === 0 ? firstDoseDaysAgo + 1 : Math.max(1, firstDoseDaysAgo - i * 7 + 3)
    const kg = i === 20 ? 92.6 : 92.6 + 11.4 * Math.exp(-i / 9) + (i % 3 === 1 ? 0.3 : 0)
    return {
      id: `w${i}`,
      measuredAt: iso(at(daysAgo, 7)),
      kg: Math.round(kg * 10) / 10,
      enteredUnit: 'kg',
      notes: '',
      createdAt: created,
    }
  })
  const symptoms = [
    [130, 'nausea', 'mild'],
    [123, 'nausea', 'moderate'],
    [95, 'constipation', 'mild'],
    [40, 'tiredness', 'mild'],
    [4, 'nausea', 'mild'],
  ].map(([daysAgo, symptom, severity], i) => ({
    id: `s${i}`,
    occurredAt: iso(at(daysAgo, 12)),
    symptom,
    otherText: '',
    severity,
    notes: '',
    createdAt: created,
  }))
  const glucose = [
    { kind: 'a1c', daysAgo: firstDoseDaysAgo + 3, value: 6.1, enteredUnit: '%', context: null },
    { kind: 'a1c', daysAgo: 10, value: 5.6, enteredUnit: '%', context: null },
    { kind: 'glucose', daysAgo: 2, value: 96, enteredUnit: 'mg/dL', context: 'fasting' },
  ].map(({ daysAgo, ...g }, i) => ({
    id: `g${i}`,
    ...g,
    measuredAt: iso(at(daysAgo, 8)),
    notes: '',
    createdAt: created,
  }))
  return {
    format: 'tidebook-backup',
    version: 2,
    exportedAt: iso(now),
    medications: [
      {
        id: 'm1',
        productId: 'wegovy',
        name: 'Wegovy',
        intervalDays: 7,
        concentrationMgPerMl: null,
        pkOverride: null,
        status: 'active',
        notes: '',
        createdAt: created,
        updatedAt: created,
      },
    ],
    doses,
    weights,
    symptoms,
    glucose,
    // Restore replaces settings too: keep the notice accepted and the install hint away.
    settings: [
      {
        key: 'profile',
        value: {
          heightCm: 172,
          birthMonth: null,
          gender: 'unspecified',
          genderText: '',
          goalKg: 85,
        },
      },
      { key: 'disclaimerAcceptedAt', value: iso(now) },
      { key: 'installHintDismissed', value: true },
      { key: 'lastBackupAt', value: iso(now) },
    ],
  }
}

const work = mkdtempSync(join(tmpdir(), 'tidebook-shots-'))
const backupPath = join(work, 'sample-backup.json')
writeFileSync(backupPath, JSON.stringify(sampleBackup()))
mkdirSync(OUT, { recursive: true })

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
    await page.getByRole('button', { name: 'I understand' }).click()
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
    await page.getByLabel('Backup file').setInputFiles(backupPath)
    await page.getByRole('button', { name: 'Restore backup' }).click()
    await page.getByText('Backup restored').waitFor()
    await page.addStyleTag({ content: '.v-snackbar { display: none !important; }' })
    await page.getByRole('link', { name: 'Today', exact: true }).first().click()
    await page.getByRole('img', { name: /Estimated amount in the body now/ }).waitFor()
    // Fonts and the chart's first paint settle after the image is in the tree.
    await page.waitForTimeout(1500)
    const png = await page.screenshot({
      clip: { x: 0, y: 0, width: VIEWPORT.width, height: SIZE.height / SCALE },
    })
    const file = join(OUT, `today-${scheme}.webp`)
    await sharp(png).resize(SIZE.width, SIZE.height).webp({ quality: 82 }).toFile(file)
    console.log(`wrote ${file}`)
    await context.close()
  }
} finally {
  await browser.close()
  await new Promise((done) => server.httpServer.close(done))
  rmSync(work, { recursive: true, force: true })
}

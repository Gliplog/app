import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Accept the first-run notice. The dialog closes only once the acceptance is on disk, so its
 * button disappearing is the point after which a reload keeps it accepted.
 */
async function acceptDisclaimer(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'A private journal, not medical advice' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'I understand' }).click()
  await expect(page.getByRole('button', { name: 'I understand' })).toBeHidden()
}

/**
 * The first service worker activates without claiming the page that registered it, so wait for
 * activation and reload once: from then on every request goes through the precache.
 */
async function waitForServiceWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true)
}

async function choose(page: Page | Locator, group: string, value: string) {
  await page
    .getByRole('group', { name: group })
    .getByRole('button', { name: value, exact: true })
    .click()
}

/** Adds a medication from the catalog through the empty-state button or the list. */
async function addMedication(page: Page, name: string, concentration?: string) {
  await page.getByRole('button', { name: 'Add medication' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Medication' })
  const field = dialog.getByRole('combobox', { name: 'Medication' })
  await field.click()
  await field.fill(name)
  await page.getByRole('option', { name: new RegExp(`^${name} [a-z]+ ·`) }).click()
  if (concentration) await dialog.getByLabel('Vial strength (optional)').fill(concentration)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Medication added')).toBeVisible()
}

async function logWeight(page: Page, value: string) {
  await page
    .getByRole('button', { name: /^Log (a )?weight$/ })
    .first()
    .click()
  const dialog = page.getByRole('dialog', { name: 'Weigh-in' })
  await dialog.getByLabel('Weight').fill(value)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Weight logged')).toBeVisible()
}

test('logs a medication, a dose and a weight, then shows the next dose, BMI and trials', async ({
  page,
}) => {
  await page.goto('./')
  await acceptDisclaimer(page)
  await expect(page.getByText('Start with what you take')).toBeVisible()

  await addMedication(page, 'Wegovy')
  await page.getByRole('button', { name: 'Log dose' }).click()
  const dose = page.getByRole('dialog', { name: 'Wegovy' })
  await choose(dose, 'Dose', '0.25 mg')
  await dose.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('0.25 mg logged')).toBeVisible()
  await expect(page.getByText(/^Next dose .+, in 7 days$/)).toBeVisible()
  await expect(page.getByRole('img', { name: /Estimated amount in the body now/ })).toBeVisible()

  await logWeight(page, '100')
  await expect(page.getByText('Add your height in Settings to see your BMI.')).toBeVisible()

  await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
  await page.getByRole('spinbutton', { name: 'Height' }).fill('175')
  await page.getByRole('button', { name: 'Save profile' }).click()
  await expect(page.getByText('Profile saved').first()).toBeVisible()

  await page.getByRole('link', { name: 'Today', exact: true }).first().click()
  await expect(page.getByText(/32\.7 · Obesity class 1/)).toBeVisible()

  await page.getByRole('link', { name: 'Progress', exact: true }).first().click()
  // One chart merges every semaglutide injection trial; each trial's own card is folded below.
  await expect(
    page.getByRole('img', { name: /Trial readouts at week 30, 40, 68, 72/ }),
  ).toBeVisible()
  await page.getByRole('button', { name: /Show each trial/ }).click()
  await expect(page.getByText('STEP 1 · 68 weeks')).toBeVisible()
  await expect(page.locator('li', { hasText: 'Semaglutide 2.4 mg' }).first()).toContainText(
    '\u221214.9%',
  )
})

test('the medication stack switches medicines and the levels chart follows', async ({ page }) => {
  await page.goto('./')
  await acceptDisclaimer(page)
  await addMedication(page, 'Wegovy')
  await addMedication(page, 'Zepbound')
  await page.getByRole('button', { name: 'Log dose' }).click()
  await choose(page.getByRole('dialog', { name: 'Zepbound' }), 'Dose', '2.5 mg')
  await page.getByRole('dialog', { name: 'Zepbound' }).getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('2.5 mg logged')).toBeVisible()
  await expect(page.getByText('Tirzepatide injection')).toBeVisible()

  // Only the front card is reachable, so each control exists once.
  await expect(page.getByRole('button', { name: 'Log dose' })).toHaveCount(1)
  await page.getByRole('button', { name: 'Next medication' }).click()
  await expect(page.getByText('Showing Wegovy, 2 of 2')).toBeAttached()
  await expect(page.getByText('Log a dose of Wegovy to see an estimate here.')).toBeVisible()
  await page
    .getByRole('group', { name: 'Choose a medication' })
    .getByRole('button', { name: 'Zepbound' })
    .click()
  await expect(page.getByText('Tirzepatide injection')).toBeVisible()

  await page.getByRole('link', { name: 'Progress', exact: true }).first().click()
  const cohorts = page.locator('.v-card', { hasText: 'Trial cohorts' })
  await expect(cohorts).toContainText('Tirzepatide injection')
  await choose(page, 'Medication', 'Wegovy')
  await expect(cohorts).toContainText('Semaglutide injection')
  await expect(page.getByText('Log a dose of Wegovy to add your own line.')).toBeVisible()
})

test('shares a trend as an image and exports the journal as a PDF', async ({ page }) => {
  // Take the download path on every browser: a share sheet cannot be driven from a test.
  await page.addInitScript(() => {
    delete (navigator as { canShare?: unknown }).canShare
  })
  await page.goto('./')
  await acceptDisclaimer(page)
  await logWeight(page, '100')
  await page.getByRole('link', { name: 'Progress', exact: true }).first().click()

  await page.getByRole('button', { name: 'Share weight as an image' }).click()
  const share = page.getByRole('dialog', { name: 'Share as an image' })
  const preview = share.getByRole('img', { name: 'Preview of the image to share' })
  // Decoded, not just present: the production CSP must allow the blob: preview.
  await expect
    .poll(() => preview.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBeGreaterThan(0)
  await expect(share.getByText('Only the percent change is shown.')).toBeVisible()
  const image = page.waitForEvent('download')
  await share.getByRole('button', { name: 'Share' }).click()
  expect((await image).suggestedFilename()).toMatch(/^gliplog-weight-\d{4}-\d{2}-\d{2}\.png$/)

  await page.getByRole('button', { name: 'Export PDF' }).first().click()
  const report = page.getByRole('dialog', { name: 'Export PDF' })
  await choose(report, 'Period', 'All')
  const pdf = page.waitForEvent('download')
  await report.getByRole('button', { name: 'Export' }).click()
  const file = await pdf
  expect(file.suggestedFilename()).toMatch(/^gliplog-report-\d{4}-\d{2}-\d{2}\.pdf$/)
  const bytes = await (await import('node:fs/promises')).readFile((await file.path())!)
  expect(bytes.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4')
})

test('a field label stays above its field when the field is focused', async ({ page }) => {
  await page.goto('./')
  await acceptDisclaimer(page)
  await page
    .getByRole('button', { name: /^Log (a )?weight$/ })
    .first()
    .click()
  const dialog = page.getByRole('dialog', { name: 'Weigh-in' })
  await expect(dialog).toBeVisible()
  // Focus, then record the label's position every frame for the length of any animation.
  const positions = await dialog.evaluate(async (root) => {
    const finite = root
      .getAnimations({ subtree: true })
      .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
    await Promise.all(finite.map((a) => a.finished))
    const label = [...root.querySelectorAll('.v-field-label')].find(
      (el) => el.textContent?.trim() === 'Notes (optional)',
    )!
    const input = root.querySelector<HTMLElement>('textarea')!
    const read = () => {
      const r = label.getBoundingClientRect()
      return `${Math.round(r.x)},${Math.round(r.y)}`
    }
    const seen = [read()]
    input.focus()
    for (let i = 0; i < 20; i++) {
      await new Promise(requestAnimationFrame)
      seen.push(read())
    }
    return seen
  })
  expect(new Set(positions).size).toBe(1)
})

test('logs side effects and blood sugar, in the units chosen in Settings', async ({ page }) => {
  await page.goto('./')
  await acceptDisclaimer(page)
  await addMedication(page, 'Ozempic')

  await page.getByRole('button', { name: 'Log side effect' }).click()
  const effects = page.getByRole('dialog', { name: 'Side effects' })
  await effects.getByRole('button', { name: 'Nausea' }).click()
  await effects.getByRole('button', { name: 'Stomach pain' }).click()
  await choose(effects, 'How strong', 'Severe')
  await expect(effects.getByText(/possible sign of pancreatitis/)).toBeVisible()
  await effects.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Side effects logged')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Side effects this week' })).toContainText('Nausea')

  await page.getByRole('button', { name: 'Log blood sugar' }).click()
  const sugar = page.getByRole('dialog', { name: 'Blood sugar' })
  await sugar.getByLabel('HbA1c').fill('7.2')
  await sugar.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Reading logged')).toBeVisible()
  await expect(page.getByText('HbA1c 7.2%')).toBeVisible()

  await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
  await choose(page, 'HbA1c unit', 'mmol/mol')
  await page.getByRole('link', { name: 'Today', exact: true }).first().click()
  await expect(page.getByText('HbA1c 55 mmol/mol')).toBeVisible()

  await page.getByRole('link', { name: 'History', exact: true }).first().click()
  await page.getByRole('tab', { name: /Side effects/ }).click()
  await expect(page.getByText('Stomach pain')).toBeVisible()
})

test('a compounded vial shows the dose as syringe units', async ({ page }) => {
  await page.goto('./')
  await acceptDisclaimer(page)
  await addMedication(page, 'Compounded semaglutide', '2.5')
  await page.getByRole('button', { name: 'Log dose' }).click()
  const dose = page.getByRole('dialog', { name: 'Compounded semaglutide' })
  await choose(dose, 'Dose', '0.25 mg')
  await expect(dose.getByRole('img', { name: /filled to 10 of 100 units/ })).toBeVisible()
  await expect(dose.locator('span').getByText('10 units', { exact: true })).toBeVisible()
  await expect(dose.getByText(/0\.1 mL on a U-100 syringe/)).toBeVisible()
})

test('editing a medication keeps a custom interval instead of resetting it to the label', async ({
  page,
}) => {
  await page.goto('./')
  await acceptDisclaimer(page)
  await page.getByRole('button', { name: 'Add medication' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Medication' })
  const field = dialog.getByRole('combobox', { name: 'Medication' })
  await field.click()
  await field.fill('Compounded semaglutide')
  await page.getByRole('option', { name: /^Compounded semaglutide [a-z]+ ·/ }).click()
  await choose(dialog, 'How often', 'Other')
  await dialog.getByLabel('Every').fill('3')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Medication added')).toBeVisible()

  await page.getByRole('listitem').filter({ hasText: 'Compounded semaglutide' }).click()
  const edit = page.getByRole('dialog', { name: 'Compounded semaglutide' })
  await expect(
    edit.getByRole('group', { name: 'How often' }).getByRole('button', { name: 'Other' }),
  ).toHaveClass(/v-btn--active/)
  await expect(edit.getByLabel('Every')).toHaveValue('3')
})

test('weights switch between kilograms and pounds without rounding drift', async ({ page }) => {
  await page.goto('./')
  await acceptDisclaimer(page)
  await logWeight(page, '81.3')
  await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
  await choose(page, 'Weight unit', 'Pounds')
  await page.getByRole('link', { name: 'History', exact: true }).first().click()
  await page.getByRole('tab', { name: /Weights/ }).click()
  await expect(page.getByText('179.2 lb')).toBeVisible()
  await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
  await choose(page, 'Weight unit', 'Kilograms')
  await page.getByRole('link', { name: 'History', exact: true }).first().click()
  await page.getByRole('tab', { name: /Weights/ }).click()
  await expect(page.getByText('81.3 kg')).toBeVisible()
})

test('settings names the trademark holders and says Gliplog is not affiliated', async ({
  page,
}) => {
  await page.goto('./#/settings')
  await acceptDisclaimer(page)
  await expect(
    page.getByText(/Ozempic, Wegovy and Rybelsus are trademarks of Novo Nordisk/),
  ).toBeVisible()
  await expect(
    page.getByText(/Mounjaro, Zepbound and\s+Foundayo are trademarks of Eli Lilly/),
  ).toBeVisible()
  await expect(
    page.getByText(/not\s+affiliated with, endorsed by or sponsored by Novo Nordisk, Eli Lilly/),
  ).toBeVisible()
})

test('works offline after the first visit, including stored data', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    'Playwright WebKit does not drive service workers reliably; offline is verified on Chromium',
  )
  await page.goto('./')
  await acceptDisclaimer(page)
  await waitForServiceWorker(page)
  await addMedication(page, 'Zepbound')
  await page.getByRole('button', { name: 'Log dose' }).click()
  await choose(page.getByRole('dialog', { name: 'Zepbound' }), 'Dose', '2.5 mg')
  await page.getByRole('dialog', { name: 'Zepbound' }).getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('2.5 mg logged')).toBeVisible()

  await context.setOffline(true)
  await page.goto('./#/history')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()
  await expect(page.getByText('Zepbound').first()).toBeVisible()

  // Progress holds the chart library; it must also come from the precache.
  await page.goto('./#/progress')
  await expect(page.getByRole('img', { name: /Estimated amount in the body now/ })).toBeVisible()
  await context.setOffline(false)
})

test('serves a manifest and service worker scoped to the app path', async ({
  page,
  request,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    'Playwright WebKit does not drive service workers reliably; offline is verified on Chromium',
  )
  await page.goto('./')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBe('/app/manifest.webmanifest')
  const manifest = await (await request.get(href!)).json()
  expect(manifest.id).toBe('/app/')
  expect(manifest.start_url).toBe('/app/')
  expect(manifest.scope).toBe('/app/')
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  expect(new URL(scope).pathname).toBe('/app/')
})

test('makes no third-party requests', async ({ page }) => {
  const foreign: string[] = []
  page.on('request', (r) => {
    const url = new URL(r.url())
    if (url.hostname !== 'localhost') foreign.push(r.url())
  })
  await page.goto('./')
  await acceptDisclaimer(page)
  for (const route of ['progress', 'history', 'settings']) await page.goto(`./#/${route}`)
  expect(foreign).toEqual([])
})

test('the disclaimer blocks scrolling the page behind it until accepted', async ({
  page,
  browserName,
  isMobile,
}) => {
  await page.goto('./#/settings')
  await expect(page.getByRole('button', { name: 'I understand' })).toBeVisible()
  await expect(page.locator('html')).toHaveCSS('overflow-y', 'hidden')
  // Playwright cannot wheel or swipe in mobile WebKit; there the root lock above is the check.
  if (!(browserName === 'webkit' && isMobile)) {
    await page.mouse.move(20, 400)
    await page.mouse.wheel(0, 600)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  }

  await acceptDisclaimer(page)
  await expect(page.locator('html')).not.toHaveCSS('overflow-y', 'hidden')
})

test.describe('install guide on iOS Chrome', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1',
  })

  test('shows the Chrome steps', async ({ page }) => {
    await page.goto('./')
    await acceptDisclaimer(page)
    await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
    await expect(page.getByText('Share button in the address bar')).toBeVisible()
  })
})

/**
 * Scroll the way a finger does, a frame at a time, rather than jumping straight to the end.
 * `scrollBy` rather than the mouse wheel, which Playwright cannot drive in mobile WebKit.
 */
async function scrollInSteps(page: Page, step: number, steps: number) {
  for (let i = 0; i < steps; i++) {
    const before = await page.evaluate(() => window.scrollY)
    await page.evaluate((dy) => window.scrollBy(0, dy), step)
    await page.waitForFunction(
      ([from, dy]) => Math.abs(window.scrollY - from) >= Math.abs(dy) - 1,
      [before, step] as const,
    )
    // Let the bar's per-frame scroll handler see each step, as it would during a real swipe.
    await page.evaluate(() => new Promise(requestAnimationFrame))
  }
}

test('the top bar scrolls away when reading and returns on scrolling up', async ({ page }) => {
  await page.goto('./#/settings')
  await acceptDisclaimer(page)
  const bar = page.locator('.v-app-bar')
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(bar).not.toHaveClass(/gl-app-bar--hidden/)
  await scrollInSteps(page, 150, 4)
  await expect(bar).toHaveClass(/gl-app-bar--hidden/)
  await scrollInSteps(page, -80, 1)
  await expect(bar).not.toHaveClass(/gl-app-bar--hidden/)

  // Hidden again, then a tap on plain page background brings it back.
  await page.evaluate(() => window.scrollTo(0, 0))
  await scrollInSteps(page, 150, 4)
  await expect(bar).toHaveClass(/gl-app-bar--hidden/)
  await page
    .locator('.gl-page')
    .first()
    .click({ position: { x: 4, y: 200 } })
  await expect(bar).not.toHaveClass(/gl-app-bar--hidden/)
})

/*
 * Chrome on Android sends no click for a tap that stops a fling, so this drives raw touches
 * through the DevTools protocol: a fast swipe, then a tap on a tab while the page still coasts.
 */
async function flingThenTapTab(page: Page, title: string) {
  const tab = await page.locator('.v-bottom-navigation .v-btn', { hasText: title }).boundingBox()
  if (!tab) throw new Error(`${title} tab has no box`)
  const cdp = await page.context().newCDPSession(page)
  const touch = (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    points: { x: number; y: number }[],
  ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points })
  await touch('touchStart', [{ x: 200, y: 600 }])
  for (let y = 560; y >= 200; y -= 40) await touch('touchMove', [{ x: 200, y }])
  await touch('touchEnd', [])
  const before = await page.evaluate(() => window.scrollY)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before)

  await touch('touchStart', [{ x: tab.x + tab.width / 2, y: tab.y + tab.height / 2 }])
  await touch('touchEnd', [])
  await cdp.detach()
}

test('a tab tapped while the page is still coasting from a fling opens', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'raw touch input needs the DevTools protocol')
  await page.goto('./#/settings')
  await acceptDisclaimer(page)
  const tab = (title: string) => page.locator('.v-bottom-navigation .v-btn', { hasText: title })
  test.skip((await tab('History').count()) === 0, 'phones only: wide layouts have a rail')

  await flingThenTapTab(page, 'History')
  await expect(page.getByRole('heading', { level: 1, name: 'History' })).toBeVisible()

  // Back on the first tab, the History tab no longer looks pressed (no ripple left behind).
  await tab('Today').tap()
  await expect(page.getByRole('heading', { level: 1, name: 'Your journal' })).toBeVisible()
  await expect(page.locator('.v-bottom-navigation .v-ripple__container')).toHaveCount(0)
  await expect(page.locator('.v-bottom-navigation .v-btn--active')).toHaveText('Today')
})

test('saves progress photos, compares them, and carries them through a zip backup', async ({
  page,
}) => {
  await page.addInitScript(() => {
    delete (navigator as { canShare?: unknown }).canShare
  })
  await page.goto('./')
  await acceptDisclaimer(page)
  await logWeight(page, '100')
  await page.getByRole('link', { name: 'Progress', exact: true }).first().click()

  // A real image, so the canvas re-encode and the blob: previews run as on a phone.
  const png = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 300
      canvas.height = 400
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#2d6567'
      ctx.fillRect(0, 0, 300, 400)
      return canvas.toDataURL('image/png').split(',')[1]!
    }),
    'base64',
  )
  const library = page.locator('input[type="file"][aria-label="Choose a photo"]')
  const dialog = page.getByRole('dialog', { name: 'Progress photo' })
  for (const name of ['one.png', 'two.png']) {
    await library.setInputFiles({ name, mimeType: 'image/png', buffer: png })
    const image = dialog.getByRole('img', { name: 'Your progress photo' })
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBe(300)
    await dialog.getByLabel('When').fill('2026-10-01T09:00')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Photo saved')).toBeVisible()
    await expect(dialog).toBeHidden()
  }
  await expect(page.getByRole('button', { name: /^Front photo from / })).toHaveCount(2)

  await page.getByRole('button', { name: 'Compare' }).click()
  const compare = page.getByRole('dialog', { name: 'Compare' })
  for (const img of await compare.getByRole('img', { name: /^Progress photo from / }).all()) {
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth))
      .toBe(300)
  }
  await compare.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save a backup' }).click()
  const backup = await download
  expect(backup.suggestedFilename()).toMatch(/^gliplog-backup-\d{4}-\d{2}-\d{2}\.zip$/)

  await page.getByRole('button', { name: 'Erase everything' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Erase everything' }).click()
  await expect(page.getByText('Everything erased')).toBeVisible()

  await page.getByLabel('Backup file').setInputFiles((await backup.path())!)
  await page.getByRole('dialog').getByRole('button', { name: 'Restore backup' }).click()
  await expect(page.getByText('Backup restored')).toBeVisible()
  await page.getByRole('link', { name: 'Progress', exact: true }).first().click()
  await expect(page.getByRole('button', { name: /^Front photo from / })).toHaveCount(2)
})

test('a reminder link opens Log dose for its medication, once', async ({ page }) => {
  await page.goto('./')
  await acceptDisclaimer(page)
  await addMedication(page, 'Wegovy')
  const id = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('gliplog')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const read = open.result.transaction('medications').objectStore('medications').getAll()
          read.onsuccess = () => resolve((read.result as { id: string }[])[0]!.id)
        }
      }),
  )

  // The native app routes a tapped notification here; the web route is the same.
  await page.goto(`./#/?log=${id}`)
  await expect(page.getByRole('dialog', { name: 'Wegovy' })).toBeVisible()
  await expect(page).not.toHaveURL(/log=/)
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.getByRole('dialog', { name: 'Wegovy' })).toBeHidden()

  await page.goto('./#/?log=not-a-medication')
  await expect(page).not.toHaveURL(/log=/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('adds the dose schedule to a calendar as a file or a link', async ({ page }) => {
  await page.addInitScript(() => {
    delete (navigator as { canShare?: unknown }).canShare
  })
  await page.goto('./')
  await acceptDisclaimer(page)
  await addMedication(page, 'Wegovy')
  await page.getByRole('button', { name: 'Log dose' }).click()
  const dose = page.getByRole('dialog', { name: 'Wegovy' })
  await choose(dose, 'Dose', '0.25 mg')
  await dose.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('0.25 mg logged')).toBeVisible()

  await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
  await page.getByRole('button', { name: 'Add reminder for Wegovy' }).click()
  const dialog = page.getByRole('dialog')
  await expect(page.getByRole('dialog', { name: 'Add reminder' })).toBeVisible()
  await dialog.getByRole('button', { name: /^Add calendar invite/ }).click()
  await expect(page.getByRole('dialog', { name: 'Calendar invite' })).toBeVisible()
  await dialog.getByLabel('Time of day').fill('08:30')
  await expect(dialog.getByText(/repeats every week\.$/)).toBeVisible()

  // Links are only checked, never followed: the test must make no third-party request.
  const google = new URL(
    (await dialog.getByRole('link', { name: 'Google Calendar' }).getAttribute('href'))!,
  )
  expect(google.host).toBe('calendar.google.com')
  expect(google.searchParams.get('text')).toBe('Dose due')
  expect(google.searchParams.get('recur')).toBe('RRULE:FREQ=WEEKLY;INTERVAL=1')
  expect(google.searchParams.get('dates')).toMatch(/^\d{8}T083000\/\d{8}T084500$/)
  const outlook = await dialog.getByRole('link', { name: 'Outlook.com' }).getAttribute('href')
  expect(outlook).toMatch(/^https:\/\/outlook\.live\.com\/calendar\/0\/deeplink\/compose\?/)

  await dialog.getByLabel('Show the medication name').check()
  const download = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download calendar invite' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^gliplog-dose-\d{4}-\d{2}-\d{2}\.ics$/)
  const ics = await (await import('node:fs/promises')).readFile((await file.path())!, 'utf8')
  expect(ics).toContain('SUMMARY:Wegovy dose due\r\n')
  expect(ics).toMatch(/\r\nDTSTART:\d{8}T083000\r\n/)
  expect(ics).toContain('RRULE:FREQ=WEEKLY;INTERVAL=1')
})

/** A real PNG drawn in the page, so photo processing runs as it does on a phone. */
async function makePng(page: Page): Promise<Buffer> {
  return Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 300
      canvas.height = 400
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#2d6567'
      ctx.fillRect(0, 0, 300, 400)
      return canvas.toDataURL('image/png').split(',')[1]!
    }),
    'base64',
  )
}

/** Saves a photo from the library on Progress, keeping the time the dialog suggests. */
async function addPhoto(page: Page, png: Buffer, name: string) {
  await page
    .locator('input[type="file"][aria-label="Choose a photo"]')
    .setInputFiles({ name, mimeType: 'image/png', buffer: png })
  const dialog = page.getByRole('dialog', { name: 'Progress photo' })
  await expect(dialog.getByRole('img', { name: 'Your progress photo' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
}

async function expectDecoded(img: Locator) {
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth))
    .toBeGreaterThan(0)
}

test('the bell on a medication card opens Add reminder', async ({ page }) => {
  await page.goto('./')
  await acceptDisclaimer(page)
  await addMedication(page, 'Wegovy')
  await page.getByRole('button', { name: 'Add reminder for Wegovy' }).click()
  const dialog = page.getByRole('dialog')
  await expect(page.getByRole('dialog', { name: 'Add reminder' })).toBeVisible()
  // The web app cannot notify on its own, and says so instead of hiding the choice.
  await expect(dialog.getByRole('button', { name: /^Notify me/ })).toBeDisabled()
  await expect(dialog.getByText('Needs the Gliplog app for Android')).toBeVisible()
  await dialog.getByRole('button', { name: /^Add calendar invite/ }).click()
  await expect(dialog.getByText('Log a first dose of this medication')).toBeVisible()
  await dialog.getByRole('button', { name: 'Back to reminder options' }).click()
  await expect(page.getByRole('dialog', { name: 'Add reminder' })).toBeVisible()
})

test('pins photos to the weight line and shares a collage', async ({ page }) => {
  await page.addInitScript(() => {
    delete (navigator as { canShare?: unknown }).canShare
  })
  await page.goto('./')
  await acceptDisclaimer(page)
  await logWeight(page, '100')
  await page.getByRole('link', { name: 'Progress', exact: true }).first().click()
  const png = await makePng(page)
  for (const name of ['one.png', 'two.png', 'three.png']) await addPhoto(page, png, name)

  await expect(
    page.getByRole('img', { name: /3 progress photos pinned to the line/ }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Photos', exact: true }).click()
  await expect(page.getByRole('img', { name: /progress photos? pinned/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Photos', exact: true }).click()

  await page.getByRole('button', { name: 'Share weight as an image' }).click()
  const share = page.getByRole('dialog', { name: 'Share as an image' })
  await share.getByLabel('Include my photos').check()
  await expect(share.getByText('Anyone you send the image to will see them.')).toBeVisible()
  await expectDecoded(share.getByRole('img', { name: 'Preview of the image to share' }))
  await share.getByRole('button', { name: 'Cancel' }).click()

  await page.getByRole('button', { name: 'Share collage' }).click()
  const collage = page.getByRole('dialog', { name: 'Share a collage' })
  const preview = collage.getByRole('img', { name: 'Preview of the image to share' })
  await expectDecoded(preview)
  await choose(collage, 'Photos', '3')
  await choose(collage, 'Shape', 'Story')
  await expect
    .poll(() =>
      preview.evaluate((el: HTMLImageElement) => [el.naturalWidth, el.naturalHeight].join('x')),
    )
    .toBe('1080x1920')
  const download = page.waitForEvent('download')
  await collage.getByRole('button', { name: 'Share' }).click()
  expect((await download).suggestedFilename()).toMatch(/^gliplog-photos-\d{4}-\d{2}-\d{2}\.png$/)
})

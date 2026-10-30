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
  await expect(page.getByText('SURMOUNT-1 · 72 weeks')).toBeVisible()
  await choose(page, 'Medication', 'Wegovy')
  await expect(page.getByText('STEP 1 · 68 weeks')).toBeVisible()
  await expect(page.getByText('Log a dose of Wegovy to compare').first()).toBeVisible()
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
  await expect(dose.getByText('10 units', { exact: true })).toBeVisible()
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

test('settings names the trademark holders and says Tidebook is not affiliated', async ({
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
  await expect(bar).not.toHaveClass(/tb-app-bar--hidden/)
  await scrollInSteps(page, 150, 4)
  await expect(bar).toHaveClass(/tb-app-bar--hidden/)
  await scrollInSteps(page, -80, 1)
  await expect(bar).not.toHaveClass(/tb-app-bar--hidden/)

  // Hidden again, then a tap on plain page background brings it back.
  await page.evaluate(() => window.scrollTo(0, 0))
  await scrollInSteps(page, 150, 4)
  await expect(bar).toHaveClass(/tb-app-bar--hidden/)
  await page
    .locator('.tb-page')
    .first()
    .click({ position: { x: 4, y: 200 } })
  await expect(bar).not.toHaveClass(/tb-app-bar--hidden/)
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

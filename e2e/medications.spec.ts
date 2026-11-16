import { expect, test } from '@playwright/test'
import { acceptDisclaimer, choose } from './helpers'

test('manages a medication on its own page and keeps the level chart off Progress', async ({
  page,
}) => {
  await page.goto('./')
  await acceptDisclaimer(page)

  await page.getByRole('link', { name: 'Medications', exact: true }).first().click()
  await expect(page.getByText('Add what you take.')).toBeVisible()

  await page.getByRole('button', { name: 'Add medication' }).click()
  const dialog = page.getByRole('dialog', { name: 'Medication' })
  const field = dialog.getByRole('combobox', { name: 'Medication' })
  await field.click()
  await field.fill('Wegovy')
  await page.getByRole('option', { name: /^Wegovy [a-z]+ ·/ }).click()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Medication added')).toBeVisible()

  await page.getByRole('link', { name: /^Wegovy/ }).click()
  await expect(page.getByRole('heading', { name: 'Wegovy' })).toBeVisible()
  await expect(page.getByText('No dose logged yet')).toBeVisible()

  await page.getByRole('button', { name: 'Log dose' }).click()
  const dose = page.getByRole('dialog', { name: 'Wegovy' })
  await choose(dose, 'Dose', '0.25 mg')
  await dose.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('0.25 mg logged')).toBeVisible()

  await expect(page.getByText('Due in 7 days')).toBeVisible()
  await expect(page.getByRole('img', { name: /^Estimated amount in the body now:/ })).toHaveCount(1)
  await expect(page.getByText('0.25 mg Wegovy')).toBeVisible()

  // Progress no longer renders an Estimated levels chart.
  await page.getByRole('link', { name: 'Progress', exact: true }).first().click()
  await expect(page.getByRole('img', { name: /^Estimated amount in the body now:/ })).toHaveCount(0)

  // Stop moves the medicine from In use to Past.
  await page.getByRole('link', { name: 'Medications', exact: true }).first().click()
  await page.getByRole('link', { name: /^Wegovy/ }).click()
  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(page.getByText('Moved to past medications')).toBeVisible()

  await page.getByRole('link', { name: 'Medications', exact: true }).first().click()
  await expect(page.getByText('Past', { exact: true })).toBeVisible()
  await expect(page.getByText('Stopped')).toBeVisible()
})

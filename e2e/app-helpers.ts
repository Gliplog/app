import { expect, type Page } from '@playwright/test'
import { choose } from './helpers'

export const DISCLAIMER_TITLE = 'A private journal, not medical advice'
export const UNITS_CARD_TITLE = 'Units and appearance'
export const TIMELINE_HASH = 'history'

export const DOSE_KIND = {
  row: 'Dose',
  plural: 'Doses',
  expectedTitle: '2.5 mg Zepbound',
  updatedTitle: '5 mg Zepbound',
} as const

/** Opens the screen whose empty state shows the active body-unit summary. */
export async function openUnitsScreen(_page: Page) {}

/** Ensures a medication exists so Log -> Dose can be logged from the first screen. */
export async function prepareDoseTarget(page: Page) {
  await page.getByRole('button', { name: 'Add medication' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Medication' })
  const field = dialog.getByRole('combobox', { name: 'Medication' })
  await field.click()
  await field.fill('Zepbound')
  await page.getByRole('option', { name: /^Zepbound/ }).click()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Medication added')).toBeVisible()
}

export async function fillNewDose(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Zepbound' })
  await choose(dialog, 'Dose', '2.5 mg')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('2.5 mg logged')).toBeVisible()
}

export async function editDoseEntry(page: Page) {
  await page.getByRole('button', { name: /2\.5 mg Zepbound/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Zepbound' })
  await choose(dialog, 'Dose', '5 mg')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Dose updated')).toBeVisible()
}

export async function deleteDoseEntry(page: Page) {
  await page.getByRole('button', { name: /5 mg Zepbound/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Zepbound' })
  await dialog.getByRole('button', { name: 'Delete dose' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('Dose deleted')).toBeVisible()
}

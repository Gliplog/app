import { expect, type Page } from '@playwright/test'
import { choose } from './helpers'

export const DISCLAIMER_TITLE = 'A private journal, not medical advice'
export const UNITS_CARD_TITLE = 'Units and appearance'
export const TIMELINE_HASH = 'progress/entries'
export const LEGACY_PROGRESS_ROUTE = { hash: 'history', heading: 'All entries' } as const
export const EXPORT_DIALOG = {
  title: 'Export PDF',
  submit: 'Export',
  filePrefix: 'gliplog-report-',
} as const
export const EMPTY_TODAY_TITLE = 'Start with what you take'
export const TODAY_LOG_BUTTON = 'Log dose'
export const TILE_TARGET = { heading: 'Progress', url: /#\/progress/ } as const

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

/** Seeds a scheduled medicine on Today with no logged doses yet. */
export async function prepareTodaySchedule(page: Page) {
  await page.getByRole('button', { name: 'Add medication' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Medication' })
  const field = dialog.getByRole('combobox', { name: 'Medication' })
  await field.click()
  await field.fill('Wegovy')
  await page.getByRole('option', { name: /^Wegovy [a-z]+ ·/ }).click()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Medication added')).toBeVisible()
}

/** Saves a first or repeated dose from the dialog opened by Today's due card. */
export async function saveDueCardDose(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Wegovy' })
  await choose(dialog, 'Dose', '0.25 mg')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('0.25 mg logged')).toBeVisible()
}

/** Saves the repeated dose without changing the pre-filled amount. */
export async function saveRepeatedDueDose(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Wegovy' })
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('0.25 mg logged')).toBeVisible()
}

/** Verifies scheduled future days on the calendar (Zepbound is weekly from the Nov 16 dose). */
export async function verifyScheduledCalendar(page: Page) {
  await page.goto(`./#/${TIMELINE_HASH}?view=calendar`)
  const nextDueCell = page.locator('[data-v-date="2026-11-23"]')
  await expect(nextDueCell.locator('.cal-mark--scheduled')).toBeVisible()
  await nextDueCell.click()
  await expect(page.locator('.day-panel')).toContainText('Scheduled: Zepbound')
}

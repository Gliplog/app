import type { Page } from '@playwright/test'

export const DISCLAIMER_TITLE = 'A private journal, not medical advice'
export const UNITS_CARD_TITLE = 'Units and appearance'

/** Opens the screen whose empty state shows the active body-unit summary. */
export async function openUnitsScreen(_page: Page) {}

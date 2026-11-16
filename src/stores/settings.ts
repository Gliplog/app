import { defineStore } from 'pinia'
import { ref } from 'vue'
import { repository } from '@/db'
import { type A1cUnit, type GlucoseUnit } from '@/domain/glucose'
import { sanitizeDismissed } from '@/domain/overlap'
import { type HeightUnit, type WeightUnit } from '@/domain/bodyUnits'
import {
  hasMissingUnit,
  LEGACY_UNITS,
  resolveUnits,
  unitDefaultsFor,
  type RegionalPreferences,
  type UnitDefaults,
} from '@/domain/unitDefaults'
import { regionalPreferences } from '@/services/locale'
import {
  DEFAULT_REMINDER,
  sanitizeReminderSettings,
  type Reminder,
  type ReminderSettings,
} from '@/domain/reminders'

export type ThemePreference = 'system' | 'light' | 'dark'

/** Everything about the person. Every field is optional; nothing here is required to use the app. */
export interface Profile {
  heightCm: number | null
  goalKg: number | null
}

const EMPTY_PROFILE: Profile = {
  heightCm: null,
  goalKg: null,
}

/** Keys in the settings table. Renaming one orphans users' saved values: add, never rename. */
const SETTING_KEYS = {
  theme: 'theme',
  weightUnit: 'weightUnit',
  heightUnit: 'heightUnit',
  glucoseUnit: 'glucoseUnit',
  a1cUnit: 'a1cUnit',
  profile: 'profile',
  lastBackupAt: 'lastBackupAt',
  disclaimerAcceptedAt: 'disclaimerAcceptedAt',
  installHintDismissed: 'installHintDismissed',
  reminders: 'reminders',
  dismissedOverlaps: 'dismissedOverlaps',
} as const

const positiveOrNull = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null

/** A stored or restored profile is untrusted input; keep only fields that are valid. */
export function sanitizeProfile(value: unknown): Profile {
  if (typeof value !== 'object' || value === null) return { ...EMPTY_PROFILE }
  const v = value as Record<string, unknown>
  return {
    heightCm: positiveOrNull(v.heightCm),
    goalKg: positiveOrNull(v.goalKg),
  }
}

const hasUnkeptFields = (stored: unknown, clean: Profile) =>
  typeof stored === 'object' && stored !== null && Object.keys(stored).some((k) => !(k in clean))

/** Display preferences and the user's profile, loaded once and written through on change. */
export const useSettingsStore = defineStore('settings', () => {
  const loaded = ref(false)
  const theme = ref<ThemePreference>('system')
  const weightUnit = ref<WeightUnit>(LEGACY_UNITS.weightUnit)
  const heightUnit = ref<HeightUnit>(LEGACY_UNITS.heightUnit)
  const glucoseUnit = ref<GlucoseUnit>(LEGACY_UNITS.glucoseUnit)
  const a1cUnit = ref<A1cUnit>(LEGACY_UNITS.a1cUnit)
  const profile = ref<Profile>({ ...EMPTY_PROFILE })
  const lastBackupAt = ref<string | null>(null)
  const disclaimerAcceptedAt = ref<string | null>(null)
  const installHintDismissed = ref(false)
  const reminders = ref<ReminderSettings>(sanitizeReminderSettings(null))
  /** Combinations of medicines whose "both in use" notice the user dismissed (see overlap.ts). */
  const dismissedOverlaps = ref<string[]>([])

  async function load() {
    const [
      themePref,
      wUnit,
      hUnit,
      gUnit,
      aUnit,
      stored,
      backup,
      disclaimer,
      hint,
      remind,
      overlaps,
    ] = await Promise.all([
      repository.getSetting<ThemePreference>(SETTING_KEYS.theme),
      repository.getSetting<WeightUnit>(SETTING_KEYS.weightUnit),
      repository.getSetting<HeightUnit>(SETTING_KEYS.heightUnit),
      repository.getSetting<GlucoseUnit>(SETTING_KEYS.glucoseUnit),
      repository.getSetting<A1cUnit>(SETTING_KEYS.a1cUnit),
      repository.getSetting<unknown>(SETTING_KEYS.profile),
      repository.getSetting<string>(SETTING_KEYS.lastBackupAt),
      repository.getSetting<string>(SETTING_KEYS.disclaimerAcceptedAt),
      repository.getSetting<boolean>(SETTING_KEYS.installHintDismissed),
      repository.getSetting<unknown>(SETTING_KEYS.reminders),
      repository.getSetting<unknown>(SETTING_KEYS.dismissedOverlaps),
    ])
    const storedUnits = {
      weightUnit: wUnit,
      heightUnit: hUnit,
      glucoseUnit: gUnit,
      a1cUnit: aUnit,
    }
    const existingInstall = disclaimer !== undefined && disclaimer !== null
    let prefs: RegionalPreferences | null = null
    if (!existingInstall && hasMissingUnit(storedUnits)) {
      try {
        prefs = await regionalPreferences()
      } catch {
        prefs = { region: null, measurementSystem: null }
      }
    }
    const { units, toStore } = resolveUnits(storedUnits, existingInstall, () =>
      unitDefaultsFor(prefs ?? { region: null, measurementSystem: null }),
    )
    theme.value = themePref === 'light' || themePref === 'dark' ? themePref : 'system'
    weightUnit.value = units.weightUnit
    heightUnit.value = units.heightUnit
    glucoseUnit.value = units.glucoseUnit
    a1cUnit.value = units.a1cUnit
    profile.value = sanitizeProfile(stored)
    lastBackupAt.value = backup ?? null
    disclaimerAcceptedAt.value = disclaimer ?? null
    installHintDismissed.value = hint ?? false
    reminders.value = sanitizeReminderSettings(remind)
    dismissedOverlaps.value = sanitizeDismissed(overlaps)
    await Promise.all(
      (Object.keys(toStore) as (keyof UnitDefaults)[]).map((key) => {
        const value = toStore[key]
        return value !== undefined
          ? repository.setSetting(SETTING_KEYS[key], value).catch(() => {})
          : Promise.resolve()
      }),
    )
    loaded.value = true
    // A stored profile can hold fields the app no longer collects (such as gender). Writing the
    // clean copy back removes them from the database, and so from every later backup. It runs
    // after loading so a failed write (storage full) never holds up the app; the next load
    // tries again.
    if (hasUnkeptFields(stored, profile.value)) {
      repository.setSetting(SETTING_KEYS.profile, { ...profile.value }).catch(() => {})
    }
  }

  async function setTheme(value: ThemePreference) {
    theme.value = value
    await repository.setSetting(SETTING_KEYS.theme, value)
  }

  async function setWeightUnit(value: WeightUnit) {
    weightUnit.value = value
    await repository.setSetting(SETTING_KEYS.weightUnit, value)
  }

  async function setHeightUnit(value: HeightUnit) {
    heightUnit.value = value
    await repository.setSetting(SETTING_KEYS.heightUnit, value)
  }

  async function setGlucoseUnit(value: GlucoseUnit) {
    glucoseUnit.value = value
    await repository.setSetting(SETTING_KEYS.glucoseUnit, value)
  }

  async function setA1cUnit(value: A1cUnit) {
    a1cUnit.value = value
    await repository.setSetting(SETTING_KEYS.a1cUnit, value)
  }

  /** Merges `changes` into the profile; invalid values are dropped, never stored. */
  async function updateProfile(changes: Partial<Profile>) {
    const next = sanitizeProfile({ ...profile.value, ...changes })
    profile.value = next
    await repository.setSetting(SETTING_KEYS.profile, { ...next })
  }

  async function markBackedUp(at: string) {
    lastBackupAt.value = at
    await repository.setSetting(SETTING_KEYS.lastBackupAt, at)
  }

  /**
   * Record the acknowledgement on disk first, then close the dialog: closing optimistically let a
   * reload in that window bring the dialog back. Rejects, leaving it open, if the write fails.
   */
  async function acceptDisclaimer(at: string) {
    await repository.setSetting(SETTING_KEYS.disclaimerAcceptedAt, at)
    disclaimerAcceptedAt.value = at
  }

  async function dismissInstallHint() {
    installHintDismissed.value = true
    await repository.setSetting(SETTING_KEYS.installHintDismissed, true)
  }

  /** Hide the "both in use" notice for this combination of medicines until it changes. */
  async function dismissOverlap(key: string) {
    if (dismissedOverlaps.value.includes(key)) return
    const next = sanitizeDismissed([...dismissedOverlaps.value, key])
    // Saved before the notice hides, so closing the app right after cannot bring it back.
    await repository.setSetting(SETTING_KEYS.dismissedOverlaps, [...next])
    dismissedOverlaps.value = next
  }

  /** One subject's reminder choices, or the defaults (off, 9:00) if never set. */
  function reminderFor(subjectId: string): Reminder {
    return reminders.value.subjects[subjectId] ?? { ...DEFAULT_REMINDER }
  }

  async function saveReminders(next: ReminderSettings) {
    // Sanitising also copies out of the reactive proxy, which IndexedDB cannot clone.
    const clean = sanitizeReminderSettings(next)
    reminders.value = clean
    await repository.setSetting(SETTING_KEYS.reminders, clean)
  }

  async function setReminder(subjectId: string, changes: Partial<Reminder>) {
    const current = reminders.value
    await saveReminders({
      ...current,
      subjects: {
        ...current.subjects,
        [subjectId]: { ...reminderFor(subjectId), ...changes },
      },
    })
  }

  async function setReminderNames(showNames: boolean) {
    await saveReminders({ ...reminders.value, showNames })
  }

  return {
    loaded,
    theme,
    weightUnit,
    heightUnit,
    glucoseUnit,
    a1cUnit,
    profile,
    lastBackupAt,
    disclaimerAcceptedAt,
    installHintDismissed,
    reminders,
    dismissedOverlaps,
    load,
    setTheme,
    setWeightUnit,
    setHeightUnit,
    setGlucoseUnit,
    setA1cUnit,
    updateProfile,
    markBackedUp,
    acceptDisclaimer,
    dismissInstallHint,
    dismissOverlap,
    reminderFor,
    setReminder,
    setReminderNames,
  }
})

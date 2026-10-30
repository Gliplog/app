import { defineStore } from 'pinia'
import { ref } from 'vue'
import { repository } from '@/db'
import { isBirthMonth, type BirthMonth } from '@/domain/body'
import { A1C_UNITS, GLUCOSE_UNITS, type A1cUnit, type GlucoseUnit } from '@/domain/glucose'
import { HEIGHT_UNITS, WEIGHT_UNITS, type HeightUnit, type WeightUnit } from '@/domain/units'

export type ThemePreference = 'system' | 'light' | 'dark'

export const GENDERS = ['woman', 'man', 'nonbinary', 'self', 'unspecified'] as const
export type Gender = (typeof GENDERS)[number]

export const GENDER_LABELS: Record<Gender, string> = {
  woman: 'Woman',
  man: 'Man',
  nonbinary: 'Non-binary',
  self: 'I’ll describe it',
  unspecified: 'Prefer not to say',
}

/** Everything about the person. Every field is optional; nothing here is required to use the app. */
export interface Profile {
  heightCm: number | null
  birthMonth: BirthMonth | null
  gender: Gender
  /** The user's own words when `gender` is `self`. */
  genderText: string
  goalKg: number | null
}

const EMPTY_PROFILE: Profile = {
  heightCm: null,
  birthMonth: null,
  gender: 'unspecified',
  genderText: '',
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
} as const

const positiveOrNull = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null

/** A stored or restored profile is untrusted input; keep only fields that are valid. */
export function sanitizeProfile(value: unknown): Profile {
  if (typeof value !== 'object' || value === null) return { ...EMPTY_PROFILE }
  const v = value as Record<string, unknown>
  return {
    heightCm: positiveOrNull(v.heightCm),
    birthMonth: isBirthMonth(v.birthMonth) ? v.birthMonth : null,
    gender: GENDERS.includes(v.gender as Gender) ? (v.gender as Gender) : 'unspecified',
    genderText: typeof v.genderText === 'string' ? v.genderText.slice(0, 60) : '',
    goalKg: positiveOrNull(v.goalKg),
  }
}

/** Display preferences and the user's profile, loaded once and written through on change. */
export const useSettingsStore = defineStore('settings', () => {
  const loaded = ref(false)
  const theme = ref<ThemePreference>('system')
  const weightUnit = ref<WeightUnit>('kg')
  const heightUnit = ref<HeightUnit>('cm')
  const glucoseUnit = ref<GlucoseUnit>('mg/dL')
  const a1cUnit = ref<A1cUnit>('%')
  const profile = ref<Profile>({ ...EMPTY_PROFILE })
  const lastBackupAt = ref<string | null>(null)
  const disclaimerAcceptedAt = ref<string | null>(null)
  const installHintDismissed = ref(false)

  async function load() {
    const [themePref, wUnit, hUnit, gUnit, aUnit, stored, backup, disclaimer, hint] =
      await Promise.all([
        repository.getSetting<ThemePreference>(SETTING_KEYS.theme),
        repository.getSetting<WeightUnit>(SETTING_KEYS.weightUnit),
        repository.getSetting<HeightUnit>(SETTING_KEYS.heightUnit),
        repository.getSetting<GlucoseUnit>(SETTING_KEYS.glucoseUnit),
        repository.getSetting<A1cUnit>(SETTING_KEYS.a1cUnit),
        repository.getSetting<unknown>(SETTING_KEYS.profile),
        repository.getSetting<string>(SETTING_KEYS.lastBackupAt),
        repository.getSetting<string>(SETTING_KEYS.disclaimerAcceptedAt),
        repository.getSetting<boolean>(SETTING_KEYS.installHintDismissed),
      ])
    theme.value = themePref === 'light' || themePref === 'dark' ? themePref : 'system'
    weightUnit.value = wUnit && WEIGHT_UNITS.includes(wUnit) ? wUnit : 'kg'
    heightUnit.value = hUnit && HEIGHT_UNITS.includes(hUnit) ? hUnit : 'cm'
    glucoseUnit.value = gUnit && GLUCOSE_UNITS.includes(gUnit) ? gUnit : 'mg/dL'
    a1cUnit.value = aUnit && A1C_UNITS.includes(aUnit) ? aUnit : '%'
    profile.value = sanitizeProfile(stored)
    lastBackupAt.value = backup ?? null
    disclaimerAcceptedAt.value = disclaimer ?? null
    installHintDismissed.value = hint ?? false
    loaded.value = true
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
  }
})

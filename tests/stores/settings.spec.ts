import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { db, repository } from '@/db'
import { LEGACY_UNITS } from '@/domain/unitDefaults'
import { sanitizeProfile, useSettingsStore } from '@/stores/settings'

const mockRegionalPreferences = vi.fn()

vi.mock('@/services/locale', () => ({
  regionalPreferences: () => mockRegionalPreferences(),
}))

describe('settings.acceptDisclaimer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('marks the notice accepted only after the acceptance is saved', async () => {
    let finishWrite = () => {}
    vi.spyOn(repository, 'setSetting').mockReturnValue(
      new Promise<void>((resolve) => (finishWrite = resolve)),
    )
    const settings = useSettingsStore()
    const pending = settings.acceptDisclaimer('2026-10-29T12:00:00.000Z')
    expect(settings.disclaimerAcceptedAt).toBeNull()
    finishWrite()
    await pending
    expect(settings.disclaimerAcceptedAt).toBe('2026-10-29T12:00:00.000Z')
  })

  it('keeps the notice open when the save fails', async () => {
    vi.spyOn(repository, 'setSetting').mockRejectedValue(new Error('QuotaExceededError'))
    const settings = useSettingsStore()
    await expect(settings.acceptDisclaimer('2026-10-29T12:00:00.000Z')).rejects.toThrow()
    expect(settings.disclaimerAcceptedAt).toBeNull()
  })
})

describe('sanitizeProfile', () => {
  it('keeps valid fields and drops the rest, so a restored backup cannot break the app', () => {
    expect(
      sanitizeProfile({
        heightCm: -5,
        birthMonth: '1980-04',
        gender: 'robot',
        genderText: 42,
        goalKg: 70,
      }),
    ).toEqual({
      heightCm: null,
      goalKg: 70,
    })
    expect(sanitizeProfile(null)).toEqual({ heightCm: null, goalKg: null })
  })

  it('accepts every field filled in', () => {
    const p = {
      heightCm: 168,
      goalKg: 65,
    }
    expect(sanitizeProfile(p)).toEqual(p)
  })
})

describe('settings.load', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    await Promise.all(db.tables.map((t) => t.clear()))
    mockRegionalPreferences.mockReset()
    mockRegionalPreferences.mockResolvedValue({ region: null, measurementSystem: null })
  })

  it('rewrites a stored profile without fields the app no longer keeps, so backups drop them', async () => {
    vi.spyOn(repository, 'getSetting').mockImplementation(async (key: string) =>
      key === 'profile'
        ? ({ heightCm: 170, gender: 'woman', genderText: '', goalKg: null } as never)
        : undefined,
    )
    const write = vi.spyOn(repository, 'setSetting').mockResolvedValue()
    await useSettingsStore().load()
    expect(write).toHaveBeenCalledWith('profile', { heightCm: 170, goalKg: null })
  })

  it('leaves a clean profile alone', async () => {
    vi.spyOn(repository, 'getSetting').mockImplementation(async (key: string) => {
      if (key === 'profile') return { heightCm: 170, goalKg: null } as never
      if (key === 'disclaimerAcceptedAt') return '2026-10-01T00:00:00.000Z' as never
      if (key in LEGACY_UNITS) return LEGACY_UNITS[key as keyof typeof LEGACY_UNITS] as never
      return undefined
    })
    const write = vi.spyOn(repository, 'setSetting').mockResolvedValue()
    await useSettingsStore().load()
    expect(write).not.toHaveBeenCalled()
  })

  it('finishes loading when the cleanup write fails', async () => {
    vi.spyOn(repository, 'getSetting').mockImplementation(async (key: string) =>
      key === 'profile' ? ({ heightCm: 170, gender: 'man', goalKg: null } as never) : undefined,
    )
    vi.spyOn(repository, 'setSetting').mockRejectedValue(new Error('QuotaExceededError'))
    const settings = useSettingsStore()
    await settings.load()
    expect(settings.loaded).toBe(true)
    expect(settings.profile).toEqual({ heightCm: 170, goalKg: null })
  })

  it('detects and stores regional units on a new install', async () => {
    mockRegionalPreferences.mockResolvedValue({ region: 'US', measurementSystem: null })
    const settings = useSettingsStore()
    await settings.load()

    expect(settings.weightUnit).toBe('lb')
    expect(settings.heightUnit).toBe('ftin')
    expect(settings.glucoseUnit).toBe('mg/dL')
    expect(settings.a1cUnit).toBe('%')
    expect(await repository.getSetting('weightUnit')).toBe('lb')
    expect(await repository.getSetting('heightUnit')).toBe('ftin')
    expect(await repository.getSetting('glucoseUnit')).toBe('mg/dL')
    expect(await repository.getSetting('a1cUnit')).toBe('%')
  })

  it('keeps legacy units on an existing install without consulting regionalPreferences', async () => {
    await repository.setSetting('disclaimerAcceptedAt', '2026-10-01T00:00:00.000Z')
    const settings = useSettingsStore()
    await settings.load()

    expect(mockRegionalPreferences).not.toHaveBeenCalled()
    expect(settings.weightUnit).toBe('kg')
    expect(settings.heightUnit).toBe('cm')
    expect(settings.glucoseUnit).toBe('mg/dL')
    expect(settings.a1cUnit).toBe('%')
    expect(await repository.getSetting('weightUnit')).toBe('kg')
    expect(await repository.getSetting('heightUnit')).toBe('cm')
    expect(await repository.getSetting('glucoseUnit')).toBe('mg/dL')
    expect(await repository.getSetting('a1cUnit')).toBe('%')
  })

  it('preserves a stored unit when regionalPreferences points elsewhere', async () => {
    await repository.setSetting('weightUnit', 'lb')
    mockRegionalPreferences.mockResolvedValue({ region: 'DE', measurementSystem: null })
    const settings = useSettingsStore()
    await settings.load()

    expect(settings.weightUnit).toBe('lb')
    expect(settings.heightUnit).toBe('cm')
  })

  it('falls back to legacy units when regionalPreferences rejects', async () => {
    mockRegionalPreferences.mockRejectedValue(new Error('bridge failed'))
    const settings = useSettingsStore()
    await settings.load()

    expect(settings.loaded).toBe(true)
    expect(settings.weightUnit).toBe(LEGACY_UNITS.weightUnit)
    expect(settings.heightUnit).toBe(LEGACY_UNITS.heightUnit)
    expect(settings.glucoseUnit).toBe(LEGACY_UNITS.glucoseUnit)
    expect(settings.a1cUnit).toBe(LEGACY_UNITS.a1cUnit)
  })

  it('still loads when saving detected units rejects', async () => {
    mockRegionalPreferences.mockResolvedValue({ region: 'US', measurementSystem: null })
    vi.spyOn(repository, 'setSetting').mockRejectedValue(new Error('QuotaExceededError'))
    const settings = useSettingsStore()
    await settings.load()

    expect(settings.loaded).toBe(true)
    expect(settings.weightUnit).toBe('lb')
    expect(settings.heightUnit).toBe('ftin')
  })
})

describe('settings.realisticSyringe', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    await Promise.all(db.tables.map((t) => t.clear()))
    mockRegionalPreferences.mockReset()
    mockRegionalPreferences.mockResolvedValue({ region: null, measurementSystem: null })
  })

  it('shows the needle and plunger by default on the web', async () => {
    const settings = useSettingsStore()
    await settings.load()
    expect(settings.realisticSyringe).toBe(true)
  })

  it('persists the choice across a reload', async () => {
    const settings = useSettingsStore()
    await settings.load()
    await settings.setRealisticSyringe(false)

    setActivePinia(createPinia())
    const reloaded = useSettingsStore()
    await reloaded.load()
    expect(reloaded.realisticSyringe).toBe(false)
  })

  it('ignores a restored value that is not a boolean', async () => {
    await repository.setSetting('realisticSyringe', 'yes')
    const settings = useSettingsStore()
    await settings.load()
    expect(settings.realisticSyringe).toBe(true)
  })
})

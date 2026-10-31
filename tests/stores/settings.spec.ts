import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { repository } from '@/db'
import { sanitizeProfile, useSettingsStore } from '@/stores/settings'

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
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
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
    vi.spyOn(repository, 'getSetting').mockImplementation(async (key: string) =>
      key === 'profile' ? ({ heightCm: 170, goalKg: null } as never) : undefined,
    )
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
})

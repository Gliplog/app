import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { MedicationRow } from '@/db/database'
import { db } from '@/db'
import { useSettingsStore } from '@/stores/settings'
import { mountWithVuetify } from '../../helpers'

const access = vi.hoisted(() => ({
  check: vi.fn(),
  request: vi.fn(),
  openSettings: vi.fn(),
}))
vi.mock('@/services/reminders/notificationAccess', () => ({
  checkNotificationAccess: access.check,
  requestNotificationAccess: access.request,
  openNotificationSettings: access.openSettings,
}))

const { default: NotifyMePanel } = await import('@/components/reminders/NotifyMePanel.vue')

const med: MedicationRow = {
  id: 'med-1',
  productId: 'wegovy',
  name: 'Wegovy',
  intervalDays: 7,
  concentrationMgPerMl: null,
  pkOverride: null,
  status: 'active',
  notes: '',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
}

let pinia: ReturnType<typeof createPinia>
// Each panel listens for the app returning to view; one left mounted would hear the next test.
const mounted: { unmount(): void }[] = []
afterEach(() => mounted.splice(0).forEach((w) => w.unmount()))

beforeEach(async () => {
  await db.settings.clear()
  pinia = createPinia()
  setActivePinia(pinia)
  await useSettingsStore().load()
  access.check.mockReset()
  access.request.mockReset()
  access.openSettings.mockReset().mockResolvedValue(true)
})

async function mountPanel() {
  const wrapper = mountWithVuetify(NotifyMePanel, {
    props: { medication: med },
    global: { plugins: [pinia] },
  })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}

const button = (wrapper: Awaited<ReturnType<typeof mountPanel>>, text: string) =>
  wrapper.findAll('button').find((b) => b.text() === text)

describe('NotifyMePanel', () => {
  it('explains first, asks only on tap, then turns the reminder on', async () => {
    access.check.mockResolvedValue('prompt')
    access.request.mockResolvedValue('granted')
    const wrapper = await mountPanel()
    expect(wrapper.text()).toContain('Get a reminder when a dose is due')
    expect(access.request).not.toHaveBeenCalled()

    await button(wrapper, 'Allow notifications')!.trigger('click')
    await flushPromises()
    expect(access.request).toHaveBeenCalledOnce()
    expect(useSettingsStore().reminderFor(med.id).enabled).toBe(true)
    expect(wrapper.text()).toContain('Reminder on')
  })

  it('turns the reminder on straight away when notifications are already allowed', async () => {
    access.check.mockResolvedValue('granted')
    const wrapper = await mountPanel()
    expect(useSettingsStore().reminderFor(med.id).enabled).toBe(true)
    expect(wrapper.text()).toContain('Reminder on')
  })

  it('leads to Android settings when notifications are blocked, and checks again on return', async () => {
    access.check.mockResolvedValue('denied')
    const wrapper = await mountPanel()
    expect(wrapper.text()).toContain('Notifications are off for Gliplog')
    await button(wrapper, 'Open settings')!.trigger('click')
    expect(access.openSettings).toHaveBeenCalledOnce()

    access.check.mockResolvedValue('granted')
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(wrapper.text()).toContain('Reminder on')
    expect(useSettingsStore().reminderFor(med.id).enabled).toBe(true)
  })

  it('shows the blocked state when the user declines the system dialog', async () => {
    access.check.mockResolvedValue('prompt')
    access.request.mockResolvedValue('denied')
    const wrapper = await mountPanel()
    await button(wrapper, 'Allow notifications')!.trigger('click')
    await flushPromises()
    expect(useSettingsStore().reminderFor(med.id).enabled).toBe(false)
    expect(wrapper.text()).toContain('Notifications are off for Gliplog')
    expect(button(wrapper, 'Add a calendar invite instead')).toBeDefined()
  })

  it('stays off after the user turns it off here', async () => {
    access.check.mockResolvedValue('granted')
    const wrapper = await mountPanel()
    await button(wrapper, 'Turn off reminder')!.trigger('click')
    await flushPromises()
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(useSettingsStore().reminderFor(med.id).enabled).toBe(false)
    expect(wrapper.text()).toContain('Reminder off')
  })
})

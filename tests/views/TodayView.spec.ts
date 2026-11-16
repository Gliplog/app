import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { db } from '@/db'
import { createAppRouter } from '@/router'
import { useJournalStore } from '@/stores/journal'
import { useLogStore } from '@/stores/log'
import { usePhotosStore } from '@/stores/photos'
import { useSettingsStore } from '@/stores/settings'
import TodayView from '@/views/TodayView.vue'
import { mountWithVuetify } from '../helpers'

const DAY_MS = 86_400_000
const mounted: { unmount(): void }[] = []

afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
})

beforeEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(db.tables.map((t) => t.clear()))
  setActivePinia(createPinia())
})

async function mountToday(path = '/') {
  const pinia = setActivePinia(createPinia())
  const journal = useJournalStore()
  const settings = useSettingsStore()
  const photos = usePhotosStore()
  await Promise.all([journal.load(), settings.load(), photos.load()])

  const router = createAppRouter(createMemoryHistory())
  await router.push(path)
  await router.isReady()

  const wrapper = mountWithVuetify(TodayView, {
    global: { plugins: [pinia, router] },
  })
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, router, journal, log: useLogStore() }
}

describe('TodayView', () => {
  it('shows the empty state with buttons and units line on an empty database', async () => {
    const { wrapper } = await mountToday()
    expect(wrapper.text()).toContain('Start with what you take')
    expect(wrapper.text()).toContain('Add medication')
    expect(wrapper.text()).toContain('Log a weight')
    expect(wrapper.text()).toMatch(/Units: .+\./)
  })

  it('renders Due, In your system, Latest and Recent in heading order when seeded', async () => {
    const pre = setActivePinia(createPinia())
    const journal = useJournalStore(pre)
    await journal.load()
    const med = await journal.addMedication({
      productId: 'zepbound',
      name: 'Zepbound',
      status: 'active',
      intervalDays: 7,
      concentrationMgPerMl: null,
      pkOverride: null,
      notes: '',
    })
    await journal.addDose({
      medicationId: med.id,
      doseMg: 7.5,
      takenAt: new Date(Date.now() - DAY_MS).toISOString(),
      site: null,
      notes: '',
    })
    await journal.addWeight({
      measuredAt: new Date(Date.now() - DAY_MS).toISOString(),
      kg: 82.4,
      enteredUnit: 'kg',
      notes: '',
    })

    const { wrapper } = await mountToday()
    const h2s = wrapper.findAll('h2').map((h) => h.text())
    expect(h2s).toEqual(['Due', 'In your system', 'Latest', 'Recent'])
    expect(wrapper.text()).toContain('Tirzepatide injection')
    expect(wrapper.text()).toContain('7.5 mg Zepbound')
  })

  it('hides In your system when there is no level data', async () => {
    const pre = setActivePinia(createPinia())
    const journal = useJournalStore(pre)
    await journal.load()
    await journal.addMedication({
      productId: null,
      name: 'Custom med',
      status: 'active',
      intervalDays: 7,
      concentrationMgPerMl: null,
      pkOverride: null,
      notes: '',
    })

    const { wrapper } = await mountToday()
    const h2s = wrapper.findAll('h2').map((h) => h.text())
    expect(h2s).toEqual(['Due'])
    expect(wrapper.text()).not.toContain('In your system')
  })

  it('opens the dose dialog once for ?log=<id> and clears the query', async () => {
    const pre = setActivePinia(createPinia())
    const journal = useJournalStore(pre)
    await journal.load()
    const med = await journal.addMedication({
      productId: 'wegovy',
      name: 'Wegovy',
      status: 'active',
      intervalDays: 7,
      concentrationMgPerMl: null,
      pkOverride: null,
      notes: '',
    })

    const pinia = setActivePinia(createPinia())
    const j2 = useJournalStore(pinia)
    const s2 = useSettingsStore(pinia)
    const p2 = usePhotosStore(pinia)
    await Promise.all([j2.load(), s2.load(), p2.load()])
    const log = useLogStore(pinia)
    const startSpy = vi.spyOn(log, 'start')

    const router = createAppRouter(createMemoryHistory())
    await router.push(`/?log=${med.id}`)
    await router.isReady()

    const wrapper = mountWithVuetify(TodayView, {
      global: { plugins: [pinia, router] },
    })
    mounted.push(wrapper)
    await flushPromises()

    expect(startSpy).toHaveBeenCalledTimes(1)
    expect(startSpy).toHaveBeenCalledWith('dose', { medicationId: med.id })
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({}))
  })
})

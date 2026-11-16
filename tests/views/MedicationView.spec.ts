import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import { db } from '@/db'
import { createAppRouter } from '@/router'
import { useJournalStore } from '@/stores/journal'
import { useLogStore } from '@/stores/log'
import { useSettingsStore } from '@/stores/settings'
import { mountWithVuetify } from '../helpers'

vi.mock('vue-echarts', () => ({
  default: {
    name: 'VChart',
    props: ['option', 'autoresize'],
    template: '<div class="v-chart-stub" />',
  },
}))

const { default: MedicationView } = await import('@/views/MedicationView.vue')

const DAY_MS = 86_400_000
const mounted: { unmount(): void }[] = []

afterEach(() => {
  mounted.splice(0).forEach((w) => w.unmount())
})

beforeEach(async () => {
  vi.restoreAllMocks()
  if (!globalThis.visualViewport) {
    Object.defineProperty(globalThis, 'visualViewport', {
      value: {
        width: 390,
        height: 844,
        offsetLeft: 0,
        offsetTop: 0,
        pageLeft: 0,
        pageTop: 0,
        scale: 1,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      configurable: true,
    })
  }
  await Promise.all(db.tables.map((t) => t.clear()))
  setActivePinia(createPinia())
})

async function mountPage(id: string) {
  const pinia = setActivePinia(createPinia())
  const journal = useJournalStore()
  const settings = useSettingsStore()
  await Promise.all([journal.load(), settings.load()])

  const router = createAppRouter(createMemoryHistory())
  await router.push(`/medications/${id}`)
  await router.isReady()

  const wrapper = mountWithVuetify(MedicationView, {
    props: { id },
    global: { plugins: [pinia, router] },
  })
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, journal, log: useLogStore() }
}

describe('MedicationView', () => {
  it('shows the name, due text and one chart with the Estimated levels eyebrow', async () => {
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
    await journal.addDose({
      medicationId: med.id,
      doseMg: 0.25,
      takenAt: new Date(Date.now() - 4 * DAY_MS).toISOString(),
      site: null,
      notes: '',
    })

    const { wrapper } = await mountPage(med.id)
    expect(wrapper.find('h1').text()).toBe('Wegovy')
    expect(wrapper.text()).toContain('Due in 3 days')
    const charts = wrapper.findAll('[role="img"]')
    expect(charts).toHaveLength(1)
    expect(wrapper.text()).toContain('Estimated levels')
  })

  it('calls log.start with medicationId when Log dose is clicked', async () => {
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

    const { wrapper, log } = await mountPage(med.id)
    const startSpy = vi.spyOn(log, 'start')
    const btn = wrapper.findAll('button').find((b) => b.text().includes('Log dose'))!
    await btn.trigger('click')
    expect(startSpy).toHaveBeenCalledWith('dose', { medicationId: med.id })
  })

  it('shows the not-found card for an unknown id', async () => {
    const { wrapper } = await mountPage('missing-id')
    expect(wrapper.text()).toContain('This medication is not on this device.')
  })

  it('shows a pooled group caption naming both medications', async () => {
    const pre = setActivePinia(createPinia())
    const journal = useJournalStore(pre)
    await journal.load()
    const wegovy = await journal.addMedication({
      productId: 'wegovy',
      name: 'Wegovy',
      status: 'active',
      intervalDays: 7,
      concentrationMgPerMl: null,
      pkOverride: null,
      notes: '',
    })
    const ozempic = await journal.addMedication({
      productId: 'ozempic',
      name: 'Ozempic',
      status: 'archived',
      intervalDays: 7,
      concentrationMgPerMl: null,
      pkOverride: null,
      notes: '',
    })
    await journal.addDose({
      medicationId: ozempic.id,
      doseMg: 0.5,
      takenAt: new Date(Date.now() - 10 * DAY_MS).toISOString(),
      site: null,
      notes: '',
    })
    await journal.addDose({
      medicationId: wegovy.id,
      doseMg: 0.25,
      takenAt: new Date(Date.now() - 3 * DAY_MS).toISOString(),
      site: null,
      notes: '',
    })

    const { wrapper } = await mountPage(wegovy.id)
    expect(wrapper.text()).toContain('Includes doses of Ozempic and Wegovy.')
  })
})

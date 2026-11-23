import { describe, expect, it } from 'vitest'
import SyringeGraphic from '@/components/journal/SyringeGraphic.vue'
import { mountWithVuetify } from '../../helpers'

describe('SyringeGraphic', () => {
  it('describes the reading for screen readers', () => {
    const wrapper = mountWithVuetify(SyringeGraphic, { props: { units: 25 } })
    expect(wrapper.find('svg').attributes('aria-label')).toBe(
      '1 mL U-100 syringe, filled to 25 of 100 units',
    )
  })

  it('draws no needle or plunger unless realistic', () => {
    const simple = mountWithVuetify(SyringeGraphic, { props: { units: 25 } })
    expect(simple.find('figure').classes()).toContain('syringe--simple')
    for (const part of ['needle', 'hub', 'rod', 'stopper', 'thumb']) {
      expect(simple.find(`.syringe__${part}`).exists()).toBe(false)
    }
    expect(simple.find('.syringe__fill').exists()).toBe(true)

    const realistic = mountWithVuetify(SyringeGraphic, { props: { units: 25, realistic: true } })
    expect(realistic.find('figure').classes()).not.toContain('syringe--simple')
    for (const part of ['needle', 'hub', 'rod', 'stopper', 'thumb']) {
      expect(realistic.find(`.syringe__${part}`).exists()).toBe(true)
    }
  })
})

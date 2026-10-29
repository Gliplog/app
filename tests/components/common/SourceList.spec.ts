import { describe, expect, it } from 'vitest'
import SourceList from '@/components/common/SourceList.vue'
import { mountWithVuetify } from '../../helpers'

const sources = [
  { kind: 'label', citation: 'Label A', url: 'https://example.org/a' },
  { kind: 'standard', citation: 'Standard B' },
] as const

describe('SourceList', () => {
  it('starts collapsed and expands on tap', async () => {
    const wrapper = mountWithVuetify(SourceList, { props: { sources } })
    const toggle = wrapper.get('button')
    expect(toggle.text()).toBe('Sources (2)')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('ul').attributes('style')).toContain('display: none')

    await toggle.trigger('click')
    expect(toggle.text()).toBe('Hide sources')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('ul').attributes('style') ?? '').not.toContain('display: none')
    expect(wrapper.get('a').attributes('href')).toBe('https://example.org/a')
  })

  it('renders nothing without sources', () => {
    const wrapper = mountWithVuetify(SourceList, { props: { sources: [] } })
    expect(wrapper.find('button').exists()).toBe(false)
  })
})

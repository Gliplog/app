import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { VBtn } from 'vuetify/components'
import { patchRippleSource } from '../../build/vuetify-ripple-patch'
import { mountWithVuetify } from '../helpers'

const rippleSource = () =>
  readFileSync(createRequire(import.meta.url).resolve('vuetify/lib/directives/ripple/index.js'), 'utf8')

describe('patched Vuetify ripple', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('matches the installed Vuetify source exactly once', () => {
    const patched = patchRippleSource(rippleSource())
    expect(patched).toContain('function rippleHide(e, element = e.currentTarget) {')
    expect(patched).toContain('rippleHide(e, element);')
    // Already patched, or changed upstream: the build must stop rather than ship it unpatched.
    expect(() => patchRippleSource(patched)).toThrow(/Vuetify ripple patch/)
  })

  it('clears the ripple after a touch shorter than the show delay', () => {
    vi.useFakeTimers()
    const wrapper = mountWithVuetify({ render: () => h(VBtn, () => 'Shelf') }, { attachTo: document.body })
    const button = wrapper.get('.v-btn').element
    const touches = [new Touch({ identifier: 0, target: button, clientX: 8, clientY: 8 })]
    button.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches }))
    button.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: touches }))
    expect(button.querySelector('.v-ripple__container')).not.toBeNull()

    vi.runAllTimers()
    expect(button.querySelector('.v-ripple__container')).toBeNull()
    wrapper.unmount()
  })
})

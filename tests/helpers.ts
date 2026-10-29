import { mount, type ComponentMountingOptions } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import type { Component } from 'vue'

/** Mount with a real Vuetify instance so tests exercise the components users see. */
export function mountWithVuetify<C extends Component>(
  component: C,
  options: ComponentMountingOptions<C> = {},
) {
  return mount(component, {
    ...options,
    global: { ...options.global, plugins: [createVuetify(), ...(options.global?.plugins ?? [])] },
  })
}

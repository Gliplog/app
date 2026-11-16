import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '@/router'

describe('router routes', () => {
  it('resolves /medications/unknown to the medication route', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/medications/unknown')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('medication')
    expect(router.currentRoute.value.params).toEqual({ id: 'unknown' })
  })
})

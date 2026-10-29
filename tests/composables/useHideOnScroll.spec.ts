import { describe, expect, it } from 'vitest'
import { nextBarState, type BarScrollState } from '@/composables/useHideOnScroll'

const MAX = 2000

/** Feed a sequence of scroll offsets and return whether the bar ends up hidden. */
function scrollThrough(
  offsets: number[],
  start: BarScrollState = { hidden: false, anchor: 0, last: 0 },
) {
  return offsets.reduce((state, y) => nextBarState(state, y, MAX), start)
}

describe('nextBarState', () => {
  it('hides after a deliberate scroll down past the top zone', () => {
    expect(scrollThrough([40, 120, 200]).hidden).toBe(true)
  })

  it('stays visible within the top zone however far it moves', () => {
    expect(scrollThrough([20, 40, 60]).hidden).toBe(false)
  })

  it('shows again after a deliberate scroll up', () => {
    expect(scrollThrough([200, 400, 380, 360]).hidden).toBe(false)
  })

  it('ignores jitter smaller than the slop in either direction', () => {
    const hidden = scrollThrough([200, 400])
    expect(scrollThrough([395, 398, 392], hidden).hidden).toBe(true)
    const shown = scrollThrough([200, 400, 300])
    expect(scrollThrough([305, 302, 308], shown).hidden).toBe(false)
  })

  it('measures slow scrolling from where the direction began, not frame to frame', () => {
    const steps = Array.from({ length: 20 }, (_, i) => 200 + i * 2)
    expect(scrollThrough(steps).hidden).toBe(true)
  })

  it('does not flash the bar when iOS bounces back from the bottom', () => {
    const atBottom = scrollThrough([200, 1000, MAX])
    expect(scrollThrough([MAX + 40, MAX + 10, MAX], atBottom).hidden).toBe(true)
  })

  it('shows at the top, including iOS overscroll above it', () => {
    expect(scrollThrough([400, 800, -30]).hidden).toBe(false)
  })
})

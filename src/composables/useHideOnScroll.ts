import { onBeforeUnmount, onMounted, reactive } from 'vue'

export interface BarScrollState {
  hidden: boolean
  /** Scroll offset where the current direction of travel began. */
  anchor: number
  /** Offset at the previous measurement. */
  last: number
}

export interface BarScrollOptions {
  /** Within this distance of the top the bar always shows (about the bar's own height). */
  topZone: number
  /** Movement smaller than this in one direction is jitter, not intent. */
  slop: number
}

const DEFAULTS: BarScrollOptions = { topZone: 64, slop: 12 }

/**
 * Next bar state for a scroll offset `y` on a page that can scroll to `maxY`. Hides after a
 * deliberate scroll down, shows after a deliberate scroll up or near the top. Offsets outside
 * 0..maxY are iOS rubber-banding: the bounce back from the bottom would otherwise read as a
 * scroll up and flash the bar.
 */
export function nextBarState(
  prev: BarScrollState,
  y: number,
  maxY: number,
  options: BarScrollOptions = DEFAULTS,
): BarScrollState {
  if (y <= options.topZone) return { hidden: false, anchor: Math.max(y, 0), last: Math.max(y, 0) }
  if (y >= maxY) return { hidden: prev.hidden, anchor: maxY, last: maxY }
  const reversed = Math.sign(y - prev.last) !== Math.sign(prev.last - prev.anchor)
  const anchor = reversed && y !== prev.last ? prev.last : prev.anchor
  const travelled = y - anchor
  const hidden = Math.abs(travelled) >= options.slop ? travelled > 0 : prev.hidden
  return { hidden, anchor, last: y }
}

/**
 * Scroll-away app bar, the pattern of Safari, Chrome and most reading apps: the bar slides out
 * as the user scrolls down to read and returns as soon as they scroll back up. `reveal()`
 * brings it back on demand (a tap, a route change, focus). Returns `state.hidden`.
 */
export function useHideOnScroll(options: BarScrollOptions = DEFAULTS) {
  const state = reactive({ hidden: false })
  let current: BarScrollState = { hidden: false, anchor: 0, last: 0 }
  let frame = 0

  function measure() {
    frame = 0
    const root = document.documentElement
    current = nextBarState(current, window.scrollY, root.scrollHeight - window.innerHeight, options)
    state.hidden = current.hidden
  }

  function onScroll() {
    if (!frame) frame = requestAnimationFrame(measure)
  }

  function reveal() {
    const y = Math.max(window.scrollY, 0)
    current = { hidden: false, anchor: y, last: y }
    state.hidden = false
  }

  onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', onScroll)
    cancelAnimationFrame(frame)
  })

  return { state, actions: { reveal } }
}

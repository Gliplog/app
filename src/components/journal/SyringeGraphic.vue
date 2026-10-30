<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { roundTo } from '@/domain/units'

/**
 * A 1 mL U-100 insulin syringe drawn up to `units`. The plunger glides to each new reading;
 * the text reading is exact and never tweened.
 */
const props = defineProps<{
  units: number
}>()

// A 1 mL U-100 syringe, the largest common size: 100 units, a tick every 2, a number every 10.
const CAPACITY_UNITS = 100
const TICK_UNITS = 2
const LABEL_EVERY_TICKS = 5

// Drawing geometry in viewBox units; the SVG scales to its container width.
const VIEW_W = 640
const VIEW_H = 150
const BARREL_X = 78
const BARREL_W = 470
const BARREL_Y = 38
const BARREL_H = 52
const MID_Y = BARREL_Y + BARREL_H / 2

const PLUNGER_MS = 800
const STOPPER_W = 12

const fits = computed(() => props.units <= CAPACITY_UNITS)
const fillFraction = computed(() => Math.min(1, Math.max(0, props.units / CAPACITY_UNITS)))

const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const shownFraction = ref(fillFraction.value)
let frame = 0

function glideTo(target: number) {
  cancelAnimationFrame(frame)
  if (reduceMotion || typeof requestAnimationFrame !== 'function') {
    shownFraction.value = target
    return
  }
  const from = shownFraction.value
  let start: number | undefined
  const step = (t: number) => {
    start ??= t
    const p = Math.min(1, (t - start) / PLUNGER_MS)
    shownFraction.value = from + (target - from) * (1 - (1 - p) ** 3)
    if (p < 1) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
}

onMounted(() => {
  // First appearance draws up from empty, like filling a real syringe.
  shownFraction.value = 0
  glideTo(fillFraction.value)
})
watch(fillFraction, glideTo)
onBeforeUnmount(() => cancelAnimationFrame(frame))

const fillX = computed(() => BARREL_X + BARREL_W * shownFraction.value)

// Gradient ids must be unique when several syringes render on one page.
const fluidId = `${useId()}-fluid`

const ticks = computed(() => {
  const count = CAPACITY_UNITS / TICK_UNITS
  return Array.from({ length: count + 1 }, (_, i) => {
    const major = i % LABEL_EVERY_TICKS === 0
    return {
      x: BARREL_X + (BARREL_W * i) / count,
      length: major ? 20 : 8,
      label: major ? String(i * TICK_UNITS) : null,
    }
  })
})

const readingText = computed(() =>
  fits.value ? `${roundTo(props.units, 1)} units` : `exceeds ${CAPACITY_UNITS} units`,
)

const ariaLabel = computed(() => {
  const base = `1 mL U-100 syringe, filled to ${roundTo(props.units, 1)} of ${CAPACITY_UNITS} units`
  return fits.value ? base : `${base}. This dose is more than one syringe holds.`
})

/** Keep the reading flag inside the drawing when the fill is near either end. */
const flagX = computed(() =>
  Math.min(Math.max(fillX.value, BARREL_X + 40), BARREL_X + BARREL_W - 40),
)
</script>

<template>
  <figure class="syringe">
    <svg
      :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
      role="img"
      :aria-label="ariaLabel"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient :id="fluidId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" class="syringe__stop--deep" />
          <stop offset="0.28" class="syringe__stop--light" />
          <stop offset="0.55" class="syringe__stop--mid" />
          <stop offset="1" class="syringe__stop--deep" />
        </linearGradient>
      </defs>

      <!-- Needle and hub -->
      <line class="syringe__needle" x1="8" :y1="MID_Y" :x2="BARREL_X - 16" :y2="MID_Y" />
      <rect class="syringe__hub" :x="BARREL_X - 18" :y="MID_Y - 9" width="18" height="18" rx="3" />

      <!-- Barrel, liquid, and plunger -->
      <rect
        class="syringe__barrel"
        :x="BARREL_X"
        :y="BARREL_Y"
        :width="BARREL_W"
        :height="BARREL_H"
        rx="6"
      />
      <rect
        class="syringe__fill"
        :x="BARREL_X + 1"
        :y="BARREL_Y + 1"
        :width="Math.max(0, fillX - BARREL_X - 1)"
        :height="BARREL_H - 2"
        rx="5"
        :fill="`url(#${fluidId})`"
      />
      <rect
        class="syringe__rod"
        :x="fillX + STOPPER_W"
        :y="MID_Y - 5"
        :width="Math.max(0, BARREL_X + BARREL_W + 52 - fillX - STOPPER_W)"
        height="10"
      />
      <!-- Rubber stopper: two sealing ribs either side of a groove -->
      <g class="syringe__stopper">
        <rect :x="fillX" :y="BARREL_Y + 2" :width="STOPPER_W" :height="BARREL_H - 4" rx="2" />
        <rect
          class="syringe__groove"
          :x="fillX + 4"
          :y="BARREL_Y + 5"
          width="4"
          :height="BARREL_H - 10"
          rx="1"
        />
      </g>
      <!-- Glass reflection over liquid and empty barrel alike -->
      <rect
        class="syringe__glint"
        :x="BARREL_X + 8"
        :y="BARREL_Y + 7"
        :width="BARREL_W - 16"
        height="5"
        rx="2.5"
      />
      <rect
        class="syringe__thumb"
        :x="BARREL_X + BARREL_W + 52"
        :y="BARREL_Y - 6"
        width="10"
        :height="BARREL_H + 12"
        rx="3"
      />
      <rect
        class="syringe__flange"
        :x="BARREL_X + BARREL_W - 2"
        :y="BARREL_Y - 12"
        width="8"
        :height="BARREL_H + 24"
        rx="3"
      />

      <!-- Graduations along the top edge of the barrel, numbers below -->
      <g class="syringe__ticks">
        <line
          v-for="(t, i) in ticks"
          :key="i"
          :x1="t.x"
          :y1="BARREL_Y"
          :x2="t.x"
          :y2="BARREL_Y + t.length"
        />
      </g>
      <g class="syringe__labels">
        <template v-for="(t, i) in ticks" :key="`l${i}`">
          <text v-if="t.label !== null" :x="t.x" :y="BARREL_Y + BARREL_H + 20" text-anchor="middle">
            {{ t.label }}
          </text>
        </template>
      </g>

      <!-- Reading flag at the draw line -->
      <line
        class="syringe__target"
        :x1="fillX"
        :y1="BARREL_Y - 6"
        :x2="fillX"
        :y2="BARREL_Y + BARREL_H + 4"
      />
      <text class="syringe__reading" :x="flagX" :y="BARREL_Y - 12" text-anchor="middle">
        {{ readingText }}
      </text>
    </svg>
  </figure>
</template>

<style scoped>
.syringe {
  margin: 0;
}

.syringe svg {
  display: block;
  width: 100%;
  height: auto;
  max-height: 180px;
}

.syringe__needle {
  stroke: var(--gl-syringe-plunger);
  stroke-width: 3;
  stroke-linecap: round;
}

.syringe__hub,
.syringe__thumb,
.syringe__flange,
.syringe__rod {
  fill: var(--gl-syringe-plunger);
}

.syringe__barrel {
  fill: var(--gl-syringe-barrel);
  stroke: var(--gl-syringe-ink);
  stroke-width: 2;
}

.syringe__fill {
  opacity: 0.92;
}

.syringe__stop--light {
  stop-color: var(--gl-syringe-fill);
  stop-opacity: 0.75;
}

.syringe__stop--mid {
  stop-color: var(--gl-syringe-fill);
}

.syringe__stop--deep {
  stop-color: var(--gl-syringe-fill-deep);
}

.syringe__stopper {
  fill: var(--gl-syringe-ink);
}

.syringe__groove {
  fill: var(--gl-syringe-plunger);
  opacity: 0.6;
}

.syringe__glint {
  fill: var(--gl-syringe-glint);
  pointer-events: none;
}

.syringe__ticks line {
  stroke: var(--gl-syringe-ink);
  stroke-width: 1.5;
}

.syringe__labels text {
  fill: var(--gl-text-2);
  font-family: var(--gl-font-mono);
  font-size: 15px;
}

.syringe__target {
  stroke: var(--gl-text-1);
  stroke-width: 2;
  stroke-dasharray: 4 3;
}

.syringe__reading {
  fill: var(--gl-text-1);
  font-family: var(--gl-font);
  font-weight: 700;
  font-size: 18px;
}
</style>

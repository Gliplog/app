<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { MedicationRow } from '@/db/database'
import { dueState } from '@/domain/schedule'
import { formatDose } from '@/domain/units'
import { useJournalStore } from '@/stores/journal'
import { formatDateTime, formatRelativeDays, formatWeekday } from '@/services/time'
import {
  mdiBellOutline,
  mdiBellRingOutline,
  mdiChevronLeft,
  mdiChevronRight,
  mdiNeedle,
} from '@/plugins/icons'
import { useSettingsStore } from '@/stores/settings'
import { remindersSupported } from '@/composables/useReminderSync'

/**
 * The medications in use as a stack of cards: the chosen one in front, the next two peeking
 * below it. Swipe, the arrow buttons, the dots or the arrow keys bring another to the front.
 * Only the front card is interactive; the rest are inert and hidden from assistive technology,
 * so each control exists once on the page.
 */
const props = defineProps<{
  medications: MedicationRow[]
  now: number
}>()
const selectedId = defineModel<string | undefined>({ required: true })
const emit = defineEmits<{ 'log-dose': [med: MedicationRow]; reminder: [med: MedicationRow] }>()

const journal = useJournalStore()
const settings = useSettingsStore()

/** The app's own reminder is on; the web app reminds through the calendar instead. */
const reminderOn = (med: MedicationRow) =>
  remindersSupported && settings.reminderFor(med.id).enabled

function reminderLabel(med: MedicationRow): string {
  return reminderOn(med) ? `Reminder for ${med.name}: on` : `Add reminder for ${med.name}`
}

/** Cards drawn behind the front one; any further back are hidden until they come forward. */
const PEEKING = 2
/** How far each card behind sits below the one in front, in px. */
const PEEK_OFFSET = 12
/** A drag past this share of the card's width, or a quick flick, changes the card. */
const SWIPE_FRACTION = 0.22
const FLICK_PX_PER_MS = 0.45
/** Matches the longest keyframe below, so the leaving card's class is removed after it ends. */
const SWITCH_MS = 460

const count = computed(() => props.medications.length)
const index = computed(() => {
  const i = props.medications.findIndex((m) => m.id === selectedId.value)
  return i < 0 ? 0 : i
})

/** 0 for the front card, 1 for the one just behind it, and so on, wrapping around. */
const depthOf = (i: number) => (i - index.value + count.value) % count.value

/** The card swinging out; `fromX` is where a swipe let go, so the swing starts under the finger. */
const leaving = ref<{ id: string; direction: 'next' | 'prev'; fromX: number } | null>(null)
let leavingTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Bring card `target` to the front. Going forward, the front card swings out and tucks in at
 * the back; going back, the incoming card swings out from behind and comes over the top.
 */
function switchTo(target: number, direction: 'next' | 'prev', fromX = 0) {
  const from = props.medications[index.value]!
  const to = props.medications[target]!
  if (from.id === to.id) return
  leaving.value = { id: direction === 'next' ? from.id : to.id, direction, fromX }
  clearTimeout(leavingTimer)
  leavingTimer = setTimeout(() => (leaving.value = null), SWITCH_MS)
  selectedId.value = to.id
}

function go(step: 1 | -1, fromX = 0) {
  if (count.value < 2) return
  switchTo((index.value + step + count.value) % count.value, step === 1 ? 'next' : 'prev', fromX)
}

/** A dot to the right moves forward and one to the left back, matching how the dots read. */
function show(id: string) {
  const target = props.medications.findIndex((m) => m.id === id)
  if (target >= 0) switchTo(target, target > index.value ? 'next' : 'prev')
}

onBeforeUnmount(() => clearTimeout(leavingTimer))

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowRight') go(1)
  else if (event.key === 'ArrowLeft') go(-1)
  else return
  event.preventDefault()
}

/*
 * Swipe: a horizontal drag moves the front card with the finger; a vertical one is left to the
 * page so scrolling still works (touch-action: pan-y). A drag that moved the card cancels the
 * click it would otherwise end in, so a swipe that starts on a button never presses it.
 */
const drag = ref({ active: false, dx: 0 })
let start: { x: number; y: number; t: number; id: number; width: number } | null = null
let horizontal = false
let suppressClick = false

function onPointerDown(event: PointerEvent) {
  if (count.value < 2 || (event.pointerType === 'mouse' && event.button !== 0)) return
  const card = event.currentTarget as HTMLElement
  start = {
    x: event.clientX,
    y: event.clientY,
    t: event.timeStamp,
    id: event.pointerId,
    width: card.offsetWidth,
  }
  horizontal = false
  suppressClick = false
}

function onPointerMove(event: PointerEvent) {
  if (!start || event.pointerId !== start.id) return
  const dx = event.clientX - start.x
  const dy = event.clientY - start.y
  if (!horizontal) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
      start = null
      return
    }
    if (Math.abs(dx) < 10) return
    horizontal = true
    suppressClick = true
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }
  drag.value = { active: true, dx }
}

function onPointerUp(event: PointerEvent) {
  if (!start || event.pointerId !== start.id) return
  const { dx } = drag.value
  const speed = Math.abs(dx) / Math.max(1, event.timeStamp - start.t)
  const far = Math.abs(dx) > start.width * SWIPE_FRACTION
  start = null
  // Dropping the drag re-enables the transition, so a short drag springs back from where it
  // was; a switch hands the release point to the leaving card's keyframes instead.
  drag.value = { active: false, dx: 0 }
  if (horizontal && (far || speed > FLICK_PX_PER_MS) && Math.abs(dx) > 24) {
    go(dx < 0 ? 1 : -1, dx)
  }
}

function onClickCapture(event: MouseEvent) {
  if (!suppressClick) return
  suppressClick = false
  event.stopPropagation()
  event.preventDefault()
}

function cardStyle(i: number) {
  const depth = depthOf(i)
  const id = props.medications[i]!.id
  const swingFrom = leaving.value?.id === id ? leaving.value.fromX : 0
  const hidden = depth > PEEKING
  const style: Record<string, string> = {
    '--depth': String(Math.min(depth, PEEKING + 1)),
    '--peek': `${PEEK_OFFSET}px`,
    // Unitless, so it can scale both the offset (px) and the tilt (deg).
    '--drag': String(depth === 0 && drag.value.active ? drag.value.dx : swingFrom),
    zIndex: String(count.value - depth),
  }
  if (hidden) style.opacity = '0'
  return style
}

function intervalText(days: number): string {
  return days === 1 ? 'daily' : days === 7 ? 'weekly' : `every ${days} days`
}

function dueText(med: MedicationRow): string {
  const at = journal.nextDueOf(med)
  if (at === null) return 'No dose logged yet'
  const state = dueState(at, props.now)
  switch (state.kind) {
    case 'later':
      return `Next dose ${formatWeekday(at)}, in ${state.days} day${state.days === 1 ? '' : 's'}`
    case 'soon':
      return `Next dose in about ${state.hours} hour${state.hours === 1 ? '' : 's'}`
    case 'due':
      return 'Your next dose is due'
    case 'late':
      return `Due ${formatRelativeDays(state.days)}`
  }
  return ''
}

/** Other medications in use that share this one's level estimate (same medicine and route). */
function sharesWith(med: MedicationRow): string[] {
  const profile = journal.productOf(med)?.pkProfile
  if (!profile) return []
  return props.medications
    .filter((m) => m.id !== med.id && journal.productOf(m)?.pkProfile === profile)
    .map((m) => m.name)
}

const current = computed(() => props.medications[index.value])
const announcement = computed(() =>
  current.value && count.value > 1
    ? `Showing ${current.value.name}, ${index.value + 1} of ${count.value}`
    : '',
)
</script>

<template>
  <div
    class="med-stack"
    role="region"
    aria-roledescription="carousel"
    aria-label="Medications in use"
    @keydown="onKeydown"
  >
    <div
      class="med-stack__deck"
      :style="{ paddingBottom: `${Math.min(count - 1, PEEKING) * PEEK_OFFSET}px` }"
    >
      <v-card
        v-for="(med, i) in medications"
        :key="med.id"
        :class="[
          'med-stack__card',
          'gl-card-stacked',
          {
            'med-stack__card--front': depthOf(i) === 0,
            'med-stack__card--dragging': depthOf(i) === 0 && drag.active,
            'med-stack__card--leave-next': leaving?.id === med.id && leaving.direction === 'next',
            'med-stack__card--enter-prev': leaving?.id === med.id && leaving.direction === 'prev',
          },
        ]"
        :style="cardStyle(i)"
        role="group"
        aria-roledescription="slide"
        :aria-label="count > 1 ? `${med.name}, ${i + 1} of ${count}` : med.name"
        :inert="depthOf(i) === 0 ? undefined : true"
        :aria-hidden="depthOf(i) === 0 ? undefined : 'true'"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @click.capture="onClickCapture"
      >
        <v-card-item>
          <p class="gl-eyebrow">Medication</p>
          <v-card-title class="text-wrap">{{ med.name }}</v-card-title>
          <template #append>
            <v-btn
              :icon="reminderOn(med) ? mdiBellRingOutline : mdiBellOutline"
              :color="reminderOn(med) ? 'primary' : undefined"
              variant="text"
              :aria-label="reminderLabel(med)"
              @click="emit('reminder', med)"
            />
          </template>
          <v-card-subtitle>
            <template v-if="journal.productOf(med)"
              >{{ journal.productOf(med)!.molecule }} · </template
            >{{ intervalText(med.intervalDays) }}
          </v-card-subtitle>
        </v-card-item>
        <v-card-text class="gl-stack">
          <p class="text-title-medium">{{ dueText(med) }}</p>
          <p v-if="journal.lastDoseOf(med.id)" class="gl-muted">
            Last: <span class="gl-num">{{ formatDose(journal.lastDoseOf(med.id)!.doseMg) }}</span
            >,
            {{ formatDateTime(journal.lastDoseOf(med.id)!.takenAt) }}
          </p>
          <p v-if="sharesWith(med).length" class="text-body-small gl-muted">
            Shares a level estimate with {{ sharesWith(med).join(' and ') }}.
          </p>
          <div class="gl-actions">
            <v-btn
              color="primary"
              variant="flat"
              :prepend-icon="mdiNeedle"
              @click="emit('log-dose', med)"
            >
              Log dose
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <div v-if="count > 1" class="med-stack__controls">
      <v-btn
        :icon="mdiChevronLeft"
        variant="text"
        aria-label="Previous medication"
        @click="go(-1)"
      />
      <div v-if="count <= 6" class="med-stack__dots" role="group" aria-label="Choose a medication">
        <button
          v-for="(med, i) in medications"
          :key="med.id"
          type="button"
          :class="['med-stack__dot', { 'med-stack__dot--on': i === index }]"
          :aria-label="med.name"
          :aria-pressed="i === index"
          @click="show(med.id)"
        >
          <span aria-hidden="true" />
        </button>
      </div>
      <span v-else class="text-body-small gl-muted gl-num">{{ index + 1 }} of {{ count }}</span>
      <v-btn :icon="mdiChevronRight" variant="text" aria-label="Next medication" @click="go(1)" />
    </div>
    <p class="d-sr-only" aria-live="polite">{{ announcement }}</p>
  </div>
</template>

<style scoped>
/*
 * Every card shares one grid cell, so the deck is as tall as the tallest card and the cards
 * behind line up exactly under the front one. Scaling from the bottom edge lets each card behind
 * show a sliver below the one in front of it.
 */
.med-stack__deck {
  display: grid;
  touch-action: pan-y;
}

.med-stack__card {
  --stack-ease: cubic-bezier(0.32, 0.72, 0, 1);
  grid-area: 1 / 1;
  transform-origin: 50% 100%;
  transform: translate3d(calc(var(--drag) * 1px), calc(var(--depth) * var(--peek)), 0)
    scale(calc(1 - var(--depth) * 0.045)) rotate(calc(var(--drag) * 0.012deg));
  transition:
    transform 460ms var(--stack-ease),
    opacity var(--gl-dur-base) var(--gl-ease-standard),
    filter var(--gl-dur-base) var(--gl-ease-standard);
  user-select: none;
  will-change: transform;
}

.med-stack__card:not(.med-stack__card--front) {
  filter: saturate(0.8) brightness(0.95);
}

.med-stack__card--dragging {
  transition: none;
}

/* The front card swings away from the finger, then slides in behind the others. */
.med-stack__card--leave-next {
  animation: stack-leave 460ms var(--stack-ease);
}

/* The rearmost card swings out to the side, then comes over the top to the front. */
.med-stack__card--enter-prev {
  animation: stack-enter 460ms var(--stack-ease);
}

@keyframes stack-leave {
  0% {
    transform: translate3d(calc(var(--drag) * 1px), 0, 0) scale(1);
    z-index: 50;
  }
  45% {
    transform: translate3d(-62%, -4px, 0) scale(0.97) rotate(-5deg);
    z-index: 50;
  }
  55% {
    z-index: 0;
  }
  100% {
    transform: translate3d(0, calc(var(--depth) * var(--peek)), 0)
      scale(calc(1 - var(--depth) * 0.045));
    z-index: 0;
  }
}

@keyframes stack-enter {
  0% {
    transform: translate3d(0, calc(2 * var(--peek)), 0) scale(0.91);
    z-index: 0;
  }
  45% {
    transform: translate3d(62%, -4px, 0) scale(0.97) rotate(5deg);
    z-index: 0;
  }
  55% {
    z-index: 50;
  }
  100% {
    transform: translate3d(0, 0, 0) scale(1);
    z-index: 50;
  }
}

.med-stack__controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 4px;
}

.med-stack__dots {
  display: flex;
}

.med-stack__dot {
  display: grid;
  place-items: center;
  width: 32px;
  height: var(--gl-touch);
  border: 0;
  background: none;
  cursor: pointer;
  border-radius: var(--gl-radius-pill);
}

.med-stack__dot:focus-visible {
  outline: none;
  box-shadow: var(--gl-shadow-focus);
}

.med-stack__dot span {
  width: 8px;
  height: 8px;
  border-radius: var(--gl-radius-pill);
  background: var(--gl-divider-strong);
  transition:
    width var(--gl-dur-base) var(--gl-ease-standard),
    background-color var(--gl-dur-base) var(--gl-ease-standard);
}

/* The chosen dot is longer as well as darker, so it never relies on colour alone. */
.med-stack__dot--on span {
  width: 22px;
  background: var(--gl-brand);
}
</style>

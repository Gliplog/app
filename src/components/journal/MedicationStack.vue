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
/**
 * Clears the switch animation if `animationend` never arrives (the card was hidden or removed
 * mid-swing). Longer than the 420 ms keyframes below so it never cuts one short.
 */
const SWITCH_FALLBACK_MS = 600

const count = computed(() => props.medications.length)
const index = computed(() => {
  const i = props.medications.findIndex((m) => m.id === selectedId.value)
  return i < 0 ? 0 : i
})

/** 0 for the front card, 1 for the one just behind it, and so on, wrapping around. */
const depthOf = (i: number) => (i - index.value + count.value) % count.value

/**
 * The cards a switch animates. `leaveId` is the old front card, which carries on in the swipe's
 * direction (`away`: -1 left, 1 right) from `fromX`, where the finger let go, so it never jumps
 * back to the centre first. `enterId`, going back only, is the card brought forward from the
 * rear, which fades in at the front.
 */
const switching = ref<{
  leaveId: string
  enterId: string | null
  away: -1 | 1
  fromX: number
} | null>(null)
let switchTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Bring card `target` to the front. The front card flies off the way the finger went and fades,
 * then fades back in at its new place in the stack: forward (a swipe left) it goes to the rear
 * and the card behind slides up; back (a swipe right) it settles just behind the card brought
 * from the rear. A card changes layer only while it is invisible, so nothing pops through.
 */
function switchTo(target: number, direction: 'next' | 'prev', fromX = 0) {
  const from = props.medications[index.value]!
  const to = props.medications[target]!
  if (from.id === to.id) return
  switching.value = {
    leaveId: from.id,
    enterId: direction === 'prev' ? to.id : null,
    away: direction === 'next' ? -1 : 1,
    fromX,
  }
  clearTimeout(switchTimer)
  switchTimer = setTimeout(() => (switching.value = null), SWITCH_FALLBACK_MS)
  selectedId.value = to.id
}

function onAnimationEnd(event: AnimationEvent) {
  // Only the leaving card's own swing ends a switch: the entering card's fade ends with it, and
  // animations inside a card (progress bars) bubble up here too.
  if (event.target !== event.currentTarget || !event.animationName.startsWith('stack-leave')) {
    return
  }
  clearTimeout(switchTimer)
  switching.value = null
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

onBeforeUnmount(() => clearTimeout(switchTimer))

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
 *
 * The finger's offset is written straight to the card as `--pull` rather than through reactive
 * state: a reactive write would re-render every card on every pointer move, which stutters on
 * phones. Only the start and end of a drag touch Vue state.
 */
const dragging = ref(false)
let start: {
  x: number
  y: number
  t: number
  id: number
  card: HTMLElement
} | null = null
let dx = 0
let horizontal = false
let suppressClick = false

function setPull(card: HTMLElement, px: number | null) {
  if (px === null) card.style.removeProperty('--pull')
  else card.style.setProperty('--pull', String(px))
}

function onPointerDown(event: PointerEvent) {
  if (count.value < 2 || (event.pointerType === 'mouse' && event.button !== 0)) return
  start = {
    x: event.clientX,
    y: event.clientY,
    t: event.timeStamp,
    id: event.pointerId,
    card: event.currentTarget as HTMLElement,
  }
  dx = 0
  horizontal = false
  suppressClick = false
}

function onPointerMove(event: PointerEvent) {
  if (!start || event.pointerId !== start.id) return
  const moveX = event.clientX - start.x
  const moveY = event.clientY - start.y
  if (!horizontal) {
    if (Math.abs(moveY) > 10 && Math.abs(moveY) > Math.abs(moveX)) {
      start = null
      return
    }
    if (Math.abs(moveX) < 10) return
    horizontal = true
    suppressClick = true
    dragging.value = true
    start.card.setPointerCapture(event.pointerId)
  }
  dx = moveX
  setPull(start.card, dx)
}

/** Dropping `--pull` re-enables the transition, so a short drag springs back from where it was. */
function endDrag() {
  if (start) setPull(start.card, null)
  start = null
  dragging.value = false
}

function onPointerUp(event: PointerEvent) {
  if (!start || event.pointerId !== start.id) return
  const speed = Math.abs(dx) / Math.max(1, event.timeStamp - start.t)
  const far = Math.abs(dx) > start.card.offsetWidth * SWIPE_FRACTION
  const switching = horizontal && (far || speed > FLICK_PX_PER_MS) && Math.abs(dx) > 24
  endDrag()
  // A switch hands the release point to the keyframes, so the card carries on from there.
  if (switching) go(dx < 0 ? 1 : -1, dx)
}

/** The browser took the gesture (a scroll, a system swipe): spring back, never switch. */
function onPointerCancel(event: PointerEvent) {
  if (start && event.pointerId === start.id) endDrag()
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
  const leaves = switching.value?.leaveId === id
  const hidden = depth > PEEKING
  return {
    '--depth': String(Math.min(depth, PEEKING + 1)),
    '--peek': `${PEEK_OFFSET}px`,
    // Unitless, so it can scale both the offset (px) and the tilt (deg).
    '--swing-from': String(leaves ? switching.value!.fromX : 0),
    '--away': String(leaves ? switching.value!.away : -1),
    '--shown': hidden ? '0' : '1',
    zIndex: String(count.value - depth),
  }
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
            'med-stack__card--dragging': depthOf(i) === 0 && dragging,
            'med-stack__card--leave': switching?.leaveId === med.id,
            'med-stack__card--enter': switching?.enterId === med.id,
          },
        ]"
        :style="cardStyle(i)"
        :link="false"
        role="group"
        aria-roledescription="slide"
        :aria-label="count > 1 ? `${med.name}, ${i + 1} of ${count}` : med.name"
        :inert="depthOf(i) === 0 ? undefined : true"
        :aria-hidden="depthOf(i) === 0 ? undefined : 'true'"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
        @animationend="onAnimationEnd"
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
  --pull: 0;
  grid-area: 1 / 1;
  transform-origin: 50% 100%;
  transform: translate3d(calc(var(--pull) * 1px), calc(var(--depth) * var(--peek)), 0)
    scale(calc(1 - var(--depth) * 0.045)) rotate(calc(var(--pull) * 0.012deg));
  opacity: var(--shown);
  transition:
    transform 420ms var(--stack-ease),
    opacity var(--gl-dur-base) var(--gl-ease-standard),
    filter var(--gl-dur-base) var(--gl-ease-standard);
  user-select: none;
  will-change: transform, opacity;
}

.med-stack__card:not(.med-stack__card--front) {
  filter: saturate(0.8) brightness(0.95);
}

.med-stack__card--dragging {
  transition: none;
}

/*
 * The old front card carries on the way the finger went (`--away`) and fades out, drops behind
 * the others while it is invisible, then fades in at its new depth. The layer change at 45 %
 * is hidden by the opacity, so it never shows through the cards in front.
 */
.med-stack__card--leave {
  animation: stack-leave 420ms var(--stack-ease);
}

/* Going back, the card brought from the rear grows into the front as the old one flies off. */
.med-stack__card--enter {
  animation: stack-enter 420ms var(--stack-ease);
}

@keyframes stack-leave {
  0% {
    transform: translate3d(calc(var(--swing-from) * 1px), 0, 0) scale(1)
      rotate(calc(var(--swing-from) * 0.012deg));
    opacity: 1;
    z-index: 50;
  }
  44% {
    transform: translate3d(calc(var(--away) * 70%), 0, 0) scale(0.96)
      rotate(calc(var(--away) * 7deg));
    opacity: 0;
    z-index: 50;
  }
  45% {
    transform: translate3d(0, calc(var(--depth) * var(--peek)), 0)
      scale(calc(1 - var(--depth) * 0.045));
    opacity: 0;
    z-index: 0;
  }
  100% {
    transform: translate3d(0, calc(var(--depth) * var(--peek)), 0)
      scale(calc(1 - var(--depth) * 0.045));
    opacity: var(--shown);
    z-index: 0;
  }
}

@keyframes stack-enter {
  0% {
    transform: translate3d(0, var(--peek), 0) scale(0.94);
    opacity: 0;
  }
  /*
   * A quick fade: solid within the first quarter, so the cards behind barely show through it
   * and the old front card never does when it settles in behind.
   */
  25% {
    opacity: 1;
  }
  100% {
    transform: translate3d(0, 0, 0) scale(1);
    opacity: 1;
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

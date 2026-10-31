<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { BMI_BANDS, BMI_SOURCE } from '@/domain/body'
import {
  decimalsFor,
  fromA1cPercent,
  fromMgDl,
  GLUCOSE_CONTEXT_LABELS,
  GLUCOSE_UNIT_SOURCES,
} from '@/domain/glucose'
import { fromKg } from '@/domain/units'
import { spreadEvenly, valueAt } from '@/domain/photos'
import { useJournalStore } from '@/stores/journal'
import { usePhotosStore } from '@/stores/photos'
import { useChartColors } from '@/composables/useChartColors'
import { usePhotoPins } from '@/composables/usePhotoPins'
import PhotoDialog from '@/components/photos/PhotoDialog.vue'
import type { PhotoRow } from '@/db/database'
import { useSettingsStore } from '@/stores/settings'
import { useBodyMetrics } from '@/composables/useBodyMetrics'
import { toEpochMs } from '@/services/time'
import { mdiImageOutline, mdiShareVariantOutline } from '@/plugins/icons'
import SourceList from '@/components/common/SourceList.vue'
import BodyChart from './BodyChart.vue'
import ShareTrendDialog from '@/components/share/ShareTrendDialog.vue'

/**
 * Every body measure over time in one card: weight, BMI, HbA1c and glucose. Glucose draws
 * fasting readings as the line and readings from other times of day as separate points, since
 * they are not comparable with each other. Whatever is shown can be shared as an image.
 * Progress photos can be pinned to the weight line, at the date each was taken.
 */
type TrendMeasure = 'weight' | 'bmi' | 'a1c' | 'glucose'

defineProps<{ now: number }>()

const journal = useJournalStore()
const settings = useSettingsStore()
const body = useBodyMetrics()
const labelId = useId()
const shareOpen = ref(false)

const a1c = computed(() => journal.glucose.filter((g) => g.kind === 'a1c'))
const glucose = computed(() => journal.glucose.filter((g) => g.kind === 'glucose'))

const MEASURES = computed(() =>
  (
    [
      { value: 'weight', label: 'Weight', on: journal.weights.length > 0 },
      { value: 'bmi', label: 'BMI', on: body.bmiSeries.value.length > 0 },
      { value: 'a1c', label: 'HbA1c', on: a1c.value.length > 0 },
      { value: 'glucose', label: 'Glucose', on: glucose.value.length > 0 },
    ] as const
  ).filter((m) => m.on),
)

const mode = ref<TrendMeasure>('weight')
// Fall back to the first measure with data when the chosen one has none (a deleted reading).
watch(
  MEASURES,
  (list) => {
    if (list.length && !list.some((m) => m.value === mode.value)) mode.value = list[0]!.value
  },
  { immediate: true },
)

const TITLES: Record<TrendMeasure, string> = {
  weight: 'Weight',
  bmi: 'Body mass index',
  a1c: 'HbA1c',
  glucose: 'Glucose',
}

/** Band edges near the user's own values, so the axis is not stretched to far-off lines. */
const bmiGuides = computed(() => {
  if (!body.bmiSeries.value.length) return []
  const values = body.bmiSeries.value.map((p) => p.value)
  const lo = Math.min(...values) - 4
  const hi = Math.max(...values) + 4
  return BMI_BANDS.filter((b) => b.from > 0 && b.from >= lo && b.from <= hi).map((b) => ({
    value: b.from,
    label: `${b.from}`,
  }))
})

const oldestFirst = <T extends { at: number }>(list: T[]) => [...list].sort((a, b) => a.at - b.at)

/** What the chart draws for the chosen measure, in the user's display units. */
const chart = computed(() => {
  switch (mode.value) {
    case 'bmi':
      return {
        points: body.bmiSeries.value,
        unitLabel: '',
        measure: 'BMI',
        decimals: 1,
        guides: bmiGuides.value,
      }
    case 'a1c':
      return {
        points: oldestFirst(
          a1c.value.map((g) => ({
            at: toEpochMs(g.measuredAt),
            value: fromA1cPercent(g.value, settings.a1cUnit),
          })),
        ),
        unitLabel: settings.a1cUnit,
        measure: 'HbA1c',
        decimals: decimalsFor(settings.a1cUnit),
        guides: [],
      }
    case 'glucose': {
      const toPoint = (g: (typeof glucose.value)[number]) => ({
        at: toEpochMs(g.measuredAt),
        value: fromMgDl(g.value, settings.glucoseUnit),
        note: g.kind === 'glucose' ? GLUCOSE_CONTEXT_LABELS[g.context] : undefined,
      })
      const fasting = glucose.value.filter((g) => g.kind === 'glucose' && g.context === 'fasting')
      const other = glucose.value.filter((g) => g.kind === 'glucose' && g.context !== 'fasting')
      return {
        points: oldestFirst(fasting.map(toPoint)),
        secondary: other.length
          ? { name: 'Other times', points: oldestFirst(other.map(toPoint)) }
          : undefined,
        unitLabel: settings.glucoseUnit,
        measure: 'Fasting glucose',
        decimals: decimalsFor(settings.glucoseUnit),
        guides: [],
      }
    }
    default: {
      const goal = settings.profile.goalKg
      return {
        points: oldestFirst(
          journal.weights.map((w) => ({
            at: toEpochMs(w.measuredAt),
            value: fromKg(w.kg, settings.weightUnit),
          })),
        ),
        unitLabel: settings.weightUnit,
        measure: 'Weight',
        decimals: 1,
        guides: goal ? [{ value: fromKg(goal, settings.weightUnit), label: 'Goal' }] : [],
      }
    }
  }
})

const photosStore = usePhotosStore()
const { colors } = useChartColors()
const showPhotos = ref(true)
const viewing = ref<PhotoRow | null>(null)
const photoOpen = ref(false)

/** A phone-width chart fits about this many pins before they hide each other. */
const MAX_PINS = 7

/** Photos taken within the weigh-ins' span, thinned evenly, each at the line's height then. */
const pinned = computed(() => {
  if (mode.value !== 'weight') return []
  const line = chart.value.points
  const onLine = [...photosStore.photos]
    .reverse()
    .map((p) => ({
      id: p.id,
      at: toEpochMs(p.takenAt),
      value: valueAt(line, toEpochMs(p.takenAt)),
    }))
    .filter((p): p is { id: string; at: number; value: number } => p.value !== null)
  return spreadEvenly(onLine, MAX_PINS)
})
const canPin = computed(() => pinned.value.length > 0)

const { pins } = usePhotoPins(
  () => pinned.value.map((p) => p.id),
  () => ({ surface: colors.value.surface, text: colors.value.text }),
)

const chartPhotos = computed(() =>
  showPhotos.value
    ? pinned.value.flatMap((p) => (pins.value[p.id] ? [{ ...p, symbol: pins.value[p.id]! }] : []))
    : [],
)

function openPhoto(id: string) {
  const photo = photosStore.photos.find((p) => p.id === id)
  if (!photo) return
  viewing.value = photo
  photoOpen.value = true
}

const convertedUnits = computed(
  () =>
    (mode.value === 'a1c' && settings.a1cUnit !== '%') ||
    (mode.value === 'glucose' && settings.glucoseUnit !== 'mg/dL'),
)
</script>

<template>
  <v-card v-if="MEASURES.length">
    <v-card-item>
      <p class="gl-eyebrow">Trend</p>
      <v-card-title>{{ TITLES[mode] }}</v-card-title>
      <template #append>
        <v-btn
          :icon="mdiShareVariantOutline"
          variant="text"
          :aria-label="`Share ${TITLES[mode].toLowerCase()} as an image`"
          @click="shareOpen = true"
        />
      </template>
    </v-card-item>
    <v-card-text class="gl-stack">
      <div v-if="MEASURES.length > 1 || canPin" class="trend-controls">
        <p :id="labelId" class="d-sr-only">Measure</p>
        <v-btn-toggle
          v-if="MEASURES.length > 1"
          v-model="mode"
          role="group"
          mandatory
          density="comfortable"
          :aria-labelledby="labelId"
          class="gl-toggle-wrap"
        >
          <v-btn v-for="m in MEASURES" :key="m.value" :value="m.value">{{ m.label }}</v-btn>
        </v-btn-toggle>
        <v-btn
          v-if="canPin"
          :prepend-icon="mdiImageOutline"
          :variant="showPhotos ? 'tonal' : 'outlined'"
          :aria-pressed="showPhotos"
          @click="showPhotos = !showPhotos"
        >
          Photos
        </v-btn>
      </div>
      <BodyChart
        :points="chart.points"
        :secondary="chart.secondary"
        :unit-label="chart.unitLabel"
        :measure="chart.measure"
        :decimals="chart.decimals"
        :guides="chart.guides"
        :photos="chartPhotos"
        @photo="openPhoto"
      />
      <p v-if="chartPhotos.length" class="text-body-small gl-muted">Tap a photo to open it.</p>
      <p v-if="mode === 'glucose' && !chart.points.length" class="text-body-small gl-muted">
        No fasting readings yet; readings from other times of day show as points.
      </p>
      <template v-if="mode === 'bmi'">
        <p class="text-body-small gl-muted">
          Dashed lines are the WHO adult bands. BMI is a screening measure and doesn't tell muscle
          from fat.
        </p>
        <SourceList :sources="[BMI_SOURCE]" />
      </template>
      <SourceList v-if="convertedUnits" :sources="GLUCOSE_UNIT_SOURCES" />
      <p v-if="mode === 'weight' && !body.heightCm.value" class="text-body-small gl-muted">
        Add your height in Settings to track BMI.
      </p>
    </v-card-text>
    <ShareTrendDialog v-model="shareOpen" :measure="mode" :now="now" :photos="pinned" />
    <PhotoDialog v-model="photoOpen" :photo="viewing" :prepared="null" taken-at="" />
  </v-card>
</template>

<style scoped>
.trend-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
</style>

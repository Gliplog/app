<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { ADULT_AGE, BMI_BANDS, BMI_SOURCE } from '@/domain/body'
import {
  decimalsFor,
  fromA1cPercent,
  fromMgDl,
  GLUCOSE_CONTEXT_LABELS,
  GLUCOSE_UNIT_SOURCES,
} from '@/domain/glucose'
import { fromKg } from '@/domain/units'
import { useJournalStore } from '@/stores/journal'
import { useSettingsStore } from '@/stores/settings'
import { useBodyMetrics } from '@/composables/useBodyMetrics'
import { toEpochMs } from '@/services/time'
import { mdiShareVariantOutline } from '@/plugins/icons'
import SourceList from '@/components/common/SourceList.vue'
import BodyChart from './BodyChart.vue'
import ShareTrendDialog from '@/components/share/ShareTrendDialog.vue'

/**
 * Every body measure over time in one card: weight, BMI, HbA1c and glucose. Glucose draws
 * fasting readings as the line and readings from other times of day as separate points, since
 * they are not comparable with each other. Whatever is shown can be shared as an image.
 */
type TrendMeasure = 'weight' | 'bmi' | 'a1c' | 'glucose'

const props = defineProps<{ now: number }>()

const journal = useJournalStore()
const settings = useSettingsStore()
const body = useBodyMetrics(() => props.now)
const labelId = useId()
const shareOpen = ref(false)

const a1c = computed(() => journal.glucose.filter((g) => g.kind === 'a1c'))
const glucose = computed(() => journal.glucose.filter((g) => g.kind === 'glucose'))

const MEASURES = computed(() =>
  (
    [
      { value: 'weight', label: 'Weight', on: journal.weights.length > 0 },
      { value: 'bmi', label: 'BMI', on: journal.weights.length > 0 && !!body.heightCm.value },
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

const adult = computed(() => body.age.value === null || body.age.value >= ADULT_AGE)

/** Band edges near the user's own values, so the axis is not stretched to far-off lines. */
const bmiGuides = computed(() => {
  if (!adult.value || !body.bmiSeries.value.length) return []
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
      <div v-if="MEASURES.length > 1">
        <p :id="labelId" class="d-sr-only">Measure</p>
        <v-btn-toggle
          v-model="mode"
          role="group"
          mandatory
          density="comfortable"
          :aria-labelledby="labelId"
          class="trend-toggle"
        >
          <v-btn v-for="m in MEASURES" :key="m.value" :value="m.value">{{ m.label }}</v-btn>
        </v-btn-toggle>
      </div>
      <BodyChart
        :points="chart.points"
        :secondary="chart.secondary"
        :unit-label="chart.unitLabel"
        :measure="chart.measure"
        :decimals="chart.decimals"
        :guides="chart.guides"
      />
      <p v-if="mode === 'glucose' && !chart.points.length" class="text-body-small gl-muted">
        No fasting readings yet; readings from other times of day show as points.
      </p>
      <template v-if="mode === 'bmi'">
        <p v-if="adult" class="text-body-small gl-muted">
          Dashed lines are the WHO adult bands. BMI is a screening measure and doesn't tell muscle
          from fat.
        </p>
        <p v-else class="text-body-small gl-muted">
          Adult BMI bands don't apply under {{ ADULT_AGE }}.
        </p>
        <SourceList :sources="[BMI_SOURCE]" />
      </template>
      <SourceList v-if="convertedUnits" :sources="GLUCOSE_UNIT_SOURCES" />
      <p v-if="mode === 'weight' && !body.heightCm.value" class="text-body-small gl-muted">
        Add your height in Settings to track BMI.
      </p>
    </v-card-text>
    <ShareTrendDialog v-model="shareOpen" :measure="mode" :now="now" />
  </v-card>
</template>

<style scoped>
/* Four measures wrap on a narrow phone rather than scroll the card sideways. */
.trend-toggle {
  flex-wrap: wrap;
  height: auto;
}
</style>

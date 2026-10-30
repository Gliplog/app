<script setup lang="ts">
import { computed } from 'vue'
import { POPULATION_LABELS } from '@/domain/catalog'
import type { ProgressPoint, TrialComparison } from '@/domain/progress'
import { formatPercentChange, formatWeightChange, roundTo, type WeightUnit } from '@/domain/units'
import SourceList from '@/components/common/SourceList.vue'
import CohortChart from './CohortChart.vue'

/**
 * The user's change beside one trial cohort's published endpoint results: a chart of the user's
 * journey with each arm at its endpoint week, then labelled bars at that week. The trial reports
 * one week, so no curve is invented between baseline and endpoint. Rows carry their value as
 * text, so identity never rests on colour or length.
 */
const props = defineProps<{
  comparison: TrialComparison
  /** The user's progress from week 0 of this medicine, for the chart. */
  series: ProgressPoint[]
  weightUnit: WeightUnit
  /** What the user's row says when it has no value yet ("Log a dose to compare"). */
  missingText: string
}>()

const trial = computed(() => props.comparison.trial)

const format = (change: number) =>
  trial.value.measure === 'percent'
    ? formatPercentChange(change)
    : formatWeightChange(change, props.weightUnit)

interface Row {
  key: string
  label: string
  change: number | null
  you: boolean
  yourDose: boolean
  placebo: boolean
}

const rows = computed<Row[]>(() => {
  const { userChange, user, matchingArm } = props.comparison
  const arms: Row[] = trial.value.arms.map((a) => ({
    key: a.label,
    label: a.label,
    change: a.change,
    you: false,
    yourDose: a === matchingArm,
    placebo: a.doseMg === null,
  }))
  const youLabel = user ? `You, week ${Math.floor(user.weeks)}` : 'You'
  return [
    { key: 'you', label: youLabel, change: userChange, you: true, yourDose: false, placebo: false },
    ...arms,
  ]
})

/** Bars scale to the largest loss shown; a gain draws no bar and reads as "+". */
const scale = computed(() =>
  Math.max(1e-9, ...rows.value.map((r) => (r.change !== null && r.change < 0 ? -r.change : 0))),
)

const barWidth = (change: number | null) =>
  change !== null && change < 0 ? `${roundTo((-change / scale.value) * 100, 1)}%` : '0%'
</script>

<template>
  <v-card>
    <v-card-item>
      <p class="tb-eyebrow">Trial cohort</p>
      <v-card-title class="text-wrap">{{ trial.name }} · {{ trial.weeks }} weeks</v-card-title>
    </v-card-item>
    <v-card-text class="tb-stack">
      <div class="d-flex flex-wrap ga-2">
        <span class="tb-badge tb-badge--info">{{ POPULATION_LABELS[trial.population] }}</span>
        <span class="tb-badge tb-badge--brand">
          {{ trial.measure === 'percent' ? 'Percent of starting weight' : 'Kilograms' }}
        </span>
      </div>
      <p class="text-body-medium tb-muted">{{ trial.design }}.</p>

      <CohortChart :trial="trial" :series="series" :weight-unit="weightUnit" />

      <ul class="bars" :aria-label="`Average weight change at week ${trial.weeks}, and yours`">
        <li
          v-for="row in rows"
          :key="row.key"
          :class="['bar', { 'bar--you': row.you, 'bar--placebo': row.placebo }]"
        >
          <span class="bar__label">
            {{ row.label }}
            <span v-if="row.yourDose" class="tb-badge tb-badge--good">Your dose</span>
          </span>
          <span class="bar__track" aria-hidden="true">
            <span class="bar__fill" :style="{ width: barWidth(row.change) }" />
          </span>
          <span class="bar__value tb-num">
            {{ row.change === null ? missingText : format(row.change) }}
          </span>
        </li>
      </ul>

      <p class="text-body-small tb-muted">
        Trial rows are group averages at week {{ trial.weeks }}. Yours is your latest weigh-in up to
        week {{ trial.weeks }} after your first dose.
        <template v-if="trial.measure === 'kg'">This trial reports weight, not percent.</template>
      </p>
      <p class="text-body-small tb-faint">{{ trial.analysis }}</p>
      <SourceList :sources="[trial.source]" />
    </v-card-text>
  </v-card>
</template>

<style scoped>
.bars {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'label value'
    'track track';
  gap: 4px 12px;
  align-items: center;
}

.bar__label {
  grid-area: label;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
}

.bar__value {
  grid-area: value;
  font-weight: 600;
}

.bar__track {
  grid-area: track;
  height: 10px;
  border-radius: var(--tb-radius-pill);
  background: var(--tb-surface-sunk);
  overflow: hidden;
}

.bar__fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--tb-chart-trial);
}

.bar--you .bar__label {
  font-weight: 700;
}

.bar--placebo .bar__fill {
  background: var(--tb-chart-placebo);
}

/* Your row is solid brand and set apart by weight and position, not colour alone. */
.bar--you .bar__fill {
  background: var(--tb-chart-logged);
}
</style>

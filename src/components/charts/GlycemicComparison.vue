<script setup lang="ts">
import { computed } from 'vue'
import { POPULATION_LABELS } from '@/domain/catalog'
import {
  formatA1c,
  formatA1cChange,
  formatGlucose,
  formatGlucoseChange,
  type A1cUnit,
  type GlycemicComparison,
  type GlucoseUnit,
} from '@/domain/glucose'
import { roundTo } from '@/domain/units'
import SourceList from '@/components/common/SourceList.vue'

/**
 * The user's HbA1c or fasting glucose change beside one trial cohort's published endpoint
 * changes, as labelled bars with their values in text. Starting values sit beside each row,
 * because a cohort that began at 8% and one that began at 5.7% change very differently.
 */
const props = defineProps<{
  comparison: GlycemicComparison
  a1cUnit: A1cUnit
  glucoseUnit: GlucoseUnit
  /** What the user's row says when it has no value yet. */
  missingText: string
}>()

const trial = computed(() => props.comparison.trial)
const isA1c = computed(() => props.comparison.measure === 'hba1c')
const measureName = computed(() =>
  isA1c.value ? 'HbA1c' : (trial.value.glycemic?.fastingGlucoseLabel ?? 'Fasting glucose'),
)

const fmtChange = (change: number) =>
  isA1c.value
    ? formatA1cChange(change, props.a1cUnit)
    : formatGlucoseChange(change, props.glucoseUnit)
const fmtValue = (value: number) =>
  isA1c.value ? formatA1c(value, props.a1cUnit) : formatGlucose(value, props.glucoseUnit)

interface Row {
  key: string
  label: string
  start: number | null
  change: number | null
  you: boolean
  placebo: boolean
}

const rows = computed<Row[]>(() => {
  const { user, baseline, arms } = props.comparison
  return [
    {
      key: 'you',
      label: user ? `You, week ${Math.floor(user.weeks)}` : 'You',
      start: baseline?.value ?? null,
      change: user?.change ?? null,
      you: true,
      placebo: false,
    },
    ...arms.map((a) => ({
      key: a.label,
      label: a.label,
      start: a.baseline,
      change: a.change,
      you: false,
      placebo: a.placebo,
    })),
  ]
})

/** Bars scale to the largest fall shown; a rise draws no bar and reads as "+". */
const scale = computed(() =>
  Math.max(1e-9, ...rows.value.map((r) => (r.change !== null && r.change < 0 ? -r.change : 0))),
)
const barWidth = (change: number | null) =>
  change !== null && change < 0 ? `${roundTo((-change / scale.value) * 100, 1)}%` : '0%'
</script>

<template>
  <v-card>
    <v-card-item>
      <p class="tb-eyebrow">Trial cohort · {{ measureName }}</p>
      <v-card-title class="text-wrap">{{ trial.name }} · {{ trial.weeks }} weeks</v-card-title>
    </v-card-item>
    <v-card-text class="tb-stack">
      <div class="d-flex flex-wrap ga-2">
        <span class="tb-badge tb-badge--info">{{ POPULATION_LABELS[trial.population] }}</span>
      </div>
      <ul
        class="bars"
        :aria-label="`Average ${measureName} change at week ${trial.weeks}, and yours`"
      >
        <li
          v-for="row in rows"
          :key="row.key"
          :class="['bar', { 'bar--you': row.you, 'bar--placebo': row.placebo }]"
        >
          <span class="bar__label">
            {{ row.label }}
            <span v-if="row.start !== null" class="tb-faint text-body-small tb-num"
              >from {{ fmtValue(row.start) }}</span
            >
          </span>
          <span class="bar__track" aria-hidden="true">
            <span class="bar__fill" :style="{ width: barWidth(row.change) }" />
          </span>
          <span class="bar__value tb-num">
            {{ row.change === null ? missingText : fmtChange(row.change) }}
          </span>
        </li>
      </ul>
      <p class="text-body-small tb-muted">
        Trial rows are group averages at week {{ trial.weeks }}, from each group's average starting
        value. Yours is your latest {{ isA1c ? 'HbA1c' : 'fasting glucose' }} up to week
        {{ trial.weeks }}, from your reading nearest your first dose.
        <template v-if="comparison.baseline?.basis === 'after-first-dose'"
          >Your first reading came after your first dose, so some change may be missing.</template
        >
      </p>
      <SourceList v-if="trial.glycemic" :sources="[trial.glycemic.source]" />
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
  align-items: baseline;
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

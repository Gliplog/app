<script setup lang="ts">
import { computed, ref } from 'vue'
import { findPkProfile, trialsFor } from '@/data'
import { ADULT_AGE, BMI_BANDS, BMI_SOURCE } from '@/domain/body'
import { compareToTrial } from '@/domain/progress'
import {
  formatPercentChange,
  formatWeight,
  formatWeightChange,
  fromKg,
  roundTo,
} from '@/domain/units'
import { useJournalStore } from '@/stores/journal'
import { useSettingsStore } from '@/stores/settings'
import { useNow } from '@/composables/useNow'
import { useBodyMetrics } from '@/composables/useBodyMetrics'
import { formatDate, toEpochMs } from '@/services/time'
import BodyChart from '@/components/charts/BodyChart.vue'
import TrialComparison from '@/components/charts/TrialComparison.vue'
import PkPanel from '@/components/charts/PkPanel.vue'
import SourceList from '@/components/common/SourceList.vue'

const journal = useJournalStore()
const settings = useSettingsStore()
const now = useNow()
const body = useBodyMetrics(() => now.value)

const mode = ref<'weight' | 'bmi'>('weight')
const allTrials = ref(false)

/** Trials beyond the first two are folded away; the product lists the most relevant first. */
const TRIALS_SHOWN = 2

const baseline = computed(() => journal.baseline)
const last = computed(() => journal.progress[journal.progress.length - 1])

const weightPoints = computed(() =>
  [...journal.weights]
    .reverse()
    .map((w) => ({ at: toEpochMs(w.measuredAt), value: fromKg(w.kg, settings.weightUnit) })),
)

const weightGuides = computed(() => {
  const goal = settings.profile.goalKg
  return goal ? [{ value: fromKg(goal, settings.weightUnit), label: 'Goal' }] : []
})

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

const product = computed(() => journal.productOf(journal.currentMedication))
const currentDose = computed(() => {
  const med = journal.currentMedication
  const dose = med ? journal.lastDoseOf(med.id) : undefined
  return product.value && dose ? { molecule: product.value.molecule, doseMg: dose.doseMg } : null
})

/*
 * Trials count weeks from the first dose, so the user's row needs a dose and a weigh-in; until
 * then the card shows the trial alone with a prompt for what is missing.
 */
const comparable = computed(() => baseline.value !== null && baseline.value.basis !== 'no-doses')
const missingForComparison = computed(() =>
  !journal.doses.length ? 'Log a dose to compare' : 'Log a weight to compare',
)
const comparisons = computed(() =>
  trialsFor(product.value).map((t) =>
    compareToTrial(comparable.value ? journal.progress : [], t, currentDose.value),
  ),
)
const shownComparisons = computed(() =>
  allTrials.value ? comparisons.value : comparisons.value.slice(0, TRIALS_SHOWN),
)

const basisNote = computed(() => {
  switch (baseline.value?.basis) {
    case 'before-first-dose':
      return 'Your last weigh-in on or before your first dose, as trials measure it.'
    case 'after-first-dose':
      return 'Your first weigh-in after your first dose. Add an earlier one for a closer comparison.'
    case 'no-doses':
      return 'Your first weigh-in. Log a dose to count weeks from it.'
    default:
      return ''
  }
})
</script>

<template>
  <div class="tb-page">
    <header class="mb-4">
      <p class="tb-eyebrow">Over time</p>
      <h1 class="tb-display text-headline-large">Progress</h1>
    </header>

    <v-alert v-if="!journal.weights.length" type="info" variant="tonal" class="mb-4">
      Log a weight on Today to start your progress chart.
    </v-alert>

    <div class="progress-grid">
      <v-card v-if="baseline">
        <v-card-item>
          <p class="tb-eyebrow">Since you started</p>
          <v-card-title class="tb-num">
            {{ last ? formatWeightChange(last.changeKg, settings.weightUnit) : '0' }}
            <span v-if="last" class="tb-muted text-title-medium">
              {{ formatPercentChange(last.changePercent) }}
            </span>
          </v-card-title>
        </v-card-item>
        <v-card-text class="tb-stack">
          <dl class="stats">
            <div>
              <dt class="tb-faint">Start</dt>
              <dd class="tb-num">
                {{ formatWeight(baseline.kg, settings.weightUnit) }}
                <span class="tb-faint">· {{ formatDate(baseline.at) }}</span>
              </dd>
            </div>
            <div v-if="last">
              <dt class="tb-faint">Latest</dt>
              <dd class="tb-num">{{ formatWeight(last.kg, settings.weightUnit) }}</dd>
            </div>
            <div v-if="last && baseline.basis !== 'no-doses'">
              <dt class="tb-faint">Weeks since first dose</dt>
              <dd class="tb-num">{{ roundTo(last.weeks, 1) }}</dd>
            </div>
          </dl>
          <p class="text-body-small tb-muted">{{ basisNote }}</p>
        </v-card-text>
      </v-card>

      <v-card v-if="journal.weights.length">
        <v-card-item>
          <p class="tb-eyebrow">Trend</p>
          <v-card-title>{{ mode === 'weight' ? 'Weight' : 'Body mass index' }}</v-card-title>
          <template #append>
            <v-btn-toggle
              v-model="mode"
              role="group"
              mandatory
              density="compact"
              aria-label="Measure"
            >
              <v-btn value="weight">Weight</v-btn>
              <v-btn value="bmi" :disabled="!body.heightCm.value">BMI</v-btn>
            </v-btn-toggle>
          </template>
        </v-card-item>
        <v-card-text class="tb-stack">
          <BodyChart
            v-if="mode === 'weight'"
            :points="weightPoints"
            :unit-label="settings.weightUnit"
            measure="Weight"
            :decimals="1"
            :guides="weightGuides"
          />
          <template v-else>
            <BodyChart
              :points="body.bmiSeries.value"
              unit-label=""
              measure="BMI"
              :decimals="1"
              :guides="bmiGuides"
            />
            <p v-if="adult" class="text-body-small tb-muted">
              Dashed lines are the WHO adult bands. BMI is a screening measure and doesn't tell
              muscle from fat.
            </p>
            <p v-else class="text-body-small tb-muted">
              Adult BMI bands don't apply under {{ ADULT_AGE }}.
            </p>
            <SourceList :sources="[BMI_SOURCE]" />
          </template>
          <p v-if="!body.heightCm.value" class="text-body-small tb-muted">
            Add your height in Settings to track BMI.
          </p>
        </v-card-text>
      </v-card>
    </div>

    <section v-if="product" class="mt-6">
      <h2 class="tb-display text-title-large mb-1">Compared with clinical trials</h2>
      <p class="tb-muted mb-4 section-intro">
        Your change beside the published averages for {{ product.name }}.
        <template v-if="product.kind === 'compounded'"
          >These trials used the brand product.</template
        >
      </p>
      <template v-if="comparisons.length">
        <div class="progress-grid">
          <TrialComparison
            v-for="c in shownComparisons"
            :key="c.trial.id"
            :comparison="c"
            :weight-unit="settings.weightUnit"
            :missing-text="missingForComparison"
          />
        </div>
        <div v-if="comparisons.length > TRIALS_SHOWN" class="mt-2">
          <v-btn variant="text" @click="allTrials = !allTrials">
            {{
              allTrials
                ? 'Show fewer trials'
                : `Show ${comparisons.length - TRIALS_SHOWN} more trials`
            }}
          </v-btn>
        </div>
      </template>
      <v-alert v-else type="info" variant="tonal">
        Tidebook doesn't have trial weight results for {{ product.name }} yet.
      </v-alert>
    </section>

    <section v-if="journal.levelGroups.length" class="mt-6">
      <h2 class="tb-display text-title-large mb-4">Estimated levels</h2>
      <div class="progress-grid">
        <PkPanel
          v-for="g in journal.levelGroups"
          :key="g.key"
          :profile="findPkProfile(g.pkProfile)"
          :override="g.pk?.userSupplied ? g.pk.params : null"
          :doses="g.doses"
          :preview="null"
          :now="now"
          :title="g.label"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.progress-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 400px), 1fr));
  align-items: start;
}

.section-intro {
  max-width: 70ch;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px 24px;
  margin: 0;
}

.stats dt {
  font-size: 0.75rem;
  font-weight: 600;
}

.stats dd {
  margin: 0;
  font-weight: 600;
}
</style>

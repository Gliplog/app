<script setup lang="ts">
import { computed, ref } from 'vue'
import { findPkProfile, trialsFor } from '@/data'
import { ADULT_AGE, BMI_BANDS, BMI_SOURCE } from '@/domain/body'
import { baselineFor, compareToTrial, progressSeries } from '@/domain/progress'
import type { CatalogProduct } from '@/domain/catalog'
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
import GlycemicComparison from '@/components/charts/GlycemicComparison.vue'
import SymptomSummaryCard from '@/components/journal/SymptomSummaryCard.vue'
import {
  compareGlycemic,
  fromA1cPercent,
  fromMgDl,
  GLUCOSE_UNIT_SOURCES,
  type GlycemicMeasure,
} from '@/domain/glucose'
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

/**
 * Catalog products the user has added, in use first, once each: the choices for the cohort
 * comparison. Two medications of the same product (a pen and a refill) are one choice.
 */
const cohortProducts = computed<CatalogProduct[]>(() => {
  const seen = new Map<string, CatalogProduct>()
  for (const med of [...journal.activeMedications, ...journal.archivedMedications]) {
    const p = journal.productOf(med)
    if (p && !seen.has(p.id)) seen.set(p.id, p)
  }
  return [...seen.values()]
})

/** Starts on the medication in front on Today, and can be switched here. */
const chosenProductId = ref<string | null>(null)
const product = computed(
  () =>
    cohortProducts.value.find((p) => p.id === chosenProductId.value) ??
    journal.productOf(journal.focusedMedication) ??
    cohortProducts.value[0],
)
const productModel = computed({
  get: () => product.value?.id,
  set: (id: string | undefined) => (chosenProductId.value = id ?? null),
})

/*
 * Trials count weeks from the first dose of the medicine they studied, so the comparison does
 * too: someone who moved from semaglutide to tirzepatide is set beside SURMOUNT from their first
 * tirzepatide dose, and beside STEP from their first semaglutide dose. Brands and compounded
 * versions of one medicine pool, as their levels do.
 */
const cohortGroup = computed(() =>
  journal.levelGroups.find((g) => g.pkProfile === product.value?.pkProfile),
)
const kgPoints = computed(() =>
  journal.weights.map((w) => ({ at: toEpochMs(w.measuredAt), kg: w.kg })),
)
const cohortBaseline = computed(() =>
  baselineFor(kgPoints.value, cohortGroup.value?.doses[0]?.at ?? null),
)
const cohortSeries = computed(() =>
  cohortBaseline.value && cohortBaseline.value.basis !== 'no-doses'
    ? progressSeries(kgPoints.value, cohortBaseline.value)
    : [],
)

/** The latest dose of the chosen product, so the matching trial arm can be marked. */
const currentDose = computed(() => {
  const p = product.value
  if (!p) return null
  const dose = journal.doses.find((d) => journal.medicationById(d.medicationId)?.productId === p.id)
  return dose ? { molecule: p.molecule, doseMg: dose.doseMg } : null
})

/*
 * The user's row needs a dose of this medicine and a weigh-in; until then the card shows the
 * trial alone with a prompt for what is missing.
 */
const missingForComparison = computed(() =>
  !cohortGroup.value
    ? `Log a dose of ${product.value?.name ?? 'this medication'} to compare`
    : 'Log a weight to compare',
)
const comparisons = computed(() =>
  trialsFor(product.value).map((t) => compareToTrial(cohortSeries.value, t, currentDose.value)),
)
const cohortStartText = computed(() => {
  const b = cohortBaseline.value
  if (!b || b.basis === 'no-doses' || !product.value) return ''
  return `Week 0 is your first ${product.value.molecule} dose on ${formatDate(b.startAt)}; your change counts from ${formatWeight(b.kg, settings.weightUnit)}.`
})
const shownComparisons = computed(() =>
  allTrials.value ? comparisons.value : comparisons.value.slice(0, TRIALS_SHOWN),
)

/*
 * Blood sugar: HbA1c, or fasting glucose (the only readings trials report), set beside the
 * chosen medication's trials that print them, from week 0 of that medicine.
 */
const glycemicMeasure = ref<GlycemicMeasure>('hba1c')
const allGlycemic = ref(false)
const a1cReadings = computed(() =>
  journal.glucose
    .filter((g) => g.kind === 'a1c')
    .map((g) => ({ at: toEpochMs(g.measuredAt), value: g.value })),
)
const fastingReadings = computed(() =>
  journal.glucose
    .filter((g) => g.kind === 'glucose' && g.context === 'fasting')
    .map((g) => ({ at: toEpochMs(g.measuredAt), value: g.value })),
)
const glycemicPoints = computed(() =>
  [...(glycemicMeasure.value === 'hba1c' ? a1cReadings.value : fastingReadings.value)]
    .sort((a, b) => a.at - b.at)
    .map((r) => ({
      at: r.at,
      value:
        glycemicMeasure.value === 'hba1c'
          ? fromA1cPercent(r.value, settings.a1cUnit)
          : fromMgDl(r.value, settings.glucoseUnit),
    })),
)
const glycemicComparisons = computed(() =>
  trialsFor(product.value).flatMap((t) => {
    const c = compareGlycemic(
      glycemicMeasure.value === 'hba1c' ? a1cReadings.value : fastingReadings.value,
      cohortGroup.value?.doses[0]?.at ?? null,
      t,
      glycemicMeasure.value,
    )
    return c ? [c] : []
  }),
)
const shownGlycemic = computed(() =>
  allGlycemic.value ? glycemicComparisons.value : glycemicComparisons.value.slice(0, TRIALS_SHOWN),
)
const missingGlycemic = computed(() =>
  !cohortGroup.value
    ? `Log a dose of ${product.value?.name ?? 'this medication'} to compare`
    : glycemicMeasure.value === 'hba1c'
      ? 'Log a later HbA1c to compare'
      : 'Log a later fasting glucose to compare',
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
      <h2 class="tb-display text-title-large mb-1">Compared with trial cohorts</h2>
      <p class="tb-muted mb-4 section-intro">
        Your journey beside the published averages of people who took {{ product.name }} in its
        trials. A reference, not a target: everyone's path is different.
        <template v-if="product.kind === 'compounded'"
          >These trials used the brand product.</template
        >
      </p>
      <div v-if="cohortProducts.length > 1" class="mb-4">
        <p id="cohort-product-label" class="tb-label">Medication</p>
        <v-btn-toggle
          v-model="productModel"
          role="group"
          mandatory
          density="comfortable"
          aria-labelledby="cohort-product-label"
          class="cohort-toggle"
        >
          <v-btn v-for="p in cohortProducts" :key="p.id" :value="p.id">{{ p.name }}</v-btn>
        </v-btn-toggle>
      </div>
      <p v-if="cohortStartText" class="text-body-small tb-muted mb-4 section-intro">
        {{ cohortStartText }} Your weight reflects everything you take, not only {{ product.name }}.
      </p>
      <template v-if="comparisons.length">
        <div class="progress-grid">
          <TrialComparison
            v-for="c in shownComparisons"
            :key="c.trial.id"
            :comparison="c"
            :series="cohortSeries"
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

    <section v-if="journal.medications.length" id="side-effects" class="mt-6">
      <h2 class="tb-display text-title-large mb-4">Side effects</h2>
      <div class="progress-grid">
        <SymptomSummaryCard :now="now" />
      </div>
    </section>

    <section v-if="journal.glucose.length" id="blood-sugar" class="mt-6">
      <h2 class="tb-display text-title-large mb-1">Blood sugar</h2>
      <p class="tb-muted mb-4 section-intro">
        Your readings over time<template v-if="product">
          and beside trial cohorts for {{ product.name }}</template
        >. Only fasting glucose readings are compared, as trials measured them.
      </p>
      <div class="mb-4">
        <p id="glycemic-measure-label" class="tb-label">Measure</p>
        <v-btn-toggle
          v-model="glycemicMeasure"
          role="group"
          mandatory
          density="comfortable"
          aria-labelledby="glycemic-measure-label"
        >
          <v-btn value="hba1c">HbA1c</v-btn>
          <v-btn value="fastingGlucose">Fasting glucose</v-btn>
        </v-btn-toggle>
      </div>
      <div class="progress-grid">
        <v-card>
          <v-card-item>
            <p class="tb-eyebrow">Trend</p>
            <v-card-title>{{
              glycemicMeasure === 'hba1c' ? 'HbA1c' : 'Fasting glucose'
            }}</v-card-title>
          </v-card-item>
          <v-card-text class="tb-stack">
            <BodyChart
              v-if="glycemicPoints.length"
              :points="glycemicPoints"
              :unit-label="glycemicMeasure === 'hba1c' ? settings.a1cUnit : settings.glucoseUnit"
              :measure="glycemicMeasure === 'hba1c' ? 'HbA1c' : 'Fasting glucose'"
              :decimals="
                glycemicMeasure === 'hba1c'
                  ? settings.a1cUnit === '%'
                    ? 1
                    : 0
                  : settings.glucoseUnit === 'mg/dL'
                    ? 0
                    : 1
              "
              :guides="[]"
            />
            <p v-else class="tb-muted">
              No {{ glycemicMeasure === 'hba1c' ? 'HbA1c results' : 'fasting readings' }} yet.
            </p>
            <SourceList
              v-if="settings.a1cUnit !== '%' || settings.glucoseUnit !== 'mg/dL'"
              :sources="GLUCOSE_UNIT_SOURCES"
            />
          </v-card-text>
        </v-card>
        <GlycemicComparison
          v-for="c in shownGlycemic"
          :key="c.trial.id"
          :comparison="c"
          :a1c-unit="settings.a1cUnit"
          :glucose-unit="settings.glucoseUnit"
          :missing-text="missingGlycemic"
        />
      </div>
      <div v-if="glycemicComparisons.length > TRIALS_SHOWN" class="mt-2">
        <v-btn variant="text" @click="allGlycemic = !allGlycemic">
          {{
            allGlycemic
              ? 'Show fewer trials'
              : `Show ${glycemicComparisons.length - TRIALS_SHOWN} more trials`
          }}
        </v-btn>
      </div>
      <p
        v-if="product && !glycemicComparisons.length"
        class="text-body-small tb-muted mt-2 section-intro"
      >
        The {{ product.name }} label doesn't print
        {{ glycemicMeasure === 'hba1c' ? 'HbA1c' : 'fasting glucose' }} results for its trials.
      </p>
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

/* Many medications wrap rather than scroll the page sideways. */
.cohort-toggle {
  flex-wrap: wrap;
  height: auto;
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

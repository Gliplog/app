<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { catalog, findPkProfile, trialsFor } from '@/data'
import type { CatalogProduct } from '@/domain/catalog'
import {
  cohortMeasures,
  cohortReadouts,
  type CohortMeasure,
  type CohortPopulation,
} from '@/domain/cohort'
import { compareGlycemic, glycemicSeries } from '@/domain/glucose'
import { baselineFor, compareToTrial, progressSeries } from '@/domain/progress'
import { formatWeight } from '@/domain/units'
import { useJournalStore } from '@/stores/journal'
import { useSettingsStore } from '@/stores/settings'
import { formatDate, toEpochMs } from '@/services/time'
import SourceList from '@/components/common/SourceList.vue'
import CohortChart from './CohortChart.vue'
import GlycemicComparison from './GlycemicComparison.vue'
import TrialComparison from './TrialComparison.vue'

/**
 * The user's change beside every published readout for the chosen medicine, merged into one
 * chart over time, with each trial's own card below. Week 0 is the first dose of that medicine
 * (brand and compounded pooled), as the trials counted it.
 */
const journal = useJournalStore()
const settings = useSettingsStore()
const ids = { product: useId(), measure: useId(), population: useId() }

/** Catalog products the user has added, in use first, once each. */
const products = computed<CatalogProduct[]>(() => {
  const seen = new Map<string, CatalogProduct>()
  for (const med of [...journal.activeMedications, ...journal.archivedMedications]) {
    const p = journal.productOf(med)
    if (p && !seen.has(p.id)) seen.set(p.id, p)
  }
  return [...seen.values()]
})

/** Starts on the medication in front on Today. */
const chosenProductId = ref<string | null>(null)
const product = computed(
  () =>
    products.value.find((p) => p.id === chosenProductId.value) ??
    journal.productOf(journal.focusedMedication) ??
    products.value[0],
)
const productModel = computed({
  get: () => product.value?.id,
  set: (id: string | undefined) => (chosenProductId.value = id ?? null),
})
const medicineName = computed(
  () => findPkProfile(product.value?.pkProfile)?.name ?? product.value?.molecule ?? '',
)

const MEASURE_LABELS: Record<CohortMeasure, string> = {
  weight: 'Weight',
  hba1c: 'HbA1c',
  fastingGlucose: 'Fasting glucose',
}
const measures = computed(() =>
  product.value ? cohortMeasures(catalog.trials, product.value.molecule, product.value.route) : [],
)
const measure = ref<CohortMeasure>('weight')
watch(measures, (list) => {
  if (list.length && !list.includes(measure.value)) measure.value = list[0]!
})

const population = ref<CohortPopulation>('all')
const POPULATIONS: { value: CohortPopulation; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'obesity', label: 'Without diabetes' },
  { value: 't2d', label: 'Type 2 diabetes' },
]

const summary = computed(() =>
  product.value
    ? cohortReadouts(
        catalog.trials,
        product.value.molecule,
        product.value.route,
        measure.value,
        population.value,
      )
    : { readouts: [], band: [], sources: [] },
)
const hasT2dReadouts = computed(
  () =>
    !!product.value &&
    cohortReadouts(
      catalog.trials,
      product.value.molecule,
      product.value.route,
      measure.value,
      't2d',
    ).readouts.length > 0,
)

/** Offer the population filter only when both kinds of trial are present. */
const mixedPopulations = computed(() => {
  if (!product.value) return false
  const all = cohortReadouts(
    catalog.trials,
    product.value.molecule,
    product.value.route,
    measure.value,
  )
  return new Set(all.readouts.map((r) => r.population)).size > 1
})

/*
 * People without diabetes start near a normal HbA1c and glucose and barely change, so merging
 * them with diabetes trials draws a misleading path: blood sugar opens on the diabetes trials.
 * Weight opens on every trial, as one medicine's path over time.
 */
watch(
  [measure, product],
  () => {
    population.value = measure.value === 'weight' || !hasT2dReadouts.value ? 'all' : 't2d'
  },
  { immediate: true, flush: 'sync' },
)

const group = computed(() =>
  journal.levelGroups.find((g) => g.pkProfile === product.value?.pkProfile),
)
const firstDoseAt = computed(() => group.value?.doses[0]?.at ?? null)

const kgPoints = computed(() =>
  journal.weights.map((w) => ({ at: toEpochMs(w.measuredAt), kg: w.kg })),
)
const baseline = computed(() => baselineFor(kgPoints.value, firstDoseAt.value))
const weightSeries = computed(() =>
  baseline.value && baseline.value.basis !== 'no-doses'
    ? progressSeries(kgPoints.value, baseline.value)
    : [],
)
const readingsOf = (fasting: boolean) =>
  journal.glucose
    .filter((g) => (fasting ? g.kind === 'glucose' && g.context === 'fasting' : g.kind === 'a1c'))
    .map((g) => ({ at: toEpochMs(g.measuredAt), value: g.value }))

const userSeries = computed(() => {
  if (measure.value === 'weight') {
    return weightSeries.value.map((p) => ({ weeks: p.weeks, change: p.changePercent }))
  }
  return glycemicSeries(readingsOf(measure.value === 'fastingGlucose'), firstDoseAt.value)
})

const startText = computed(() => {
  const b = baseline.value
  if (firstDoseAt.value === null) {
    return `Log a dose of ${product.value?.name ?? 'this medication'} to add your own line.`
  }
  const when = formatDate(firstDoseAt.value)
  if (measure.value === 'weight' && b && b.basis !== 'no-doses') {
    return `Week 0 is your first ${product.value?.molecule} dose on ${when}, from ${formatWeight(b.kg, settings.weightUnit)}.`
  }
  return `Week 0 is your first ${product.value?.molecule} dose on ${when}.`
})

const hasDerived = computed(() => summary.value.readouts.some((r) => r.printedKg !== null))

const captionText = computed(() =>
  [
    startText.value,
    summary.value.band.length
      ? "Each point is one group's average at the final week of its trial; the shaded range joins those weeks."
      : "Each point is one group's average at the final week of its trial. These trials reported a single week, so no path is drawn.",
    hasDerived.value ? 'Hollow points are worked out from kilograms.' : '',
    population.value === 'all' && mixedPopulations.value
      ? measure.value === 'weight'
        ? 'Trials in people with type 2 diabetes usually show less weight change.'
        : 'People without diabetes start near a normal level, so their change is small.'
      : '',
  ]
    .filter(Boolean)
    .join(' '),
)

/* Trial by trial: each trial's own card, as printed, folded below the merged chart. */
const showTrials = ref(false)
const latestDose = computed(() => {
  const p = product.value
  if (!p) return null
  const dose = journal.doses.find((d) => journal.medicationById(d.medicationId)?.productId === p.id)
  return dose ? { molecule: p.molecule, doseMg: dose.doseMg } : null
})
const missingText = computed(() =>
  firstDoseAt.value === null
    ? `Log a dose of ${product.value?.name ?? 'this medication'} to compare`
    : measure.value === 'weight'
      ? 'Log a weight to compare'
      : `Log a later ${measure.value === 'hba1c' ? 'HbA1c' : 'fasting glucose'} to compare`,
)
const weightCards = computed(() =>
  trialsFor(product.value).map((t) => compareToTrial(weightSeries.value, t, latestDose.value)),
)
const glycemicCards = computed(() =>
  measure.value === 'weight'
    ? []
    : trialsFor(product.value).flatMap((t) => {
        const c = compareGlycemic(
          readingsOf(measure.value === 'fastingGlucose'),
          firstDoseAt.value,
          t,
          measure.value === 'hba1c' ? 'hba1c' : 'fastingGlucose',
        )
        return c ? [c] : []
      }),
)
const trialCount = computed(() =>
  measure.value === 'weight' ? weightCards.value.length : glycemicCards.value.length,
)
</script>

<template>
  <section v-if="product" class="gl-stack">
    <div>
      <h2 class="gl-display text-title-large">Compared with trial cohorts</h2>
      <p class="gl-muted section-intro">
        Your change beside the published averages from {{ product.molecule }} trials.
        <template v-if="product.kind === 'compounded'"
          >These trials used the brand product.</template
        >
      </p>
    </div>

    <div v-if="products.length > 1">
      <p :id="ids.product" class="gl-label">Medication</p>
      <v-btn-toggle
        v-model="productModel"
        role="group"
        mandatory
        density="comfortable"
        :aria-labelledby="ids.product"
        class="gl-toggle-wrap"
      >
        <v-btn v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</v-btn>
      </v-btn-toggle>
    </div>

    <v-card>
      <v-card-item>
        <p class="gl-eyebrow">Trial cohorts</p>
        <v-card-title class="text-wrap">{{ medicineName }}</v-card-title>
      </v-card-item>
      <v-card-text class="gl-stack">
        <div class="d-flex flex-wrap ga-4">
          <div v-if="measures.length > 1">
            <p :id="ids.measure" class="gl-label">Measure</p>
            <v-btn-toggle
              v-model="measure"
              role="group"
              mandatory
              density="comfortable"
              :aria-labelledby="ids.measure"
              class="gl-toggle-wrap"
            >
              <v-btn v-for="m in measures" :key="m" :value="m">{{ MEASURE_LABELS[m] }}</v-btn>
            </v-btn-toggle>
          </div>
          <div v-if="mixedPopulations">
            <p :id="ids.population" class="gl-label">Trials</p>
            <v-btn-toggle
              v-model="population"
              role="group"
              mandatory
              density="comfortable"
              :aria-labelledby="ids.population"
              class="gl-toggle-wrap"
            >
              <v-btn v-for="p in POPULATIONS" :key="p.value" :value="p.value">{{ p.label }}</v-btn>
            </v-btn-toggle>
          </div>
        </div>

        <CohortChart
          :summary="summary"
          :user="userSeries"
          :measure="measure"
          :a1c-unit="settings.a1cUnit"
          :glucose-unit="settings.glucoseUnit"
        />

        <p class="text-body-small gl-muted">{{ captionText }}</p>
        <SourceList :sources="summary.sources" />
      </v-card-text>
    </v-card>

    <div v-if="trialCount">
      <v-btn variant="text" @click="showTrials = !showTrials">
        {{ showTrials ? 'Hide each trial' : `Show each trial (${trialCount})` }}
      </v-btn>
    </div>
    <v-expand-transition>
      <div v-if="showTrials" class="cohort-grid">
        <template v-if="measure === 'weight'">
          <TrialComparison
            v-for="c in weightCards"
            :key="c.trial.id"
            :comparison="c"
            :weight-unit="settings.weightUnit"
            :missing-text="missingText"
          />
        </template>
        <template v-else>
          <GlycemicComparison
            v-for="c in glycemicCards"
            :key="c.trial.id"
            :comparison="c"
            :a1c-unit="settings.a1cUnit"
            :glucose-unit="settings.glucoseUnit"
            :missing-text="missingText"
          />
        </template>
      </div>
    </v-expand-transition>
  </section>
</template>

<style scoped>
.section-intro {
  max-width: 70ch;
}

.cohort-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr));
  align-items: start;
}
</style>

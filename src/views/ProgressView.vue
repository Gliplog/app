<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatPercentChange, formatWeeklyChange, formatWeightChange } from '@/domain/bodyUnits'
import { changeStats } from '@/domain/progressStats'
import { useEntries } from '@/composables/useEntries'
import { useNow } from '@/composables/useNow'
import { formatDate, toEpochMs } from '@/services/time'
import { useJournalStore } from '@/stores/journal'
import { useSettingsStore } from '@/stores/settings'
import { mdiChevronRight, mdiFilePdfBox } from '@/plugins/icons'
import StatTile from '@/components/common/StatTile.vue'
import TrendCard from '@/components/charts/TrendCard.vue'
import CohortSection from '@/components/charts/CohortSection.vue'
import PhotosCard from '@/components/photos/PhotosCard.vue'
import SymptomSummaryCard from '@/components/journal/SymptomSummaryCard.vue'
import ExportReportDialog from '@/components/report/ExportReportDialog.vue'

const journal = useJournalStore()
const settings = useSettingsStore()
const now = useNow()
const { entries } = useEntries()

const reportOpen = ref(false)

const baseline = computed(() => journal.baseline)
const last = computed(() => journal.progress[journal.progress.length - 1])
const stats = computed(() =>
  baseline.value && last.value ? changeStats(baseline.value, last.value) : null,
)

const hasAnything = computed(
  () =>
    journal.weights.length > 0 ||
    journal.glucose.length > 0 ||
    journal.vitals.length > 0 ||
    journal.symptoms.length > 0 ||
    journal.doses.length > 0,
)

const doseTimes = computed(() => journal.doses.map((d) => toEpochMs(d.takenAt)))

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
  <div class="gl-page">
    <header class="page-header mb-4">
      <div>
        <p class="gl-eyebrow">Over time</p>
        <h1 class="gl-display text-headline-large">Progress</h1>
      </div>
      <v-btn
        v-if="hasAnything"
        variant="tonal"
        :prepend-icon="mdiFilePdfBox"
        @click="reportOpen = true"
      >
        Export PDF
      </v-btn>
    </header>

    <v-alert v-if="!journal.weights.length" type="info" variant="tonal" class="mb-4">
      Log a weight to start your progress chart.
    </v-alert>

    <section v-if="stats" class="gl-stack gl-stack--tight mb-4" aria-label="Summary">
      <div class="stat-grid">
        <StatTile
          label="Total change"
          :value="formatWeightChange(stats.changeKg, settings.weightUnit)"
        />
        <StatTile label="Percent" :value="formatPercentChange(stats.changePercent)" />
        <StatTile
          label="Weekly average"
          :value="
            stats.weeklyKg !== null ? formatWeeklyChange(stats.weeklyKg, settings.weightUnit) : '–'
          "
          :note="stats.weeklyKg === null ? 'After two weeks' : undefined"
        />
      </div>
      <p class="text-body-small gl-muted">Since {{ formatDate(stats.startAt) }}. {{ basisNote }}</p>
    </section>

    <div class="progress-grid">
      <TrendCard />
    </div>

    <section id="photos" class="mt-6">
      <h2 class="gl-display text-title-large mb-4">Photos</h2>
      <div class="progress-grid">
        <PhotosCard />
      </div>
    </section>

    <section
      v-if="journal.medications.length || journal.symptoms.length"
      id="side-effects"
      class="mt-6"
    >
      <h2 class="gl-display text-title-large mb-4">Side effects</h2>
      <div class="progress-grid">
        <SymptomSummaryCard :now="now" :dose-times="doseTimes" />
      </div>
    </section>

    <CohortSection class="mt-6" />

    <v-card class="mt-6" :to="{ name: 'entries' }" link>
      <v-card-item>
        <template #title>All entries</template>
        <template #subtitle>
          {{ entries.length }} {{ entries.length === 1 ? 'entry' : 'entries' }}
        </template>
        <template #append>
          <v-icon :icon="mdiChevronRight" />
        </template>
      </v-card-item>
    </v-card>

    <ExportReportDialog v-model="reportOpen" />
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.stat-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
}

.progress-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr));
  align-items: start;
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { findPkProfile } from '@/data'
import { formatPercentChange, formatWeight, formatWeightChange, roundTo } from '@/domain/units'
import { useJournalStore } from '@/stores/journal'
import { useSettingsStore } from '@/stores/settings'
import { useNow } from '@/composables/useNow'
import { formatDate } from '@/services/time'
import { mdiFilePdfBox } from '@/plugins/icons'
import TrendCard from '@/components/charts/TrendCard.vue'
import CohortSection from '@/components/charts/CohortSection.vue'
import PkPanel from '@/components/charts/PkPanel.vue'
import SymptomSummaryCard from '@/components/journal/SymptomSummaryCard.vue'
import ExportReportDialog from '@/components/report/ExportReportDialog.vue'

const journal = useJournalStore()
const settings = useSettingsStore()
const now = useNow()

const reportOpen = ref(false)

const baseline = computed(() => journal.baseline)
const last = computed(() => journal.progress[journal.progress.length - 1])

const hasAnything = computed(
  () => journal.weights.length > 0 || journal.glucose.length > 0 || journal.doses.length > 0,
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
      Log a weight on Today to start your progress chart.
    </v-alert>

    <div class="progress-grid">
      <v-card v-if="baseline">
        <v-card-item>
          <p class="gl-eyebrow">Since you started</p>
          <v-card-title class="gl-num">
            {{ last ? formatWeightChange(last.changeKg, settings.weightUnit) : '0' }}
            <span v-if="last" class="gl-muted text-title-medium">
              {{ formatPercentChange(last.changePercent) }}
            </span>
          </v-card-title>
        </v-card-item>
        <v-card-text class="gl-stack">
          <dl class="stats">
            <div>
              <dt class="gl-faint">Start</dt>
              <dd class="gl-num">
                {{ formatWeight(baseline.kg, settings.weightUnit) }}
                <span class="gl-faint">· {{ formatDate(baseline.at) }}</span>
              </dd>
            </div>
            <div v-if="last">
              <dt class="gl-faint">Latest</dt>
              <dd class="gl-num">{{ formatWeight(last.kg, settings.weightUnit) }}</dd>
            </div>
            <div v-if="last && baseline.basis !== 'no-doses'">
              <dt class="gl-faint">Weeks since first dose</dt>
              <dd class="gl-num">{{ roundTo(last.weeks, 1) }}</dd>
            </div>
          </dl>
          <p class="text-body-small gl-muted">{{ basisNote }}</p>
        </v-card-text>
      </v-card>

      <TrendCard :now="now" />
    </div>

    <section v-if="journal.medications.length" id="side-effects" class="mt-6">
      <h2 class="gl-display text-title-large mb-4">Side effects</h2>
      <div class="progress-grid">
        <SymptomSummaryCard :now="now" @export="reportOpen = true" />
      </div>
    </section>

    <section v-if="journal.levelGroups.length" class="mt-6">
      <h2 class="gl-display text-title-large mb-4">Estimated levels</h2>
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

    <CohortSection class="mt-6" />

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

.progress-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 400px), 1fr));
  align-items: start;
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

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { ReportPeriod } from '@/domain/report'
import { REPORT_SECTIONS, type ReportSection } from '@/services/report/reportData'
import { useReportExport } from '@/composables/useReportExport'
import { useNow } from '@/composables/useNow'
import { mdiFilePdfBox } from '@/plugins/icons'

/**
 * Choose a period and what to include, and export the journal as a PDF to share with a
 * prescriber. Parts with nothing logged in the period are shown but cannot be ticked, so the
 * user sees why they are missing.
 */
const open = defineModel<boolean>({ required: true })
const period = ref<ReportPeriod>('90d')
const report = useReportExport()
const now = useNow()
const titleId = useId()
const periodId = useId()
const includeId = useId()

const PERIODS: { value: ReportPeriod; title: string }[] = [
  { value: '30d', title: '30 days' },
  { value: '90d', title: '90 days' },
  { value: 'all', title: 'All' },
]

const SECTIONS: Record<ReportSection, { title: string; detail: string }> = {
  combined: {
    title: 'Combined chart',
    detail: 'The other parts you include, on one time axis',
  },
  weight: { title: 'Weight and BMI', detail: 'Change over the period, with charts' },
  sugar: { title: 'Blood sugar', detail: 'HbA1c and glucose charts and readings' },
  cohort: {
    title: 'Trial comparison',
    detail: 'Your change beside published trial averages, from your first dose',
  },
  levels: { title: 'Estimated levels', detail: 'Each medicine’s level chart and sources' },
  symptoms: { title: 'Side effects', detail: 'How often, how strong, and when after a dose' },
  doses: { title: 'Medications and doses', detail: 'Your medications and every dose' },
}

/** What the user ticked; a part with nothing to print is left out whatever it says. */
const chosen = ref(new Set<ReportSection>(REPORT_SECTIONS))
const available = computed(() => report.actions.available(period.value, now.value))
const included = computed(() =>
  REPORT_SECTIONS.filter((s) => chosen.value.has(s) && available.value.has(s)),
)
/** The combined chart draws the other parts, so on its own it has nothing to show. */
const canExport = computed(() => included.value.some((s) => s !== 'combined'))

function unavailable(section: ReportSection): string {
  return section === 'cohort'
    ? 'None of your medications has published trials'
    : 'Nothing logged in this period'
}

function toggle(section: ReportSection, on: boolean | null) {
  const next = new Set(chosen.value)
  if (on) next.add(section)
  else next.delete(section)
  chosen.value = next
}

async function exportReport() {
  if (await report.actions.exportReport(period.value, included.value)) open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="520" scrollable :aria-labelledby="titleId">
    <v-card>
      <v-card-item>
        <v-card-title :id="titleId" class="text-wrap">Export PDF</v-card-title>
      </v-card-item>
      <v-card-text class="gl-stack">
        <div>
          <p :id="periodId" class="gl-label">Period</p>
          <v-btn-toggle
            v-model="period"
            mandatory
            role="group"
            density="comfortable"
            :aria-labelledby="periodId"
          >
            <v-btn v-for="p in PERIODS" :key="p.value" :value="p.value">{{ p.title }}</v-btn>
          </v-btn-toggle>
        </div>
        <div role="group" :aria-labelledby="includeId">
          <p :id="includeId" class="gl-label">Include</p>
          <v-checkbox
            v-for="s in REPORT_SECTIONS"
            :key="s"
            :model-value="available.has(s) && chosen.has(s)"
            :disabled="!available.has(s)"
            color="primary"
            density="compact"
            hide-details
            @update:model-value="toggle(s, $event)"
          >
            <template #label>
              <span class="section">
                <span>{{ SECTIONS[s].title }}</span>
                <span class="text-body-small gl-muted">{{
                  available.has(s) ? SECTIONS[s].detail : unavailable(s)
                }}</span>
              </span>
            </template>
          </v-checkbox>
        </div>
        <p v-if="!canExport" class="text-body-medium gl-muted">
          Choose at least one part to include.
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn
          variant="flat"
          color="primary"
          :prepend-icon="mdiFilePdfBox"
          :loading="report.state.busy"
          :disabled="!canExport"
          @click="exportReport"
        >
          Export
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.section {
  display: flex;
  flex-direction: column;
  padding-block: 4px;
}
</style>

<script setup lang="ts">
import { ref, useId } from 'vue'
import type { ReportPeriod } from '@/domain/report'
import { useReportExport } from '@/composables/useReportExport'
import { mdiFilePdfBox } from '@/plugins/icons'

/** Choose a period and export the journal as a PDF to share with a prescriber. */
const open = defineModel<boolean>({ required: true })
const period = ref<ReportPeriod>('90d')
const report = useReportExport()
const titleId = useId()
const periodId = useId()

const PERIODS: { value: ReportPeriod; title: string }[] = [
  { value: '30d', title: '30 days' },
  { value: '90d', title: '90 days' },
  { value: 'all', title: 'All' },
]

async function exportReport() {
  if (await report.actions.exportReport(period.value)) open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="520" :aria-labelledby="titleId">
    <v-card>
      <v-card-item>
        <v-card-title :id="titleId" class="text-wrap">Export PDF</v-card-title>
      </v-card-item>
      <v-card-text class="tb-stack">
        <div>
          <p :id="periodId" class="tb-label">Period</p>
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
        <p class="text-body-medium">
          Your medications and doses, weight, side effects, HbA1c and glucose, ready to share with
          your prescriber.
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
          @click="exportReport"
        >
          Export
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

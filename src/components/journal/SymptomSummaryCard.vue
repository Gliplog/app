<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import {
  SEVERITIES,
  SEVERITY_LABELS,
  SYMPTOM_LABEL_TERMS,
  SYMPTOM_SOURCES,
  summarizeSymptoms,
  type SymptomSummary,
} from '@/domain/symptoms'
import { roundTo } from '@/domain/units'
import { useJournalStore } from '@/stores/journal'
import { useNotifyStore } from '@/stores/notify'
import { formatDate, toEpochMs } from '@/services/time'
import SourceList from '@/components/common/SourceList.vue'

/**
 * Side effects over a chosen period: how often each came, how strong, when last, and how many
 * days after a dose it usually arrived. The text copy is for a prescriber, so it carries the
 * labels' own terms beside the plain ones.
 */
const props = defineProps<{ now: number }>()

const journal = useJournalStore()
const notify = useNotifyStore()
const periodLabelId = useId()

const PERIODS = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All' },
] as const
const period = ref<number>(30)

const since = computed(() => (period.value ? props.now - period.value * 86_400_000 : -Infinity))
const summary = computed(() =>
  summarizeSymptoms(
    journal.symptoms.map((s) => ({ ...s, at: toEpochMs(s.occurredAt) })),
    journal.doses.map((d) => toEpochMs(d.takenAt)),
    since.value,
  ),
)

function severityText(s: SymptomSummary): string {
  return SEVERITIES.filter((l) => s.bySeverity[l])
    .map((l) => `${s.bySeverity[l]} ${SEVERITY_LABELS[l].toLowerCase()}`)
    .join(', ')
}

function timingText(s: SymptomSummary): string {
  if (s.medianDaysAfterDose === null) return 'Before any dose'
  const days = roundTo(s.medianDaysAfterDose, 1)
  return days < 1 ? 'Same day as a dose' : `About ${days} day${days === 1 ? '' : 's'} after a dose`
}

function termFor(s: SymptomSummary): string {
  const term = SYMPTOM_LABEL_TERMS[s.symptom]
  return term && s.symptom !== 'other' ? ` (${term})` : ''
}

async function copy() {
  const periodText = PERIODS.find((p) => p.days === period.value)!.label
  const lines = [
    `Side effects, ${period.value ? `last ${periodText}` : 'all logged'} (Tidebook)`,
    ...summary.value.map(
      (s) =>
        `- ${s.name}${termFor(s)}: ${s.count} time${s.count === 1 ? '' : 's'} (${severityText(s)}); ${timingText(s).toLowerCase()}; last ${formatDate(s.lastAt)}`,
    ),
  ]
  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    notify.show('Summary copied', 'success')
  } catch {
    notify.show("Couldn't copy on this device", 'error')
  }
}
</script>

<template>
  <v-card>
    <v-card-item>
      <p class="tb-eyebrow">Side effects</p>
      <v-card-title>How you’ve felt</v-card-title>
    </v-card-item>
    <v-card-text class="tb-stack">
      <div>
        <p :id="periodLabelId" class="tb-label">Period</p>
        <v-btn-toggle
          v-model="period"
          role="group"
          mandatory
          density="comfortable"
          :aria-labelledby="periodLabelId"
        >
          <v-btn v-for="p in PERIODS" :key="p.days" :value="p.days">{{ p.label }}</v-btn>
        </v-btn-toggle>
      </div>
      <v-table v-if="summary.length" density="comfortable" class="summary-table">
        <thead>
          <tr>
            <th scope="col">Side effect</th>
            <th scope="col" class="text-end">Times</th>
            <th scope="col">Strength and timing</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in summary" :key="s.key">
            <th scope="row" class="font-weight-medium">
              {{ s.name }}
              <span class="d-block text-body-small tb-faint">Last {{ formatDate(s.lastAt) }}</span>
            </th>
            <td class="text-end tb-num">{{ s.count }}</td>
            <td class="text-body-small">
              {{ severityText(s) }}
              <span class="d-block tb-muted">{{ timingText(s) }}</span>
            </td>
          </tr>
        </tbody>
      </v-table>
      <p v-else class="tb-muted">Nothing logged in this period.</p>
      <p class="text-body-small tb-muted">
        A record to share with your prescriber; it doesn’t say what caused a symptom. The list
        follows the side effects reported in the labels’ clinical trials.
      </p>
      <SourceList :sources="SYMPTOM_SOURCES" />
      <div v-if="summary.length" class="tb-actions">
        <v-btn variant="tonal" @click="copy">Copy for my prescriber</v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.summary-table {
  background: transparent;
}
</style>

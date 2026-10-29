<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DoseRow, WeightRow } from '@/db/database'
import { sortByTime, type SortDirection } from '@/domain/listing'
import { formatDose, formatWeight } from '@/domain/units'
import { useJournalStore } from '@/stores/journal'
import { useSettingsStore } from '@/stores/settings'
import { usePaging } from '@/composables/usePaging'
import { formatDateTime, toEpochMs } from '@/services/time'
import { mdiNeedle, mdiScaleBathroom } from '@/plugins/icons'
import ListPager from '@/components/common/ListPager.vue'
import SortToggle from '@/components/common/SortToggle.vue'
import LogDoseDialog from '@/components/journal/LogDoseDialog.vue'
import LogWeightDialog from '@/components/journal/LogWeightDialog.vue'
import { SITE_LABELS } from '@/components/journal/siteLabels'

const journal = useJournalStore()
const settings = useSettingsStore()

const tab = ref<'doses' | 'weights'>('doses')
const direction = ref<SortDirection>('desc')

const doses = computed(() =>
  sortByTime(journal.doses, (d) => toEpochMs(d.takenAt), direction.value),
)
const weights = computed(() =>
  sortByTime(journal.weights, (w) => toEpochMs(w.measuredAt), direction.value),
)

const dosePages = usePaging(doses)
const weightPages = usePaging(weights)
watch([direction, tab], () => {
  dosePages.reset()
  weightPages.reset()
})

const doseDialog = ref(false)
const editingDose = ref<DoseRow | null>(null)
const weightDialog = ref(false)
const editingWeight = ref<WeightRow | null>(null)

function editDose(d: DoseRow) {
  editingDose.value = d
  doseDialog.value = true
}

function editWeight(w: WeightRow) {
  editingWeight.value = w
  weightDialog.value = true
}

function doseSubtitle(d: DoseRow): string {
  const parts = [formatDateTime(d.takenAt)]
  if (d.site) parts.push(SITE_LABELS[d.site])
  return parts.join(' · ')
}
</script>

<template>
  <div class="tb-page">
    <header class="mb-4">
      <p class="tb-eyebrow">Everything you’ve logged</p>
      <h1 class="tb-display text-headline-large">History</h1>
    </header>

    <v-card>
      <v-tabs v-model="tab" color="primary" grow>
        <v-tab value="doses">Doses ({{ journal.doses.length }})</v-tab>
        <v-tab value="weights">Weights ({{ journal.weights.length }})</v-tab>
      </v-tabs>
      <v-card-text class="tb-stack">
        <SortToggle v-model="direction" label="Order" />

        <template v-if="tab === 'doses'">
          <p v-if="!journal.doses.length" class="tb-muted">No doses logged yet.</p>
          <v-list v-else class="bg-transparent" density="comfortable">
            <v-list-item
              v-for="d in dosePages.current.value.items"
              :key="d.id"
              :prepend-icon="mdiNeedle"
              :subtitle="doseSubtitle(d)"
              @click="editDose(d)"
            >
              <v-list-item-title>
                <span class="tb-num">{{ formatDose(d.doseMg) }}</span>
                {{ journal.medicationById(d.medicationId)?.name }}
              </v-list-item-title>
              <p v-if="d.notes" class="text-body-small tb-muted note">{{ d.notes }}</p>
            </v-list-item>
          </v-list>
          <ListPager
            v-model="dosePages.state.page"
            :current="dosePages.current.value"
            noun="doses"
          />
        </template>

        <template v-else>
          <p v-if="!journal.weights.length" class="tb-muted">No weigh-ins yet.</p>
          <v-list v-else class="bg-transparent" density="comfortable">
            <v-list-item
              v-for="w in weightPages.current.value.items"
              :key="w.id"
              :prepend-icon="mdiScaleBathroom"
              :subtitle="formatDateTime(w.measuredAt)"
              @click="editWeight(w)"
            >
              <v-list-item-title class="tb-num">
                {{ formatWeight(w.kg, settings.weightUnit) }}
              </v-list-item-title>
              <p v-if="w.notes" class="text-body-small tb-muted note">{{ w.notes }}</p>
            </v-list-item>
          </v-list>
          <ListPager
            v-model="weightPages.state.page"
            :current="weightPages.current.value"
            noun="weigh-ins"
          />
        </template>
      </v-card-text>
    </v-card>

    <LogDoseDialog v-model="doseDialog" :dose="editingDose" />
    <LogWeightDialog v-model="weightDialog" :weight="editingWeight" />
  </div>
</template>

<style scoped>
.note {
  white-space: pre-wrap;
}
</style>

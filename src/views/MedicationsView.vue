<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { MedicationRow } from '@/db/database'
import { dueState, dueText, intervalText } from '@/domain/schedule'
import { useNow } from '@/composables/useNow'
import { useJournalStore } from '@/stores/journal'
import MedicationDialog from '@/components/journal/MedicationDialog.vue'
import OverlapNotice from '@/components/journal/OverlapNotice.vue'
import { mdiChevronRight, mdiPlus } from '@/plugins/icons'

const journal = useJournalStore()
const router = useRouter()
const now = useNow()

const medDialog = ref(false)

function subtitleOf(med: MedicationRow): string {
  const molecule = journal.productOf(med)?.molecule ?? 'Not in the catalog'
  return `${molecule}, ${intervalText(med.intervalDays)}`
}

function dueLabel(med: MedicationRow): string {
  const at = journal.nextDueOf(med)
  if (at === null) return 'No dose logged'
  return dueText(dueState(at, now.value))
}

function reviewMedication(med: MedicationRow) {
  void router.push({ name: 'medication', params: { id: med.id } })
}
</script>

<template>
  <div class="gl-page meds">
    <header class="page-header mb-4">
      <div>
        <p class="gl-eyebrow">Your treatments</p>
        <h1 class="gl-display text-headline-large">Medications</h1>
      </div>
      <v-btn
        v-if="journal.medications.length"
        color="primary"
        variant="flat"
        :prepend-icon="mdiPlus"
        @click="medDialog = true"
      >
        Add medication
      </v-btn>
    </header>

    <OverlapNotice class="mb-4" @review="reviewMedication" />

    <v-card v-if="journal.loaded && !journal.medications.length" variant="tonal">
      <v-card-text class="gl-stack">
        <p>Add what you take.</p>
        <div class="gl-actions">
          <v-btn color="primary" variant="flat" :prepend-icon="mdiPlus" @click="medDialog = true">
            Add medication
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <v-card v-else-if="journal.medications.length">
      <v-list density="comfortable" class="bg-transparent">
        <v-list-subheader v-if="journal.activeMedications.length">In use</v-list-subheader>
        <v-list-item
          v-for="med in journal.activeMedications"
          :key="med.id"
          :to="{ name: 'medication', params: { id: med.id } }"
          :title="med.name"
          :subtitle="subtitleOf(med)"
        >
          <template #append>
            <span class="text-body-small gl-muted mr-2">{{ dueLabel(med) }}</span>
            <v-icon :icon="mdiChevronRight" />
          </template>
        </v-list-item>
        <v-list-subheader v-if="journal.archivedMedications.length">Past</v-list-subheader>
        <v-list-item
          v-for="med in journal.archivedMedications"
          :key="med.id"
          :to="{ name: 'medication', params: { id: med.id } }"
          :title="med.name"
          :subtitle="subtitleOf(med)"
        >
          <template #append>
            <span class="text-body-small gl-muted mr-2">Stopped</span>
            <v-icon :icon="mdiChevronRight" />
          </template>
        </v-list-item>
      </v-list>
    </v-card>

    <MedicationDialog v-model="medDialog" :medication="null" />
  </div>
</template>

<style scoped>
.meds {
  max-width: 760px;
}

.page-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}
</style>

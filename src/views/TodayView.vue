<script setup lang="ts">
import { computed, ref } from 'vue'
import { findPkProfile } from '@/data'
import type { MedicationRow } from '@/db/database'
import { dueState } from '@/domain/schedule'
import {
  formatDose,
  formatPercentChange,
  formatWeight,
  formatWeightChange,
  roundTo,
} from '@/domain/units'
import { useJournalStore } from '@/stores/journal'
import { useSettingsStore } from '@/stores/settings'
import { useNow } from '@/composables/useNow'
import { useBodyMetrics } from '@/composables/useBodyMetrics'
import { formatDateTime, formatRelativeDays, formatWeekday, daysBetween } from '@/services/time'
import { mdiChevronRight, mdiNeedle, mdiPlus, mdiScaleBathroom } from '@/plugins/icons'
import MedicationDialog from '@/components/journal/MedicationDialog.vue'
import LogDoseDialog from '@/components/journal/LogDoseDialog.vue'
import LogWeightDialog from '@/components/journal/LogWeightDialog.vue'
import PkPanel from '@/components/charts/PkPanel.vue'

const journal = useJournalStore()
const settings = useSettingsStore()
const now = useNow()
const body = useBodyMetrics(() => now.value)

const medDialog = ref(false)
const editing = ref<MedicationRow | null>(null)
const doseDialog = ref(false)
const doseFor = ref<string | undefined>()
const weightDialog = ref(false)

function addMedication() {
  editing.value = null
  medDialog.value = true
}

function editMedication(med: MedicationRow) {
  editing.value = med
  medDialog.value = true
}

function logDose(med?: MedicationRow) {
  doseFor.value = med?.id
  doseDialog.value = true
}

const current = computed(() => journal.currentMedication)
const currentProduct = computed(() => journal.productOf(current.value))
const lastDose = computed(() => (current.value ? journal.lastDoseOf(current.value.id) : undefined))

const due = computed(() => {
  const med = current.value
  if (!med) return null
  const at = journal.nextDueOf(med)
  return at === null ? null : { at, state: dueState(at, now.value) }
})

const dueText = computed(() => {
  const d = due.value
  if (!d) return 'No dose logged yet'
  switch (d.state.kind) {
    case 'later':
      return `Next dose ${formatWeekday(d.at)}, in ${d.state.days} day${d.state.days === 1 ? '' : 's'}`
    case 'soon':
      return `Next dose in about ${d.state.hours} hour${d.state.hours === 1 ? '' : 's'}`
    case 'due':
      return 'Your next dose is due'
    case 'late':
      return `Due ${formatRelativeDays(d.state.days)}`
  }
  return ''
})

const latest = computed(() => journal.latestWeight)
const baseline = computed(() => journal.baseline)
const lastPoint = computed(() => journal.progress[journal.progress.length - 1])

const goalText = computed(() => {
  const goal = settings.profile.goalKg
  const w = latest.value
  if (!goal || !w) return null
  const left = w.kg - goal
  return left <= 0
    ? 'You’ve reached your goal'
    : `${formatWeight(left, settings.weightUnit)} to your goal`
})

const group = computed(() => (current.value ? journal.levelGroupOf(current.value) : undefined))
const profile = computed(() => findPkProfile(currentProduct.value?.pkProfile))

const isEmpty = computed(
  () => journal.loaded && !journal.medications.length && !journal.weights.length,
)

const daysSinceStart = computed(() =>
  baseline.value ? daysBetween(baseline.value.startAt, now.value) : null,
)
</script>

<template>
  <div class="tb-page today">
    <header class="mb-4">
      <p class="tb-eyebrow">Today</p>
      <h1 class="tb-display text-headline-large">Your journal</h1>
    </header>

    <v-card v-if="isEmpty" class="tb-card-soft mb-4">
      <v-card-text class="tb-stack">
        <p class="text-title-large tb-display">Start with what you take</p>
        <p>
          Add your medication and a first weigh-in. Tidebook keeps everything on this device, works
          offline, and never asks for an account.
        </p>
        <div class="d-flex flex-wrap ga-2">
          <v-btn color="primary" variant="flat" :prepend-icon="mdiPlus" @click="addMedication">
            Add medication
          </v-btn>
          <v-btn variant="outlined" :prepend-icon="mdiScaleBathroom" @click="weightDialog = true">
            Log a weight
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <div class="today-grid">
      <v-card v-if="current">
        <v-card-item>
          <p class="tb-eyebrow">Medication</p>
          <v-card-title class="text-wrap">{{ current.name }}</v-card-title>
          <v-card-subtitle v-if="currentProduct">
            {{ currentProduct.molecule }} ·
            {{
              current.intervalDays === 1
                ? 'daily'
                : current.intervalDays === 7
                  ? 'weekly'
                  : `every ${current.intervalDays} days`
            }}
          </v-card-subtitle>
        </v-card-item>
        <v-card-text class="tb-stack">
          <p class="text-title-medium">{{ dueText }}</p>
          <p v-if="lastDose" class="tb-muted">
            Last: <span class="tb-num">{{ formatDose(lastDose.doseMg) }}</span
            >,
            {{ formatDateTime(lastDose.takenAt) }}
          </p>
          <div class="tb-actions">
            <v-btn
              color="primary"
              variant="flat"
              :prepend-icon="mdiNeedle"
              @click="logDose(current)"
            >
              Log dose
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <v-card v-if="latest || journal.medications.length">
        <v-card-item>
          <p class="tb-eyebrow">Weight</p>
          <v-card-title>
            <span v-if="latest" class="tb-num">{{
              formatWeight(latest.kg, settings.weightUnit)
            }}</span>
            <span v-else>No weigh-ins yet</span>
          </v-card-title>
          <v-card-subtitle v-if="latest">{{ formatDateTime(latest.measuredAt) }}</v-card-subtitle>
        </v-card-item>
        <v-card-text class="tb-stack">
          <dl v-if="latest" class="stats">
            <div v-if="lastPoint && journal.progress.length > 1">
              <dt class="tb-faint">Since you started</dt>
              <dd class="tb-num">
                {{ formatWeightChange(lastPoint.changeKg, settings.weightUnit) }}
                <span class="tb-muted">({{ formatPercentChange(lastPoint.changePercent) }})</span>
              </dd>
            </div>
            <div v-if="body.currentBmi.value !== null">
              <dt class="tb-faint">BMI</dt>
              <dd class="tb-num">
                {{ roundTo(body.currentBmi.value, 1) }}
                <span v-if="body.band.value" class="tb-muted">· {{ body.band.value.label }}</span>
              </dd>
            </div>
            <div v-if="goalText">
              <dt class="tb-faint">Goal</dt>
              <dd>{{ goalText }}</dd>
            </div>
            <div v-if="daysSinceStart !== null && baseline?.basis !== 'no-doses'">
              <dt class="tb-faint">Day</dt>
              <dd class="tb-num">{{ daysSinceStart + 1 }}</dd>
            </div>
          </dl>
          <p v-if="latest && body.currentBmi.value === null" class="text-body-small tb-muted">
            Add your height in Settings to see your BMI.
          </p>
          <div class="tb-actions">
            <v-btn variant="text" :to="{ name: 'progress' }">See progress</v-btn>
            <v-btn variant="tonal" :prepend-icon="mdiScaleBathroom" @click="weightDialog = true">
              Log weight
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <PkPanel
        v-if="current && group"
        :profile="profile"
        :override="current.pkOverride"
        :doses="group.doses"
        :preview="null"
        :now="now"
        :title="profile?.name ?? current.name"
        :caption="
          group.medicationCount > 1
            ? `Includes doses from ${group.medicationCount} medications with the same medicine.`
            : undefined
        "
      />

      <v-card v-if="journal.medications.length">
        <v-card-item>
          <p class="tb-eyebrow">Your medications</p>
          <v-card-title>In use</v-card-title>
        </v-card-item>
        <v-list density="comfortable" class="bg-transparent">
          <v-list-item
            v-for="med in journal.activeMedications"
            :key="med.id"
            :title="med.name"
            :subtitle="journal.productOf(med)?.molecule ?? 'Not in the catalog'"
            @click="editMedication(med)"
          >
            <template #append><v-icon :icon="mdiChevronRight" /></template>
          </v-list-item>
          <v-list-subheader v-if="journal.archivedMedications.length">Past</v-list-subheader>
          <v-list-item
            v-for="med in journal.archivedMedications"
            :key="med.id"
            :title="med.name"
            subtitle="Stopped"
            @click="editMedication(med)"
          >
            <template #append><v-icon :icon="mdiChevronRight" /></template>
          </v-list-item>
        </v-list>
        <v-card-actions>
          <v-btn :prepend-icon="mdiPlus" variant="text" @click="addMedication"
            >Add medication</v-btn
          >
        </v-card-actions>
      </v-card>
    </div>

    <MedicationDialog v-model="medDialog" :medication="editing" />
    <LogDoseDialog v-model="doseDialog" :dose="null" :medication-id="doseFor" />
    <LogWeightDialog v-model="weightDialog" :weight="null" />
  </div>
</template>

<style scoped>
.today-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr));
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

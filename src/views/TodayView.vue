<script setup lang="ts">
import { computed, ref } from 'vue'
import { findPkProfile } from '@/data'
import type { MedicationRow } from '@/db/database'
import { formatPercentChange, formatWeight, formatWeightChange, roundTo } from '@/domain/units'
import { useJournalStore } from '@/stores/journal'
import { useSettingsStore } from '@/stores/settings'
import { useNow } from '@/composables/useNow'
import { useBodyMetrics } from '@/composables/useBodyMetrics'
import { formatDateTime, daysBetween } from '@/services/time'
import {
  mdiChevronRight,
  mdiPlus,
  mdiScaleBathroom,
  mdiStethoscope,
  mdiWaterOutline,
} from '@/plugins/icons'
import { formatA1c, formatGlucose, GLUCOSE_CONTEXT_LABELS } from '@/domain/glucose'
import { summarizeSymptoms } from '@/domain/symptoms'
import { toEpochMs } from '@/services/time'
import MedicationStack from '@/components/journal/MedicationStack.vue'
import MedicationDialog from '@/components/journal/MedicationDialog.vue'
import LogDoseDialog from '@/components/journal/LogDoseDialog.vue'
import LogWeightDialog from '@/components/journal/LogWeightDialog.vue'
import LogSymptomDialog from '@/components/journal/LogSymptomDialog.vue'
import LogGlucoseDialog from '@/components/journal/LogGlucoseDialog.vue'
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
const symptomDialog = ref(false)
const glucoseDialog = ref(false)

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

/** The front card of the stack; the levels panel below follows it. */
const current = computed(() => journal.focusedMedication)
const focusedId = computed({
  get: () => current.value?.id,
  set: (id) => {
    if (id) journal.focusMedication(id)
  },
})
const currentProduct = computed(() => journal.productOf(current.value))

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

/** Names the medications pooled into one curve, so a shared estimate never looks like a bug. */
const groupCaption = computed(() => {
  const g = group.value
  if (!g || g.medicationCount < 2) return undefined
  const names = g.medicationIds.map((id) => journal.medicationById(id)?.name).filter(Boolean)
  return `Includes doses of ${names.join(' and ')}: the body handles them as one medicine.`
})

const isEmpty = computed(
  () => journal.loaded && !journal.medications.length && !journal.weights.length,
)

/** The last week of side effects, most frequent first. */
const RECENT_DAYS = 7
const recentSymptoms = computed(() =>
  summarizeSymptoms(
    journal.symptoms.map((s) => ({ ...s, at: toEpochMs(s.occurredAt) })),
    journal.doses.map((d) => toEpochMs(d.takenAt)),
    now.value - RECENT_DAYS * 86_400_000,
  ),
)

const latestA1c = computed(() => journal.glucose.find((g) => g.kind === 'a1c'))
const latestGlucose = computed(() => journal.glucose.find((g) => g.kind === 'glucose'))

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
        <p>Add your medicine and a weigh-in to get started. Everything stays on this device.</p>
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
      <MedicationStack
        v-if="journal.activeMedications.length"
        v-model="focusedId"
        :medications="journal.activeMedications"
        :now="now"
        @log-dose="logDose"
      />

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

      <v-fade-transition v-if="current" mode="out-in">
        <PkPanel
          v-if="group"
          :key="group.key"
          :profile="profile"
          :override="current.pkOverride"
          :doses="group.doses"
          :preview="null"
          :now="now"
          :title="profile?.name ?? current.name"
          :caption="groupCaption"
        />
        <v-card v-else :key="`empty:${current.id}`">
          <v-card-item>
            <p class="tb-eyebrow">Estimated levels</p>
            <v-card-title class="text-wrap">{{ profile?.name ?? current.name }}</v-card-title>
          </v-card-item>
          <v-card-text>
            <p class="tb-muted">Log a dose of {{ current.name }} to see an estimate here.</p>
          </v-card-text>
        </v-card>
      </v-fade-transition>

      <v-card v-if="journal.medications.length">
        <v-card-item>
          <p class="tb-eyebrow">Side effects</p>
          <v-card-title>Last {{ RECENT_DAYS }} days</v-card-title>
        </v-card-item>
        <v-card-text class="tb-stack">
          <ul v-if="recentSymptoms.length" class="symptom-list" aria-label="Side effects this week">
            <li v-for="s in recentSymptoms" :key="s.key" class="tb-badge tb-badge--info">
              {{ s.name }} <span class="tb-num">× {{ s.count }}</span>
            </li>
          </ul>
          <p v-else class="tb-muted">
            Nothing logged this week. Noting how you feel helps when you talk with your prescriber.
          </p>
          <div class="tb-actions">
            <v-btn variant="text" :to="{ name: 'progress', hash: '#side-effects' }"
              >See summary</v-btn
            >
            <v-btn variant="tonal" :prepend-icon="mdiStethoscope" @click="symptomDialog = true">
              Log side effect
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <v-card v-if="journal.medications.length">
        <v-card-item>
          <p class="tb-eyebrow">Blood sugar</p>
          <v-card-title>
            <span v-if="latestA1c" class="tb-num"
              >HbA1c {{ formatA1c(latestA1c.value, settings.a1cUnit) }}</span
            >
            <span v-else-if="latestGlucose" class="tb-num">{{
              formatGlucose(latestGlucose.value, settings.glucoseUnit)
            }}</span>
            <span v-else>No readings yet</span>
          </v-card-title>
          <v-card-subtitle v-if="latestA1c">{{
            formatDateTime(latestA1c.measuredAt)
          }}</v-card-subtitle>
        </v-card-item>
        <v-card-text class="tb-stack">
          <dl v-if="latestA1c && latestGlucose" class="stats">
            <div>
              <dt class="tb-faint">
                Glucose · {{ GLUCOSE_CONTEXT_LABELS[latestGlucose.context].toLowerCase() }}
              </dt>
              <dd class="tb-num">{{ formatGlucose(latestGlucose.value, settings.glucoseUnit) }}</dd>
            </div>
          </dl>
          <p v-else-if="latestGlucose" class="tb-muted">
            {{ GLUCOSE_CONTEXT_LABELS[latestGlucose.context] }},
            {{ formatDateTime(latestGlucose.measuredAt) }}
          </p>
          <p v-else-if="!latestA1c" class="tb-muted">
            Log an HbA1c result or a glucose reading to follow them over time.
          </p>
          <div class="tb-actions">
            <v-btn variant="tonal" :prepend-icon="mdiWaterOutline" @click="glucoseDialog = true">
              Log blood sugar
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

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
    <LogSymptomDialog v-model="symptomDialog" :symptom="null" />
    <LogGlucoseDialog v-model="glucoseDialog" :reading="null" />
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

.symptom-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>

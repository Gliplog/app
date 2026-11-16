<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { formatWeight, formatWeightChange, unitsSummary } from '@/domain/bodyUnits'
import { formatA1c, formatGlucose, GLUCOSE_CONTEXT_LABELS } from '@/domain/glucose'
import { dueState, dueText, remainingFraction } from '@/domain/schedule'
import { summarizeSymptoms } from '@/domain/symptoms'
import { roundTo } from '@/domain/units'
import { formatBloodPressure, formatHeartRate } from '@/domain/vitals'
import { useBodyMetrics } from '@/composables/useBodyMetrics'
import { useDueItems } from '@/composables/useDueItems'
import { useEntries } from '@/composables/useEntries'
import { useNow } from '@/composables/useNow'
import { useSystemRows } from '@/composables/useSystemRows'
import { formatDate, formatTodayDate, toEpochMs } from '@/services/time'
import { useJournalStore } from '@/stores/journal'
import { useLogStore } from '@/stores/log'
import { useSettingsStore } from '@/stores/settings'
import StatTile from '@/components/common/StatTile.vue'
import DoseCountdown from '@/components/journal/DoseCountdown.vue'
import EntriesTimeline from '@/components/journal/EntriesTimeline.vue'
import MedicationDialog from '@/components/journal/MedicationDialog.vue'
import DueCard from '@/components/today/DueCard.vue'
import SystemList from '@/components/today/SystemList.vue'
import { mdiChevronRight, mdiPlus, mdiScaleBathroom } from '@/plugins/icons'

interface TileItem {
  key: string
  label: string
  value: string
  note?: string
  to: RouteLocationRaw
}

const journal = useJournalStore()
const log = useLogStore()
const settings = useSettingsStore()
const now = useNow()
const body = useBodyMetrics()
const { items: dueItems } = useDueItems(now)
const { rows: systemRows } = useSystemRows(now)
const { entries } = useEntries()

const medDialog = ref(false)

/*
 * A tapped dose reminder arrives as `?log=<medication id>`. It waits for the journal to load,
 * opens Log dose for that medication if it is still active, and clears the query so a reload
 * or Back does not open the dialog again.
 */
const route = useRoute()
const router = useRouter()
watch(
  () => [route.query.log, journal.loaded] as const,
  ([id]) => {
    if (typeof id !== 'string' || !journal.loaded) return
    const med = journal.activeMedications.find((m) => m.id === id)
    if (med) {
      log.start('dose', { medicationId: med.id })
    }
    void router.replace({ query: {} })
  },
  { immediate: true },
)

const isEmpty = computed(
  () => journal.loaded && !journal.medications.length && !journal.weights.length,
)

const RECENT_DAYS = 7
const DAY_MS = 86_400_000

const latestTiles = computed<TileItem[]>(() => {
  const tiles: TileItem[] = []
  const w = journal.latestWeight
  const lastPoint = journal.progress[journal.progress.length - 1]
  if (w) {
    tiles.push({
      key: 'weight',
      label: 'Weight',
      value: formatWeight(w.kg, settings.weightUnit),
      note:
        lastPoint && journal.progress.length > 1
          ? formatWeightChange(lastPoint.changeKg, settings.weightUnit)
          : formatDate(w.measuredAt),
      to: { name: 'progress' },
    })
  }
  if (body.currentBmi.value !== null) {
    tiles.push({
      key: 'bmi',
      label: 'BMI',
      value: String(roundTo(body.currentBmi.value, 1)),
      note: body.band.value?.label,
      to: { name: 'progress' },
    })
  }
  const latestA1c = journal.glucose.find((g) => g.kind === 'a1c')
  if (latestA1c) {
    tiles.push({
      key: 'a1c',
      label: 'HbA1c',
      value: formatA1c(latestA1c.value, settings.a1cUnit),
      note: formatDate(latestA1c.measuredAt),
      to: { name: 'progress' },
    })
  }
  const latestGlucose = journal.glucose.find((g) => g.kind === 'glucose' || g.kind === 'daily')
  if (latestGlucose) {
    tiles.push({
      key: 'glucose',
      label: 'Glucose',
      value: formatGlucose(latestGlucose.value, settings.glucoseUnit),
      note:
        latestGlucose.kind === 'glucose'
          ? GLUCOSE_CONTEXT_LABELS[latestGlucose.context]
          : formatDate(latestGlucose.measuredAt),
      to: { name: 'progress' },
    })
  }
  const latestBp = journal.vitals.find((v) => v.kind === 'bp')
  if (latestBp?.kind === 'bp') {
    tiles.push({
      key: 'bp',
      label: 'BP',
      value: formatBloodPressure(latestBp.systolic, latestBp.diastolic),
      note: formatDate(latestBp.measuredAt),
      to: { name: 'progress' },
    })
  }
  const latestHr = journal.vitals.find((v) => v.kind === 'hr')
  if (latestHr?.kind === 'hr') {
    tiles.push({
      key: 'hr',
      label: 'Heart rate',
      value: formatHeartRate(latestHr.bpm),
      note: formatDate(latestHr.measuredAt),
      to: { name: 'progress' },
    })
  }
  const recentSymptoms = summarizeSymptoms(
    journal.symptoms.map((s) => ({ ...s, at: toEpochMs(s.occurredAt) })),
    journal.doses.map((d) => toEpochMs(d.takenAt)),
    now.value - RECENT_DAYS * DAY_MS,
  )
  const symptomTotal = recentSymptoms.reduce((sum, s) => sum + s.count, 0)
  if (symptomTotal > 0 && recentSymptoms[0]) {
    tiles.push({
      key: 'symptoms',
      label: 'Side effects',
      value: String(symptomTotal),
      note: `${recentSymptoms[0].name} · 7 d`,
      to: { name: 'progress', hash: '#side-effects' },
    })
  }
  return tiles
})

const hasSections = computed(
  () =>
    dueItems.value.length > 0 ||
    systemRows.value.length > 0 ||
    latestTiles.value.length > 0 ||
    entries.value.length > 0,
)
</script>

<template>
  <div class="gl-page">
    <header class="mb-4">
      <p class="gl-eyebrow">Today</p>
      <h1 class="gl-display text-headline-large">{{ formatTodayDate(now) }}</h1>
    </header>

    <v-card v-if="isEmpty" class="gl-card-soft mb-4">
      <v-card-text class="gl-stack">
        <p class="text-title-large gl-display">Start with what you take</p>
        <p>Add your medicine and a weigh-in. Everything stays on this device.</p>
        <p class="text-body-small gl-muted d-flex align-center flex-wrap ga-1">
          <span>Units: {{ unitsSummary(settings.weightUnit, settings.heightUnit) }}.</span>
          <v-btn variant="text" :to="{ name: 'settings', hash: '#units' }">Change</v-btn>
        </p>
        <div class="d-flex flex-wrap ga-2">
          <v-btn color="primary" variant="flat" :prepend-icon="mdiPlus" @click="medDialog = true">
            Add medication
          </v-btn>
          <v-btn variant="outlined" :prepend-icon="mdiScaleBathroom" @click="log.start('weight')">
            Log a weight
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <v-card v-else-if="journal.loaded && !hasSections" variant="tonal" class="mb-4">
      <v-card-text class="gl-stack gl-stack--tight">
        <p>Nothing due yet.</p>
        <div>
          <v-btn variant="text" :to="{ name: 'medications' }" :append-icon="mdiChevronRight">
            Medications
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <div v-if="hasSections" class="today-sections">
      <section
        v-if="dueItems.length"
        class="gl-stack gl-stack--tight"
        aria-labelledby="due-heading"
      >
        <h2 id="due-heading" class="gl-display text-title-large">Due</h2>
        <div class="gl-stack">
          <DueCard
            v-for="item in dueItems"
            :key="item.id"
            :title="item.title"
            :due-label="item.dueAt !== null ? dueText(dueState(item.dueAt, now)) : undefined"
            :detail="item.detail"
            :to="item.to"
            @log="item.log()"
          >
            <template v-if="item.dueAt !== null" #countdown>
              <DoseCountdown
                :state="dueState(item.dueAt, now)"
                :remaining="remainingFraction(item.dueAt, item.intervalDays, now)"
              />
            </template>
          </DueCard>
        </div>
      </section>

      <SystemList :rows="systemRows" />

      <section
        v-if="latestTiles.length"
        class="gl-stack gl-stack--tight"
        aria-labelledby="latest-heading"
      >
        <h2 id="latest-heading" class="gl-display text-title-large">Latest</h2>
        <div class="tile-grid">
          <StatTile
            v-for="tile in latestTiles"
            :key="tile.key"
            :label="tile.label"
            :value="tile.value"
            :note="tile.note"
            :to="tile.to"
          />
        </div>
      </section>

      <section
        v-if="entries.length"
        class="gl-stack gl-stack--tight"
        aria-labelledby="recent-heading"
      >
        <h2 id="recent-heading" class="gl-display text-title-large">Recent</h2>
        <v-card>
          <v-card-text class="gl-stack gl-stack--tight">
            <EntriesTimeline :entries="entries" compact :limit="5" />
            <div>
              <v-btn variant="text" :to="{ name: 'history' }" :append-icon="mdiChevronRight">
                All entries
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </section>
    </div>

    <MedicationDialog v-model="medDialog" :medication="null" />
  </div>
</template>

<style scoped>
.today-sections {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  align-items: start;
}

@media (min-width: 840px) {
  .today-sections {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.tile-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
}
</style>

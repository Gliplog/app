<script setup lang="ts">
import { computed, onMounted, useId } from 'vue'
import {
  HEALTH_MEASURES,
  HEALTH_MEASURE_LABELS,
  type HealthMeasure,
  type SyncDirection,
  type SyncSchedule,
} from '@/domain/healthSync'
import { useHealthSyncStore } from '@/stores/healthSync'
import type { SyncResult } from '@/services/health/runSync'
import { useNotifyStore } from '@/stores/notify'
import { healthAccessSteps, healthStoreName } from '@/services/platform'
import { formatDateTime } from '@/services/time'
import { mdiChevronLeft, mdiRefresh } from '@/plugins/icons'

/**
 * Health apps: the user's choices for syncing with Apple Health or Health Connect. Nothing
 * syncs until they tap Sync now or Turn on, which is also when the system asks for access.
 */
const health = useHealthSyncStore()
const notify = useNotifyStore()
const platform = __PLATFORM__
const directionId = useId()
const scheduleId = useId()
const measuresId = useId()

onMounted(() => void health.checkAvailability())

const s = computed(() => health.settings)
const ongoing = computed(() => s.value.schedule === 'ongoing')
const on = computed(() => ongoing.value && s.value.enabled)

const DIRECTIONS: { value: SyncDirection; title: string }[] = [
  { value: 'import', title: 'Import' },
  { value: 'export', title: 'Export' },
  { value: 'both', title: 'Both ways' },
]

const directionText = computed(
  () =>
    ({
      import: `${healthStoreName} readings come into Gliplog.`,
      export: `Gliplog readings go to ${healthStoreName}.`,
      both: `Readings go both ways.`,
    })[s.value.direction],
)

const scheduleText = computed(() =>
  ongoing.value ? 'Syncs when you open Gliplog and after each new reading.' : 'Syncs once, now.',
)

/** While sync is on, a change asks for any new access straight away and syncs. */
async function change(changes: Partial<typeof s.value>) {
  await health.save(changes)
  if (on.value && s.value.measures.length) report(await health.run(true))
}

function toggleMeasure(measure: HealthMeasure, checked: boolean | null) {
  const next = HEALTH_MEASURES.filter((m) =>
    m === measure ? checked : s.value.measures.includes(m),
  )
  void change({ measures: next })
}

const setDirection = (direction: SyncDirection) => void change({ direction })
const setSchedule = (schedule: SyncSchedule) =>
  void health.save({ schedule, enabled: schedule === 'ongoing' && s.value.enabled })

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

function report(result: SyncResult | null) {
  if (!result) {
    notify.show(health.state.error || "Couldn't sync. Try again.", 'error')
    return
  }
  const parts = [`${plural(result.imported, 'reading')} in`, `${result.exported} out`]
  notify.show(
    `Synced: ${parts.join(', ')}.${result.failed ? ` ${result.failed} not accepted.` : ''}`,
    result.failed ? 'warning' : 'success',
  )
}

async function syncNow() {
  report(await health.run(true))
}

async function turnOn() {
  report(await health.turnOn())
}

const lastResult = computed(() => {
  const r = health.state.lastResult
  return r ? `${plural(r.imported, 'reading')} in, ${r.exported} out.` : ''
})
</script>

<template>
  <div class="gl-page">
    <header class="mb-4">
      <v-btn
        :to="{ name: 'settings' }"
        :prepend-icon="mdiChevronLeft"
        variant="text"
        class="mb-2 back"
      >
        Settings
      </v-btn>
      <p class="gl-eyebrow">Health apps</p>
      <h1 class="gl-display text-headline-large">{{ healthStoreName }}</h1>
    </header>

    <div class="health-grid">
      <v-card v-if="health.state.available === false">
        <v-card-item>
          <v-card-title class="text-wrap">{{ healthStoreName }} isn't available</v-card-title>
        </v-card-item>
        <v-card-text class="gl-stack">
          <p v-if="platform === 'android'">
            Install or update Health Connect from Google Play, then come back here.
          </p>
          <p v-else>This device doesn't have Apple Health.</p>
        </v-card-text>
      </v-card>

      <v-card>
        <v-card-item>
          <p class="gl-eyebrow">Sync</p>
          <v-card-title>{{ on ? 'On' : 'Off' }}</v-card-title>
          <v-card-subtitle v-if="s.lastSyncAt">
            Last synced {{ formatDateTime(s.lastSyncAt) }}
          </v-card-subtitle>
        </v-card-item>
        <v-card-text class="gl-stack gl-stack--loose">
          <div role="group" :aria-labelledby="measuresId">
            <p :id="measuresId" class="gl-label">Readings</p>
            <v-checkbox
              v-for="m in HEALTH_MEASURES"
              :key="m"
              :model-value="s.measures.includes(m)"
              :label="HEALTH_MEASURE_LABELS[m]"
              color="primary"
              density="compact"
              hide-details
              @update:model-value="toggleMeasure(m, $event)"
            />
          </div>

          <div>
            <p :id="directionId" class="gl-label">Direction</p>
            <v-btn-toggle
              :model-value="s.direction"
              role="group"
              mandatory
              density="comfortable"
              :aria-labelledby="directionId"
              class="gl-toggle-wrap"
              @update:model-value="setDirection"
            >
              <v-btn v-for="d in DIRECTIONS" :key="d.value" :value="d.value">{{ d.title }}</v-btn>
            </v-btn-toggle>
            <p class="text-body-small gl-muted mt-2">{{ directionText }}</p>
          </div>

          <div>
            <p :id="scheduleId" class="gl-label">When</p>
            <v-btn-toggle
              :model-value="s.schedule"
              role="group"
              mandatory
              density="comfortable"
              :aria-labelledby="scheduleId"
              @update:model-value="setSchedule"
            >
              <v-btn value="once">Once</v-btn>
              <v-btn value="ongoing">Ongoing</v-btn>
            </v-btn-toggle>
            <p class="text-body-small gl-muted mt-2">{{ scheduleText }}</p>
          </div>

          <p v-if="lastResult" class="text-body-small gl-muted">Last sync: {{ lastResult }}</p>

          <div class="gl-actions">
            <v-btn v-if="on" variant="text" @click="health.turnOff()">Turn off</v-btn>
            <v-btn
              v-if="on || !ongoing"
              color="primary"
              variant="flat"
              :prepend-icon="mdiRefresh"
              :loading="health.state.running"
              :disabled="!s.measures.length || health.state.available === false"
              @click="syncNow"
            >
              Sync now
            </v-btn>
            <v-btn
              v-else
              color="primary"
              variant="flat"
              :loading="health.state.running"
              :disabled="!s.measures.length || health.state.available === false"
              @click="turnOn"
            >
              Turn on
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <v-card>
        <v-card-item>
          <p class="gl-eyebrow">Good to know</p>
          <v-card-title>What syncs</v-card-title>
        </v-card-item>
        <v-card-text class="gl-stack">
          <p>Sync adds readings. It never edits or deletes them on either side.</p>
          <p>A glucose monitor's readings come in as one summary per day.</p>
          <p>Doses, side effects, HbA1c and photos stay in Gliplog.</p>
          <p>Other apps you allow in {{ healthStoreName }} can read what Gliplog exports.</p>
          <p v-if="platform === 'ios'">To change access: {{ healthAccessSteps }}</p>
          <div v-else class="gl-actions">
            <v-btn variant="tonal" @click="health.openHealthSettings()">
              Change access in Health Connect
            </v-btn>
          </div>
        </v-card-text>
      </v-card>
    </div>
  </div>
</template>

<style scoped>
.health-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr));
  align-items: start;
}

.back {
  margin-inline-start: -12px;
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import { findPkProfile } from '@/data'
import { anyDoseInEffect } from '@/domain/pk'
import { describeInterval, type CalendarSpec } from '@/domain/calendar'
import { dueDaysFor } from '@/domain/reminderDays'
import { planReminders } from '@/domain/reminders'
import {
  dueState,
  dueText,
  intervalText,
  remainingFraction,
  syringeReading,
} from '@/domain/schedule'
import { formatDose, roundTo } from '@/domain/units'
import { atLocalTime, formatDateTime } from '@/services/time'
import { useEntries } from '@/composables/useEntries'
import { useNow } from '@/composables/useNow'
import { remindersSupported } from '@/composables/useReminderSync'
import { useConfirmStore } from '@/stores/confirm'
import { useJournalStore } from '@/stores/journal'
import { useLogStore } from '@/stores/log'
import { useNotifyStore } from '@/stores/notify'
import { useSettingsStore } from '@/stores/settings'
import PkPanel from '@/components/charts/PkPanel.vue'
import DoseCountdown from '@/components/journal/DoseCountdown.vue'
import EntriesTimeline from '@/components/journal/EntriesTimeline.vue'
import MedicationDialog from '@/components/journal/MedicationDialog.vue'
import SyringeGraphic from '@/components/journal/SyringeGraphic.vue'
import AddReminderDialog from '@/components/reminders/AddReminderDialog.vue'
import ReminderControls from '@/components/reminders/ReminderControls.vue'
import {
  mdiArchiveArrowDownOutline,
  mdiArchiveArrowUpOutline,
  mdiBellOutline,
  mdiChevronLeft,
  mdiDeleteOutline,
  mdiNeedle,
  mdiPencilOutline,
} from '@/plugins/icons'

const props = defineProps<{ id: string }>()

const router = useRouter()
const journal = useJournalStore()
const log = useLogStore()
const settings = useSettingsStore()
const confirm = useConfirmStore()
const notify = useNotifyStore()
const now = useNow()
const { entries } = useEntries()

const editing = ref(false)
const reminderOpen = ref(false)

const med = computed(() => journal.medicationById(props.id))
const product = computed(() => journal.productOf(med.value))
const profile = computed(() => findPkProfile(product.value?.pkProfile))
const lastDose = computed(() => (med.value ? journal.lastDoseOf(med.value.id) : undefined))

const { smAndUp: labelledActions } = useDisplay()
const manageActions = computed(() => {
  const archived = med.value?.status === 'archived'
  return [
    {
      key: 'edit',
      label: 'Edit',
      icon: mdiPencilOutline,
      color: undefined,
      variant: 'outlined' as const,
      run: () => {
        editing.value = true
      },
    },
    {
      key: 'archive',
      label: archived ? 'Restart' : 'Stop',
      icon: archived ? mdiArchiveArrowUpOutline : mdiArchiveArrowDownOutline,
      color: undefined,
      variant: 'text' as const,
      run: toggleArchive,
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: mdiDeleteOutline,
      color: 'error',
      variant: 'text' as const,
      run: deleteMedication,
    },
  ]
})

const countdown = computed(() => {
  if (!med.value) return null
  const at = journal.nextDueOf(med.value)
  if (at === null) return null
  return {
    state: dueState(at, now.value),
    remaining: remainingFraction(at, med.value.intervalDays, now.value),
  }
})

const dueLabel = computed(() => {
  if (!med.value) return ''
  if (med.value.status === 'archived') return 'Stopped'
  return countdown.value ? dueText(countdown.value.state) : 'No dose logged yet'
})

const reading = computed(() => {
  const c = med.value?.concentrationMgPerMl
  return c && lastDose.value ? syringeReading(lastDose.value.doseMg, c) : null
})

const nextDueAt = computed(() => (med.value ? journal.nextDueOf(med.value) : null))

const reminderOn = computed(
  () => remindersSupported && !!med.value && settings.reminderFor(med.value.id).enabled,
)

const calendarSpec = computed<CalendarSpec>(() => {
  const m = med.value
  if (!m || nextDueAt.value === null) return { kind: 'needsDose' }
  const intervalText = describeInterval(m.intervalDays)
  return {
    kind: 'atChosenTime',
    startDayMs: nextDueAt.value,
    recurrence: { kind: 'everyDays', days: m.intervalDays },
    description: `Repeats ${intervalText}, from your last logged dose in Gliplog. If your dose day changes, add it again.`,
    summary: intervalText,
  }
})

const reminderPlan = computed(() => {
  const m = med.value
  if (!m) return { repeating: false, nextReminderAt: null as number | null }
  const duePlan = dueDaysFor({
    dueAt: nextDueAt.value,
    intervalDays: m.intervalDays,
    now: now.value,
  })
  const [next] = planReminders({
    subjectId: m.id,
    ...duePlan,
    rule: settings.reminderFor(m.id),
    now: now.value,
    atLocalTime,
  })
  return { repeating: duePlan.repeating, nextReminderAt: next?.at ?? null }
})

const group = computed(() => (med.value ? journal.levelGroupOf(med.value) : undefined))
const pkParams = computed(() => profile.value?.pk ?? med.value?.pkOverride ?? null)
const cleared = computed(() => {
  const m = med.value
  const g = group.value
  if (!m || m.status !== 'archived' || !pkParams.value || !g?.doses.length) return false
  return !anyDoseInEffect(g.doses, pkParams.value, now.value)
})

const groupCaption = computed(() => {
  const parts: string[] = []
  if (cleared.value) parts.push('Cleared.')
  const g = group.value
  if (g && g.medicationCount >= 2) {
    const names = g.medicationIds.map((id) => journal.medicationById(id)?.name).filter(Boolean)
    parts.push(`Includes doses of ${names.join(' and ')}.`)
  }
  return parts.length ? parts.join(' ') : undefined
})

const doseIds = computed(() => new Set(journal.dosesFor(props.id).map((d) => d.id)))
const doseEntries = computed(() =>
  entries.value.filter((e) => e.kind === 'dose' && doseIds.value.has(e.id)),
)

async function toggleArchive() {
  const m = med.value
  if (!m) return
  const archiving = m.status === 'active'
  await journal.updateMedication(m.id, { status: archiving ? 'archived' : 'active' })
  notify.show(archiving ? 'Moved to past medications' : 'Back in use', 'success')
}

async function deleteMedication() {
  const m = med.value
  if (!m) return
  const count = journal.dosesFor(m.id).length
  const ok = await confirm.ask({
    title: `Delete ${m.name}?`,
    text: count
      ? `This also deletes the ${count} dose${count === 1 ? '' : 's'} logged for it. To keep them, stop using it instead.`
      : 'It has no logged doses.',
    confirmText: 'Delete',
    destructive: true,
  })
  if (!ok) return
  await journal.deleteMedication(m.id)
  notify.show('Medication deleted', 'success')
  await router.replace({ name: 'medications' })
}
</script>

<template>
  <div class="gl-page">
    <template v-if="med">
      <header class="mb-4">
        <v-btn
          :to="{ name: 'medications' }"
          variant="text"
          :prepend-icon="mdiChevronLeft"
          class="mb-2"
        >
          Medications
        </v-btn>
        <p class="gl-eyebrow">{{ med.status === 'archived' ? 'Past medication' : 'Medication' }}</p>
        <div class="med-title-row">
          <h1 class="med-title gl-display text-headline-large">{{ med.name }}</h1>
          <div class="med-manage" aria-label="Manage medication" role="group">
            <template v-for="action in manageActions" :key="action.key">
              <v-btn
                v-if="labelledActions"
                :prepend-icon="action.icon"
                :color="action.color"
                :variant="action.variant"
                @click="action.run"
              >
                {{ action.label }}
              </v-btn>
              <v-btn
                v-else
                :icon="action.icon"
                :color="action.color"
                :aria-label="action.label"
                variant="text"
                @click="action.run"
              />
            </template>
          </div>
        </div>
        <p class="gl-muted">
          {{ product?.molecule ?? 'Not in the catalog' }} · {{ intervalText(med.intervalDays) }}
          <template v-if="med.concentrationMgPerMl">
            · {{ med.concentrationMgPerMl }} mg/mL</template
          >
        </p>
        <p v-if="med.notes" class="text-body-medium mt-2">{{ med.notes }}</p>
      </header>

      <div class="med-layout">
        <div class="d-flex flex-column ga-4">
          <v-card>
            <v-card-item>
              <p class="gl-eyebrow">Next dose</p>
            </v-card-item>
            <v-card-text class="gl-stack">
              <div class="med-due">
                <DoseCountdown
                  v-if="countdown && med.status === 'active'"
                  :state="countdown.state"
                  :remaining="countdown.remaining"
                />
                <p class="text-title-medium">{{ dueLabel }}</p>
              </div>
              <p v-if="lastDose" class="gl-muted">
                Last: <span class="gl-num">{{ formatDose(lastDose.doseMg) }}</span
                >,
                {{ formatDateTime(lastDose.takenAt) }}
              </p>
              <div v-if="reading" class="gl-inset med-reading">
                <SyringeGraphic :units="reading.units" :realistic="settings.realisticSyringe" />
                <div class="med-reading__text">
                  <span class="gl-num text-title-medium"
                    >{{ roundTo(reading.units, 1) }} units</span
                  >
                  <span class="gl-muted text-body-small">
                    {{ roundTo(reading.ml, 3) }} mL on a U-100 syringe, at
                    {{ med.concentrationMgPerMl }} mg/mL
                  </span>
                </div>
              </div>
              <div class="gl-actions">
                <v-btn
                  color="primary"
                  variant="flat"
                  :prepend-icon="mdiNeedle"
                  @click="log.start('dose', { medicationId: med.id })"
                >
                  Log dose
                </v-btn>
              </div>
            </v-card-text>
          </v-card>

          <v-card>
            <v-card-item>
              <p class="gl-eyebrow">Reminder</p>
              <v-card-title>Dose reminder</v-card-title>
            </v-card-item>
            <v-card-text class="gl-stack">
              <template v-if="reminderOn">
                <ReminderControls
                  :subject-id="med.id"
                  :repeating="reminderPlan.repeating"
                  :has-due="nextDueAt !== null"
                  :next-reminder-at="reminderPlan.nextReminderAt"
                />
                <div class="gl-actions">
                  <v-btn variant="text" @click="reminderOpen = true">Reminder options</v-btn>
                </div>
              </template>
              <template v-else>
                <p class="gl-muted">
                  {{
                    remindersSupported
                      ? 'Get a notification on the day a dose is due, or add a calendar invite.'
                      : 'Add a dose schedule to your calendar.'
                  }}
                </p>
                <div class="gl-actions">
                  <v-btn
                    variant="tonal"
                    :prepend-icon="mdiBellOutline"
                    @click="reminderOpen = true"
                  >
                    Add reminder
                  </v-btn>
                </div>
              </template>
            </v-card-text>
          </v-card>
        </div>

        <div class="d-flex flex-column ga-4">
          <PkPanel
            :source="profile"
            :override="med.pkOverride"
            :doses="group?.doses ?? []"
            :preview="null"
            unit-label="mg"
            :now="now"
            :title="profile?.name ?? med.name"
            :caption="groupCaption"
          />

          <section class="gl-stack gl-stack--tight">
            <h2 class="gl-display text-title-large">Doses</h2>
            <EntriesTimeline :entries="doseEntries" :kinds="['dose']" />
          </section>
        </div>
      </div>

      <MedicationDialog v-model="editing" :medication="med" />
      <AddReminderDialog
        v-model="reminderOpen"
        :subject-id="med.id"
        :name="med.name"
        :due-at="nextDueAt"
        :calendar="calendarSpec"
        :repeating="reminderPlan.repeating"
        :last-taken-at="lastDose?.takenAt ?? null"
        :next-reminder-at="reminderPlan.nextReminderAt"
      />
    </template>

    <v-card v-else-if="journal.loaded" variant="tonal">
      <v-card-text>
        This medication is not on this device.
        <v-btn :to="{ name: 'medications' }" variant="text">Back to medications</v-btn>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.med-layout {
  display: grid;
  gap: 16px;
}

@media (min-width: 840px) {
  .med-layout {
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    align-items: start;
  }
}

.med-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.med-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: break-word;
}

.med-manage {
  display: flex;
  flex: 0 0 auto;
  gap: 4px;
  margin-inline-start: auto;
}

.med-due {
  display: flex;
  align-items: center;
  gap: 16px;
}

.med-reading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.med-reading__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>

<script setup lang="ts">
import type { MedicationRow } from '@/db/database'
import { fromTimeValue, planReminders, toTimeValue } from '@/domain/reminders'
import { atLocalTime, formatDateTime, systemClock } from '@/services/time'
import { useJournalStore } from '@/stores/journal'
import { useSettingsStore } from '@/stores/settings'

/** A reminder that is on: its time of day, the day before, and when the next one comes. */
const props = defineProps<{ medication: MedicationRow }>()

const journal = useJournalStore()
const settings = useSettingsStore()

function setTime(value: string) {
  const time = fromTimeValue(value)
  if (time) void settings.setReminder(props.medication.id, time)
}

/** "Next reminder …", or why there is none yet. */
function nextReminderText(): string {
  const med = props.medication
  const dueAt = journal.nextDueOf(med)
  if (dueAt === null) return 'Reminders start after you log a first dose.'
  const [next] = planReminders({
    medicationId: med.id,
    dueAt,
    intervalDays: med.intervalDays,
    reminder: settings.reminderFor(med.id),
    now: systemClock().getTime(),
    atLocalTime,
  })
  return next
    ? `Next reminder ${formatDateTime(next.at)}`
    : 'No reminder until your next dose is logged.'
}
</script>

<template>
  <div class="gl-stack">
    <v-text-field
      :model-value="toTimeValue(settings.reminderFor(medication.id))"
      label="Time of day"
      type="time"
      @change="setTime(($event.target as HTMLInputElement).value)"
    />
    <v-switch
      v-if="medication.intervalDays > 1"
      :model-value="settings.reminderFor(medication.id).dayBefore"
      label="Also remind me the day before"
      color="primary"
      hide-details
      @update:model-value="settings.setReminder(medication.id, { dayBefore: !!$event })"
    />
    <p class="text-body-small gl-muted">{{ nextReminderText() }}</p>
  </div>
</template>

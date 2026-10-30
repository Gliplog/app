<script setup lang="ts">
import type { MedicationRow } from '@/db/database'
import { fromTimeValue, planReminders, toTimeValue } from '@/domain/reminders'
import { atLocalTime, formatDateTime, systemClock } from '@/services/time'
import { useJournalStore } from '@/stores/journal'
import { useNotifyStore } from '@/stores/notify'
import { useSettingsStore } from '@/stores/settings'

/**
 * One medication's dose reminder in the native app: on or off, the time of day, the day before,
 * and when the next one comes. Turning it on asks Android for notification permission first.
 * Used in Settings and in the reminder dialog on Today.
 */
const props = defineProps<{ medication: MedicationRow; label?: string }>()

const journal = useJournalStore()
const settings = useSettingsStore()
const notify = useNotifyStore()

async function setEnabled(enabled: boolean | null) {
  if (enabled && __NATIVE__) {
    const { requestNotificationPermission } = await import('@/services/reminders/nativeReminders')
    if (!(await requestNotificationPermission())) {
      notify.show('Notifications are off for Gliplog. Turn them on in Android settings.', 'error')
      return
    }
  }
  await settings.setReminder(props.medication.id, { enabled: !!enabled })
}

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
  <div class="gl-stack gl-stack--tight">
    <v-switch
      :model-value="settings.reminderFor(medication.id).enabled"
      :label="label ?? `Remind me about ${medication.name}`"
      color="primary"
      hide-details
      @update:model-value="setEnabled"
    />
    <template v-if="settings.reminderFor(medication.id).enabled">
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
    </template>
  </div>
</template>

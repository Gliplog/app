<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  calendarTitle,
  describeInterval,
  googleCalendarUrl,
  icsFile,
  outlookCalendarUrl,
  type CalendarEvent,
} from '@/domain/calendar'
import { fromTimeValue, toTimeValue } from '@/domain/reminders'
import { saveFile } from '@/services/fileTransfer'
import {
  atLocalTime,
  deviceTimeZone,
  fileDate,
  formatDateTime,
  localParts,
  nowIso,
  toEpochMs,
  toIso,
} from '@/services/time'
import { useNotifyStore } from '@/stores/notify'
import { useSettingsStore } from '@/stores/settings'
import { mdiDownload } from '@/plugins/icons'

/**
 * A subject's dose schedule as a repeating calendar event: a calendar file for any app, or
 * links that open Google Calendar or Outlook with it filled in. The calendar then reminds the
 * user, which the web app cannot do on its own.
 */
const props = defineProps<{
  subjectId: string
  name: string
  dueAt: number | null
  intervalDays: number
}>()

const settings = useSettingsStore()
const notify = useNotifyStore()

const time = ref('09:00')
const includeName = ref(false)

const EVENT_MINUTES = 15

// Start from the subject's reminder time, so a notification and an invite agree.
watch(
  () => props.subjectId,
  (id) => {
    time.value = toTimeValue(settings.reminderFor(id))
    includeName.value = settings.reminders.showNames
  },
  { immediate: true },
)

const event = computed<CalendarEvent | null>(() => {
  const dueAt = props.dueAt
  const at = fromTimeValue(time.value)
  if (dueAt === null || !at) return null
  const startMs = atLocalTime(dueAt, 0, at.hour, at.minute)
  const endMs = startMs + EVENT_MINUTES * 60_000
  return {
    uid: `${props.subjectId}-${fileDate(startMs)}@gliplog.com`,
    title: calendarTitle(includeName.value ? props.name : null),
    description: `Repeats ${describeInterval(props.intervalDays)}, from your last logged dose in Gliplog. If your dose day changes, add it again.`,
    start: localParts(startMs),
    end: localParts(endMs),
    startUtc: toIso(startMs),
    endUtc: toIso(endMs),
    timeZone: deviceTimeZone(),
    intervalDays: props.intervalDays,
    createdUtc: nowIso(),
  }
})

const startText = computed(() => {
  const e = event.value
  if (!e) return ''
  return `Starts ${formatDateTime(e.startUtc)} and repeats ${describeInterval(props.intervalDays)}.`
})

const links = computed(() => {
  const e = event.value
  if (!e) return null
  return {
    google: googleCalendarUrl(e),
    outlook: outlookCalendarUrl(e, 'outlook.live.com'),
    office: outlookCalendarUrl(e, 'outlook.office.com'),
  }
})

async function download() {
  const e = event.value
  if (!e) return
  const result = await saveFile(
    `gliplog-dose-${fileDate(toEpochMs(e.startUtc))}.ics`,
    icsFile(e),
    'text/calendar',
  )
  if (result !== 'cancelled')
    notify.show('Calendar invite saved. Open it to add the event.', 'success')
}
</script>

<template>
  <div v-if="!event" class="gl-stack">
    <p>Log a first dose, then add its schedule to your calendar.</p>
  </div>
  <div v-else class="gl-stack gl-stack--loose">
    <div class="gl-stack">
      <v-text-field v-model="time" label="Time of day" type="time" />
      <v-switch v-model="includeName" label="Show the name" color="primary" hide-details />
      <p class="text-body-small gl-muted">{{ startText }}</p>
    </div>

    <div class="gl-stack gl-stack--tight">
      <v-btn
        color="primary"
        variant="flat"
        size="large"
        block
        :prepend-icon="mdiDownload"
        @click="download"
      >
        Download calendar invite
      </v-btn>
      <p class="text-body-small gl-muted">
        Works with Apple, Samsung, Outlook and most calendar apps. Open it to add a repeating event
        with an alert.
      </p>
    </div>

    <div v-if="links" class="gl-stack gl-stack--tight">
      <p class="gl-label">Or add it online</p>
      <div class="d-flex flex-wrap ga-2">
        <v-btn variant="outlined" :href="links.google" target="_blank" rel="noopener noreferrer">
          Google Calendar
        </v-btn>
        <v-btn variant="outlined" :href="links.outlook" target="_blank" rel="noopener noreferrer">
          Outlook.com
        </v-btn>
        <v-btn variant="outlined" :href="links.office" target="_blank" rel="noopener noreferrer">
          Microsoft 365
        </v-btn>
      </div>
      <p class="text-body-small gl-muted">
        Sends the event to Google or Microsoft. In Outlook, set Repeat to
        {{ describeInterval(intervalDays) }} before saving.
      </p>
    </div>
  </div>
</template>

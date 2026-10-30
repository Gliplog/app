<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import type { MedicationRow } from '@/db/database'
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
import { useJournalStore } from '@/stores/journal'
import { useNotifyStore } from '@/stores/notify'
import { useSettingsStore } from '@/stores/settings'
import { mdiDownload } from '@/plugins/icons'

/**
 * Add a medication's dose schedule to the user's calendar as a repeating event: links that
 * open Google Calendar or Outlook with it filled in, or a calendar file for any app. The
 * calendar then reminds the user, which the web app cannot do on its own.
 */
const props = defineProps<{ medication: MedicationRow | null }>()
const open = defineModel<boolean>({ required: true })

const journal = useJournalStore()
const settings = useSettingsStore()
const notify = useNotifyStore()
const titleId = useId()

const time = ref('09:00')
const includeName = ref(false)

const EVENT_MINUTES = 15

// Reset from the reminder settings each time the dialog opens.
watch(open, (isOpen) => {
  const med = props.medication
  if (!isOpen || !med) return
  time.value = toTimeValue(settings.reminderFor(med.id))
  includeName.value = settings.reminders.showNames
})

const event = computed<CalendarEvent | null>(() => {
  const med = props.medication
  const dueAt = med ? journal.nextDueOf(med) : null
  const at = fromTimeValue(time.value)
  if (!med || dueAt === null || !at) return null
  const startMs = atLocalTime(dueAt, 0, at.hour, at.minute)
  const endMs = startMs + EVENT_MINUTES * 60_000
  return {
    uid: `${med.id}-${fileDate(startMs)}@gliplog.com`,
    title: calendarTitle(includeName.value ? med.name : null),
    description: `Repeats ${describeInterval(med.intervalDays)}, from your last logged dose in Gliplog. If your dose day changes, add it again.`,
    start: localParts(startMs),
    end: localParts(endMs),
    startUtc: toIso(startMs),
    endUtc: toIso(endMs),
    timeZone: deviceTimeZone(),
    intervalDays: med.intervalDays,
    createdUtc: nowIso(),
  }
})

const startText = computed(() => {
  const e = event.value
  const med = props.medication
  if (!e || !med) return ''
  return `Starts ${formatDateTime(e.startUtc)} and repeats ${describeInterval(med.intervalDays)}.`
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
    notify.show('Calendar file saved. Open it to add the event.', 'success')
}
</script>

<template>
  <v-dialog v-model="open" max-width="520" scrollable :aria-labelledby="titleId">
    <v-card>
      <v-card-item>
        <p class="gl-eyebrow">{{ medication?.name }}</p>
        <v-card-title :id="titleId">Add to calendar</v-card-title>
      </v-card-item>
      <v-card-text v-if="!event" class="gl-stack">
        <p>Log a first dose of this medication, then add its schedule to your calendar.</p>
      </v-card-text>
      <v-card-text v-else class="gl-stack gl-stack--loose">
        <div class="gl-stack">
          <v-text-field v-model="time" label="Time of day" type="time" />
          <v-switch
            v-model="includeName"
            label="Show the medication name"
            color="primary"
            hide-details
          />
          <p class="text-body-small gl-muted">{{ startText }}</p>
        </div>

        <div class="gl-stack gl-stack--tight">
          <p class="gl-label">Calendar file</p>
          <div>
            <v-btn color="primary" variant="flat" :prepend-icon="mdiDownload" @click="download">
              Download calendar file
            </v-btn>
          </div>
          <p class="text-body-small gl-muted">
            For Apple Calendar, Samsung Calendar, Outlook and most other calendar apps. It's made on
            this device; open it to add the repeating event with an alert.
          </p>
        </div>

        <div v-if="links" class="gl-stack gl-stack--tight">
          <p class="gl-label">Online calendars</p>
          <div class="d-flex flex-wrap ga-2">
            <v-btn
              variant="outlined"
              :href="links.google"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Calendar
            </v-btn>
            <v-btn
              variant="outlined"
              :href="links.outlook"
              target="_blank"
              rel="noopener noreferrer"
            >
              Outlook.com
            </v-btn>
            <v-btn
              variant="outlined"
              :href="links.office"
              target="_blank"
              rel="noopener noreferrer"
            >
              Microsoft 365
            </v-btn>
          </div>
          <p class="text-body-small gl-muted">
            These open the calendar's website with the event filled in, so its title and times go to
            Google or Microsoft. Google adds it repeating. Outlook adds one event: set Repeat to
            {{ medication ? describeInterval(medication.intervalDays) : '' }} before you save.
            Microsoft 365 is for a work or school account.
          </p>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

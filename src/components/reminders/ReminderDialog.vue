<script setup lang="ts">
import { ref, useId } from 'vue'
import type { MedicationRow } from '@/db/database'
import { mdiCalendarPlus } from '@/plugins/icons'
import AddToCalendarDialog from './AddToCalendarDialog.vue'
import MedicationReminderControls from './MedicationReminderControls.vue'

/**
 * A medication's reminder, opened from its card on Today in the native app: the notification
 * settings, and the calendar as an alternative. The web app opens the calendar dialog directly.
 */
defineProps<{ medication: MedicationRow | null }>()
const open = defineModel<boolean>({ required: true })

const titleId = useId()
const calendarOpen = ref(false)
</script>

<template>
  <v-dialog v-model="open" max-width="480" scrollable :aria-labelledby="titleId">
    <v-card v-if="medication">
      <v-card-item>
        <p class="gl-eyebrow">{{ medication.name }}</p>
        <v-card-title :id="titleId">Dose reminder</v-card-title>
      </v-card-item>
      <v-card-text class="gl-stack">
        <MedicationReminderControls :medication="medication" label="Remind me" />
        <p class="text-body-small gl-muted">
          A notification on the day your next dose is due. Tap it to log the dose.
        </p>
        <v-divider />
        <div>
          <v-btn variant="text" :prepend-icon="mdiCalendarPlus" @click="calendarOpen = true">
            Add to calendar instead
          </v-btn>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Done</v-btn>
      </v-card-actions>
    </v-card>
    <AddToCalendarDialog v-model="calendarOpen" :medication="medication" />
  </v-dialog>
</template>

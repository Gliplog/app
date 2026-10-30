<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import type { MedicationRow } from '@/db/database'
import { toTimeValue } from '@/domain/reminders'
import { remindersSupported } from '@/composables/useReminderSync'
import { formatDate, formatWeekday } from '@/services/time'
import { nativeApps } from '@/services/platform'
import { useJournalStore } from '@/stores/journal'
import { useSettingsStore } from '@/stores/settings'
import {
  mdiBellRingOutline,
  mdiCalendarPlus,
  mdiCheckCircle,
  mdiChevronLeft,
  mdiChevronRight,
} from '@/plugins/icons'
import CalendarInviteForm from './CalendarInviteForm.vue'
import NotifyMePanel from './NotifyMePanel.vue'

/**
 * Add a reminder for one medication: a choice of "Notify me" (the native app's own
 * notification) or "Add calendar invite" (any calendar, which works everywhere), each opening
 * in place with a back arrow, as a settings screen pushes a page. The web build shows Notify me
 * as unavailable and says why, rather than hiding it.
 */
const props = defineProps<{ medication: MedicationRow | null }>()
const open = defineModel<boolean>({ required: true })

const journal = useJournalStore()
const settings = useSettingsStore()
const titleId = useId()

type Step = 'choose' | 'notify' | 'calendar'
const step = ref<Step>('choose')

watch(open, (isOpen) => {
  if (isOpen) step.value = 'choose'
})

const TITLES: Record<Step, string> = {
  choose: 'Add reminder',
  notify: 'Notify me',
  calendar: 'Calendar invite',
}

const notifyOn = computed(
  () =>
    remindersSupported && !!props.medication && settings.reminderFor(props.medication.id).enabled,
)

const nextDose = computed(() => {
  const med = props.medication
  const at = med ? journal.nextDueOf(med) : null
  return at === null ? 'No dose logged yet' : `Next dose ${formatWeekday(at)}, ${formatDate(at)}`
})

const notifySubtitle = computed(() => {
  const med = props.medication
  if (!remindersSupported) return `Needs ${nativeApps}`
  if (!med || !notifyOn.value) return 'A notification on the day your dose is due'
  const r = settings.reminderFor(med.id)
  return `On at ${toTimeValue(r)}${r.dayBefore && med.intervalDays > 1 ? ', and the day before' : ''}`
})
</script>

<template>
  <v-dialog v-model="open" max-width="480" scrollable :aria-labelledby="titleId">
    <v-card v-if="medication" class="reminder">
      <v-card-item>
        <template v-if="step !== 'choose'" #prepend>
          <v-btn
            :icon="mdiChevronLeft"
            variant="text"
            aria-label="Back to reminder options"
            @click="step = 'choose'"
          />
        </template>
        <p class="gl-eyebrow">{{ medication.name }}</p>
        <v-card-title :id="titleId">{{ TITLES[step] }}</v-card-title>
      </v-card-item>

      <v-card-text>
        <v-window v-model="step" :touch="false">
          <v-window-item value="choose">
            <div class="gl-stack">
              <p class="gl-muted">{{ nextDose }}</p>
              <ul class="options" aria-label="Ways to be reminded">
                <li>
                  <button
                    type="button"
                    class="option"
                    :disabled="!remindersSupported"
                    :aria-describedby="`${titleId}-notify`"
                    @click="step = 'notify'"
                  >
                    <span class="option__badge">
                      <v-icon :icon="mdiBellRingOutline" />
                    </span>
                    <span class="option__text">
                      <span class="option__title">Notify me</span>
                      <span :id="`${titleId}-notify`" class="option__subtitle">
                        {{ notifySubtitle }}
                      </span>
                    </span>
                    <v-icon
                      v-if="notifyOn"
                      :icon="mdiCheckCircle"
                      color="primary"
                      aria-label="On"
                    />
                    <v-icon v-else-if="remindersSupported" :icon="mdiChevronRight" />
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    class="option"
                    :aria-describedby="`${titleId}-calendar`"
                    @click="step = 'calendar'"
                  >
                    <span class="option__badge">
                      <v-icon :icon="mdiCalendarPlus" />
                    </span>
                    <span class="option__text">
                      <span class="option__title">Add calendar invite</span>
                      <span :id="`${titleId}-calendar`" class="option__subtitle">
                        Apple, Google, Outlook and other calendars
                      </span>
                    </span>
                    <v-icon :icon="mdiChevronRight" />
                  </button>
                </li>
              </ul>
              <p v-if="!remindersSupported" class="text-body-small gl-muted">
                A web app can't wake itself to notify you without a server, and Gliplog doesn't have
                one. Your calendar can remind you instead.
              </p>
            </div>
          </v-window-item>

          <v-window-item value="notify">
            <NotifyMePanel
              v-if="step === 'notify'"
              :medication="medication"
              @calendar="step = 'calendar'"
            />
          </v-window-item>

          <v-window-item value="calendar">
            <CalendarInviteForm v-if="step === 'calendar'" :medication="medication" />
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Done</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.options {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 72px;
  padding: 12px 14px;
  border: 1px solid var(--gl-divider);
  border-radius: var(--gl-radius-lg);
  background: var(--gl-surface);
  color: var(--gl-text-1);
  text-align: start;
  font: inherit;
  cursor: pointer;
  transition:
    background-color var(--gl-dur-fast) var(--gl-ease-standard),
    border-color var(--gl-dur-fast) var(--gl-ease-standard);
}

.option:hover:not(:disabled) {
  background: var(--gl-surface-2);
  border-color: var(--gl-divider-strong);
}

.option:focus-visible {
  outline: none;
  box-shadow: var(--gl-shadow-focus);
}

.option:disabled {
  cursor: default;
  opacity: 0.6;
}

.option__badge {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--gl-radius-pill);
  color: var(--gl-brand-strong);
  background: var(--gl-brand-soft);
}

.option__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.option__title {
  font-weight: 600;
}

.option__subtitle {
  font-size: 0.875rem;
  color: var(--gl-text-2);
}
</style>

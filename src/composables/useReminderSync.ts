import { onBeforeUnmount, onMounted, watch } from 'vue'
import { planReminders, reminderText } from '@/domain/reminders'
import { useJournalStore } from '@/stores/journal'
import { useSettingsStore } from '@/stores/settings'
import { atLocalTime, systemClock } from '@/services/time'

/** Whether this build can schedule dose reminders: only the native app can wake itself. */
export const remindersSupported = __NATIVE__

/**
 * Keeps the device's scheduled dose reminders in step with the journal. Mount once, in App:
 * every write reloads the journal, so logging, editing or deleting a dose or medication, a
 * restore, an erase and a reminder setting change all re-plan. Returning to the app re-plans
 * too, which rolls a daily medicine's week of reminders forward. Does nothing on the web.
 */
export function useReminderSync() {
  if (!__NATIVE__) return
  const journal = useJournalStore()
  const settings = useSettingsStore()

  function plan() {
    const now = systemClock().getTime()
    const { showNames } = settings.reminders
    return journal.activeMedications
      .flatMap((med) =>
        planReminders({
          medicationId: med.id,
          dueAt: journal.nextDueOf(med),
          intervalDays: med.intervalDays,
          reminder: settings.reminderFor(med.id),
          now,
          atLocalTime,
        }).map((r) => ({ ...r, ...reminderText(r.kind, showNames ? med.name : null) })),
      )
      .sort((a, b) => a.at - b.at)
  }

  // Serialised so a burst of writes cannot interleave cancel and schedule calls.
  let queue = Promise.resolve()
  function sync() {
    if (!journal.loaded || !settings.loaded) return
    const reminders = plan()
    queue = queue
      .then(async () => {
        const { scheduleReminders } = await import('@/services/reminders/nativeReminders')
        await scheduleReminders(reminders)
      })
      .catch(() => {
        // A failed schedule leaves the previous set; the next change or launch tries again.
      })
  }

  watch(
    () => [journal.medications, journal.doses, settings.reminders, journal.loaded, settings.loaded],
    sync,
    { immediate: true },
  )

  function onVisible() {
    if (document.visibilityState === 'visible') sync()
  }
  onMounted(() => document.addEventListener('visibilitychange', onVisible))
  onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible))
}

import { onBeforeUnmount, onMounted, watch } from 'vue'
import { dueDaysFor } from '@/domain/reminderDays'
import {
  capReminders,
  groupByMinute,
  MAX_PENDING,
  planReminders,
  reminderText,
} from '@/domain/reminders'
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
    const names = new Map(journal.activeMedications.map((m) => [m.id, m.name]))
    const planned = journal.activeMedications.flatMap((med) =>
      planReminders({
        subjectId: med.id,
        ...dueDaysFor({ dueAt: journal.nextDueOf(med), intervalDays: med.intervalDays, now }),
        rule: settings.reminderFor(med.id),
        now,
        atLocalTime,
      }),
    )
    const grouped = capReminders(groupByMinute(planned), MAX_PENDING)
    return grouped.map((g) => ({
      ...g,
      ...reminderText(
        g.kind,
        showNames ? g.subjectIds.map((id) => names.get(id) ?? '').filter(Boolean) : null,
        { count: g.subjectIds.length },
      ),
    }))
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

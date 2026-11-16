import { computed, type ComputedRef, type Ref } from 'vue'
import { atLocalTime, formatTime } from '@/services/time'
import { useJournalStore } from '@/stores/journal'

export interface ScheduledDose {
  at: number
  label: string
}

/**
 * Doses scheduled in `[from, to)` from today onward, plus the latest selectable calendar day.
 * Gliplog marks only each active medication's next due time because schedules run from the last dose.
 */
export function useScheduledDays(now: Ref<number>): {
  scheduledIn: (from: number, to: number) => ScheduledDose[]
  lastSelectable: ComputedRef<number>
} {
  const journal = useJournalStore()

  const upcoming = computed<ScheduledDose[]>(() => {
    const todayStart = atLocalTime(now.value, 0, 0, 0)
    const items: ScheduledDose[] = []
    for (const med of journal.activeMedications) {
      const due = journal.nextDueOf(med)
      if (due !== null && due >= todayStart) {
        items.push({ at: due, label: `${med.name} at ${formatTime(due)}` })
      }
    }
    return items.sort((a, b) => a.at - b.at)
  })

  const lastSelectable = computed(() => {
    const todayStart = atLocalTime(now.value, 0, 0, 0)
    let latest = todayStart
    for (const item of upcoming.value) {
      const day = atLocalTime(item.at, 0, 0, 0)
      if (day > latest) latest = day
    }
    return latest
  })

  function scheduledIn(from: number, to: number): ScheduledDose[] {
    return upcoming.value.filter((item) => item.at >= from && item.at < to)
  }

  return { scheduledIn, lastSelectable }
}

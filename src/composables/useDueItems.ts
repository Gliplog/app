import { computed, type ComputedRef, type Ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { sortDue, type DueItem } from '@/domain/due'
import { formatDose } from '@/domain/units'
import { formatDay, toEpochMs } from '@/services/time'
import { useJournalStore } from '@/stores/journal'
import { useLogStore } from '@/stores/log'

export interface GliplogDueItem extends DueItem {
  intervalDays: number
  to: RouteLocationRaw
  log: () => void
}

/** Active medications sorted soonest due first, with a formatted last-dose line and log action. */
export function useDueItems(now: Ref<number>): {
  items: ComputedRef<GliplogDueItem[]>
} {
  const journal = useJournalStore()
  const log = useLogStore()

  const items = computed<GliplogDueItem[]>(() =>
    sortDue(
      journal.activeMedications.map((med) => {
        const last = journal.lastDoseOf(med.id)
        let detail = 'No doses yet'
        if (last) {
          const day = formatDay(toEpochMs(last.takenAt), now.value)
          const when = day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : day
          detail = `Last: ${formatDose(last.doseMg)}, ${when}`
        }
        return {
          id: med.id,
          title: med.name,
          detail,
          dueAt: journal.nextDueOf(med),
          intervalDays: med.intervalDays,
          to: { name: 'medication', params: { id: med.id } },
          log: () => log.start('dose', { medicationId: med.id }),
        }
      }),
    ),
  )

  return { items }
}

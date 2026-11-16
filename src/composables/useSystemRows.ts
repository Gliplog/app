import { computed, type ComputedRef, type Ref } from 'vue'
import type { SystemRow } from '@/components/today/SystemList.vue'
import { levelsModel } from '@/domain/levels'
import { anyDoseInEffect, levelNow, lookbackHoursFor } from '@/domain/pk'
import { curveTrace } from '@/domain/projection'
import { formatAmount } from '@/domain/units'
import { useJournalStore } from '@/stores/journal'

/** Estimated amount in the body now for each pooled medicine with a curve still in effect. */
export function useSystemRows(now: Ref<number>): {
  rows: ComputedRef<SystemRow[]>
} {
  const journal = useJournalStore()

  const rows = computed<SystemRow[]>(() =>
    journal.levelGroups.flatMap((group) => {
      if (!group.pk || !anyDoseInEffect(group.doses, group.pk.params, now.value)) return []
      const targetId =
        [...group.medicationIds]
          .reverse()
          .find((id) => journal.medicationById(id)?.status === 'active') ??
        group.medicationIds[group.medicationIds.length - 1]
      if (!targetId) return []

      const { amount, percentOfPeak } = levelNow(group.doses, group.pk.params, now.value)
      const model = levelsModel({
        params: group.pk.params,
        doses: group.doses,
        preview: null,
        unitLabel: 'mg',
        now: now.value,
        lookbackHours: lookbackHoursFor(group.pk.params),
      })
      return [
        {
          key: group.key,
          label: group.label,
          amountText: formatAmount(amount, 'mg'),
          percentOfPeak,
          trace: curveTrace(model),
          to: { name: 'medication', params: { id: targetId } },
        },
      ]
    }),
  )

  return { rows }
}

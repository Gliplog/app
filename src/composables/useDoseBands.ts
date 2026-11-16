import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { dosePeriodsOverlap, type BandDose } from '@/domain/doseBands'
import { toEpochMs } from '@/services/time'
import { useJournalStore } from '@/stores/journal'

/**
 * Doses prepared for the trend chart's colour bands and callout pills. Medicines dosed in
 * sequence share the line as one story; medicines dosed over overlapping periods require choosing
 * one so bands do not jump back and forth.
 */
export function useDoseBands(): {
  /** Medicines with at least one logged dose, newest first. */
  candidates: ComputedRef<{ key: string; label: string }[]>
  /** The medicine marked on the line, or null for all of them. */
  marked: Ref<string | null>
  /** True when the user must pick one. */
  pick: ComputedRef<boolean>
  /** The doses to pass to `doseBands`. */
  doses: ComputedRef<BandDose[]>
} {
  const journal = useJournalStore()

  const allDoses = computed<BandDose[]>(() =>
    journal.doses.flatMap((d) => {
      const med = journal.medicationById(d.medicationId)
      if (!med) return []
      const group = journal.levelGroupOf(med)
      return [
        {
          key: group?.key ?? `med:${med.id}`,
          label: group?.label ?? med.name,
          at: toEpochMs(d.takenAt),
          amount: d.doseMg,
          unitLabel: 'mg',
        },
      ]
    }),
  )

  const candidates = computed(() => {
    const seen = new Set<string>()
    const list: { key: string; label: string }[] = []
    for (const d of allDoses.value) {
      if (seen.has(d.key)) continue
      seen.add(d.key)
      list.push({ key: d.key, label: d.label })
    }
    return list
  })

  const pick = computed(() => dosePeriodsOverlap(allDoses.value))
  const marked = ref<string | null>(null)

  watch(
    [pick, candidates],
    ([mustPick, list]) => {
      if (!mustPick) {
        marked.value = null
        return
      }
      if (!marked.value || !list.some((c) => c.key === marked.value)) {
        marked.value = list[0]?.key ?? null
      }
    },
    { immediate: true },
  )

  const doses = computed(() =>
    pick.value && marked.value
      ? allDoses.value.filter((d) => d.key === marked.value)
      : allDoses.value,
  )

  return { candidates, marked, pick, doses }
}

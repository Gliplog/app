import { computed, ref, watch } from 'vue'
import { findPkProfile } from '@/data'
import { LEVEL_STRIP_MAX, assignSlots, type StripInput } from '@/domain/levelStrip'
import type { DoseMarkInput } from '@/domain/doseMarks'
import { toEpochMs } from '@/services/time'
import { useJournalStore } from '@/stores/journal'

/**
 * The medicines that can take part in a level strip under a body measure, and every logged
 * dose for dose marks. Only medicines with a curve take part, the most recently dosed first, up
 * to LEVEL_STRIP_MAX; each keeps its colour slot while it stays in the strip. The chart and its
 * share image read the same inputs, so both draw the same lines in the same colours.
 */
export function useLevelStrip() {
  const journal = useJournalStore()

  const levelGroups = computed(() => journal.levelGroups.filter((g) => g.pk !== null))
  const stripGroups = computed(() => levelGroups.value.slice(0, LEVEL_STRIP_MAX))
  const slots = ref(new Map<string, number>())
  watch(
    stripGroups,
    (groups) =>
      (slots.value = assignSlots(
        groups.map((g) => g.key),
        slots.value,
      )),
    { immediate: true },
  )

  const inputs = computed<StripInput[]>(() =>
    stripGroups.value.map((g) => ({
      key: g.key,
      // A curve from the user's own half-life says so wherever its name appears.
      label: g.pk!.userSupplied ? `${g.label} (your values)` : g.label,
      params: g.pk!.params,
      doses: g.doses,
    })),
  )

  /** Where each line's half-life and peak come from, shown under the chart. */
  const sources = computed(() =>
    stripGroups.value.map((g) => ({
      key: g.key,
      label: g.label,
      userSupplied: g.pk!.userSupplied,
      pk: g.pk!.userSupplied ? null : (findPkProfile(g.pkProfile)?.pk ?? null),
    })),
  )

  /** Every logged dose, named by its medicine and pooled the way levels are. */
  const doses = computed<DoseMarkInput[]>(() =>
    journal.doses.flatMap((d) => {
      const med = journal.medicationById(d.medicationId)
      if (!med) return []
      const group = journal.levelGroupOf(med)
      return [
        {
          key: group?.key ?? `med:${med.id}`,
          label: group?.label ?? med.name,
          at: toEpochMs(d.takenAt),
          mg: d.doseMg,
        },
      ]
    }),
  )

  /** More medicines have curves than the strip shows. */
  const truncated = computed(() => levelGroups.value.length > LEVEL_STRIP_MAX)

  return { levelGroups, inputs, slots, sources, doses, truncated }
}

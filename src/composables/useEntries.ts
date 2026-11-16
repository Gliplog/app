import { computed, type ComputedRef } from 'vue'
import type { Entry } from '@/domain/entries'
import { glucoseEntry, photoEntry, symptomEntry, vitalEntry, weightEntry } from '@/domain/entryText'
import { sortByTime } from '@/domain/listing'
import { formatDose } from '@/domain/units'
import { SITE_LABELS } from '@/components/journal/siteLabels'
import { toEpochMs } from '@/services/time'
import { useJournalStore } from '@/stores/journal'
import { usePhotosStore } from '@/stores/photos'
import { useSettingsStore } from '@/stores/settings'

/** Every logged thing as timeline entries, newest first, formatted in the active display units. */
export function useEntries(): { entries: ComputedRef<Entry[]> } {
  const journal = useJournalStore()
  const photos = usePhotosStore()
  const settings = useSettingsStore()

  const entries = computed<Entry[]>(() => {
    const doseEntries: Entry[] = journal.doses.map((d) => {
      const medName = journal.medicationById(d.medicationId)?.name
      return {
        id: d.id,
        kind: 'dose',
        at: toEpochMs(d.takenAt),
        title: medName ? `${formatDose(d.doseMg)} ${medName}` : formatDose(d.doseMg),
        detail: d.site ? SITE_LABELS[d.site] : '',
        notes: d.notes,
      }
    })
    const weightEntries = journal.weights.map((w) =>
      weightEntry(w, settings.weightUnit, toEpochMs(w.measuredAt)),
    )
    const symptomEntries = journal.symptoms.map((s) => symptomEntry(s, toEpochMs(s.occurredAt)))
    const glucoseEntries = journal.glucose.map((g) =>
      glucoseEntry(
        g,
        { glucose: settings.glucoseUnit, a1c: settings.a1cUnit },
        toEpochMs(g.measuredAt),
      ),
    )
    const vitalEntries = journal.vitals.map((v) => vitalEntry(v, toEpochMs(v.measuredAt)))
    const photoEntries = photos.photos.map((p) => photoEntry(p, toEpochMs(p.takenAt)))

    return sortByTime(
      [
        ...doseEntries,
        ...weightEntries,
        ...symptomEntries,
        ...glucoseEntries,
        ...vitalEntries,
        ...photoEntries,
      ],
      (e) => e.at,
      'desc',
    )
  })

  return { entries }
}

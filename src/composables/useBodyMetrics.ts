import { computed } from 'vue'
import { bmi, bmiBand } from '@/domain/body'
import { useJournalStore } from '@/stores/journal'
import { useSettingsStore } from '@/stores/settings'
import { toEpochMs } from '@/services/time'

/**
 * BMI and its WHO adult band from the profile height and the latest weigh-in, plus BMI at every
 * weigh-in for the chart. Values are null without a height or a weigh-in.
 */
export function useBodyMetrics() {
  const settings = useSettingsStore()
  const journal = useJournalStore()

  const heightCm = computed(() => settings.profile.heightCm)

  const currentBmi = computed(() => {
    const latest = journal.latestWeight
    return latest && heightCm.value ? bmi(latest.kg, heightCm.value) : null
  })

  const band = computed(() => (currentBmi.value === null ? null : bmiBand(currentBmi.value)))

  /** BMI at each weigh-in, oldest first; empty without a height. */
  const bmiSeries = computed(() => {
    const h = heightCm.value
    if (!h) return []
    return [...journal.weights]
      .reverse()
      .map((w) => ({ at: toEpochMs(w.measuredAt), value: bmi(w.kg, h) }))
  })

  return { heightCm, currentBmi, band, bmiSeries }
}

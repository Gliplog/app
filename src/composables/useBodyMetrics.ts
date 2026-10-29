import { computed } from 'vue'
import { ageOn, bmi, bmiBand } from '@/domain/body'
import { useJournalStore } from '@/stores/journal'
import { useSettingsStore } from '@/stores/settings'
import { calendarMonth, toEpochMs } from '@/services/time'

/**
 * Age, BMI and the BMI band from the profile and the latest weigh-in, plus BMI at every
 * weigh-in for the chart. Values are null when the profile lacks what they need.
 */
export function useBodyMetrics(now: () => number) {
  const settings = useSettingsStore()
  const journal = useJournalStore()

  const age = computed(() => {
    const birth = settings.profile.birthMonth
    return birth ? ageOn(birth, calendarMonth(now())) : null
  })

  const heightCm = computed(() => settings.profile.heightCm)

  const currentBmi = computed(() => {
    const latest = journal.latestWeight
    return latest && heightCm.value ? bmi(latest.kg, heightCm.value) : null
  })

  const band = computed(() =>
    currentBmi.value === null ? null : bmiBand(currentBmi.value, age.value),
  )

  /** BMI at each weigh-in, oldest first; empty without a height. */
  const bmiSeries = computed(() => {
    const h = heightCm.value
    if (!h) return []
    return [...journal.weights]
      .reverse()
      .map((w) => ({ at: toEpochMs(w.measuredAt), value: bmi(w.kg, h) }))
  })

  return { age, heightCm, currentBmi, band, bmiSeries }
}

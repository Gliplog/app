import { computed } from 'vue'
import { roundTo } from '@/domain/units'
import { useJournalStore } from '@/stores/journal'
import { useSettingsStore } from '@/stores/settings'

export interface WeightTrendSummary {
  startAt: number
  startKg: number
  latestKg: number
  changeKg: number
  changePercent: number
  weeks: number | null
}

/**
 * Per-app weight goal and change summary read by the shared TrendCard and ShareTrendDialog so
 * both components stay identical across apps.
 */
export function useWeightSummary() {
  const journal = useJournalStore()
  const settings = useSettingsStore()

  const goalKg = computed(() => settings.profile.goalKg)

  const weightTrend = computed<WeightTrendSummary | null>(() => {
    const base = journal.baseline
    const last = journal.progress[journal.progress.length - 1]
    if (!base || !last) return null
    return {
      startAt: base.at,
      startKg: base.kg,
      latestKg: last.kg,
      changeKg: last.changeKg,
      changePercent: last.changePercent,
      weeks: base.basis === 'no-doses' ? null : roundTo(last.weeks, 0),
    }
  })

  return { goalKg, weightTrend }
}

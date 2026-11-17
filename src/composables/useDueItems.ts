import { computed, type ComputedRef, type Ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { findPkProfile } from '@/data'
import { dueToneFor, sortDue, type DueItem, type DueTone } from '@/domain/due'
import { levelKey, levelsModel } from '@/domain/levels'
import { anyDoseInEffect, levelNow, lookbackHoursFor } from '@/domain/pk'
import { curveTrace, levelTrace, type LevelTrace } from '@/domain/projection'
import { dueState, dueText } from '@/domain/schedule'
import { formatAmount, formatDose } from '@/domain/units'
import { formatDay, formatHours, toEpochMs } from '@/services/time'
import { useJournalStore } from '@/stores/journal'
import { useLogStore } from '@/stores/log'
import { outlookStat } from '@/components/charts/projectionText'
import type { DueCardLevel } from '@/components/today/DueCard.vue'

export interface GliplogDueItem extends DueItem {
  intervalDays: number
  dueLabel?: string
  dueTone?: DueTone
  trace: LevelTrace | null
  level: DueCardLevel | null
  canLog: boolean
  scheduled: boolean
  to: RouteLocationRaw
  log: () => void
}

/**
 * Active medications (soonest due first) plus any stopped medication whose levels are still in
 * the body, each carrying its estimated-level trace and readings when a half-life applies.
 */
export function useDueItems(now: Ref<number>): {
  items: ComputedRef<GliplogDueItem[]>
} {
  const journal = useJournalStore()
  const log = useLogStore()

  const items = computed<GliplogDueItem[]>(() => {
    const coveredGroupKeys = new Set<string>()

    const scheduledItems = sortDue(
      journal.activeMedications.map((med) => {
        const last = journal.lastDoseOf(med.id)
        let detail = 'No doses yet'
        if (last) {
          const day = formatDay(toEpochMs(last.takenAt), now.value)
          const when = day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : day
          detail = `Last: ${formatDose(last.doseMg)}, ${when}`
        }

        const dueAt = journal.nextDueOf(med)
        const state = dueAt !== null ? dueState(dueAt, now.value) : null
        const pk = journal.pkFor(med)
        const profileId = findPkProfile(journal.productOf(med)?.pkProfile)?.id ?? null
        const groupKey = levelKey({ id: med.id, pkProfile: profileId })
        const proj = journal.projectionOf(med, now.value)

        let trace: LevelTrace | null = null
        let level: DueCardLevel | null = null
        if (proj && pk) {
          coveredGroupKeys.add(groupKey)
          const history = journal.historyFor(med.id, profileId)
          const { amount, percentOfPeak } = levelNow(history, pk.params, now.value)
          const stat = outlookStat(proj.projection.outlook, now.value)
          trace = levelTrace(proj.projection, now.value)
          level = {
            amountText: formatAmount(amount, 'mg'),
            percentOfPeak,
            stat: { label: stat.label, value: stat.value },
            userSupplied: proj.userSupplied,
          }
        }

        return {
          id: med.id,
          title: med.name,
          detail,
          dueAt,
          intervalDays: med.intervalDays,
          dueLabel: state ? dueText(state) : undefined,
          dueTone: state ? dueToneFor(state.kind) : undefined,
          trace,
          level,
          canLog: true,
          scheduled: true,
          to: { name: 'medication', params: { id: med.id } },
          log: () => log.start('dose', { medicationId: med.id }),
        }
      }),
    )

    const clearingItems: GliplogDueItem[] = journal.levelGroups.flatMap((group) => {
      if (coveredGroupKeys.has(group.key)) return []
      if (!group.pk || !anyDoseInEffect(group.doses, group.pk.params, now.value)) return []
      const targetId = group.medicationIds[group.medicationIds.length - 1]
      if (!targetId) return []
      const med = journal.medicationById(targetId)
      const last = journal.lastDoseOf(targetId)
      let detail = 'Stopped'
      if (last) {
        const day = formatDay(toEpochMs(last.takenAt), now.value)
        const when = day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : day
        detail = `Last: ${formatDose(last.doseMg)}, ${when}`
      }

      const { amount, percentOfPeak } = levelNow(group.doses, group.pk.params, now.value)
      const model = levelsModel({
        params: group.pk.params,
        doses: group.doses,
        preview: null,
        unitLabel: 'mg',
        now: now.value,
        lookbackHours: lookbackHoursFor(group.pk.params),
      })
      const pts = curveTrace(model)
      const lastPt = pts[pts.length - 1]
      const trace: LevelTrace | null = lastPt ? { past: pts, future: [], now: lastPt } : null

      return [
        {
          id: `system:${group.key}`,
          title: med?.name ?? group.label,
          detail,
          dueAt: null,
          intervalDays: med?.intervalDays ?? 0,
          dueLabel: 'In your system',
          dueTone: 'brand' as const,
          trace,
          level: {
            amountText: formatAmount(amount, 'mg'),
            percentOfPeak,
            stat: { label: 'Half-life', value: formatHours(group.pk.params.halfLifeHours) },
            userSupplied: group.pk.userSupplied,
          },
          canLog: false,
          scheduled: false,
          to: { name: 'medication', params: { id: targetId } },
          log: () => {},
        },
      ]
    })

    return [...scheduledItems, ...clearingItems]
  })

  return { items }
}

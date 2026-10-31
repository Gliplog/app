import { reactive } from 'vue'
import { useJournalStore } from '@/stores/journal'
import { useSettingsStore } from '@/stores/settings'
import { useNotifyStore } from '@/stores/notify'
import type { ReportPeriod } from '@/domain/report'
import {
  availableSections,
  collectReport,
  type ReportSource,
} from '@/services/report/collectReport'
import type { ReportSection } from '@/services/report/reportData'
import { saveFile } from '@/services/fileTransfer'
import { fileDate, systemClock } from '@/services/time'

/**
 * Export the journal report for a period and the parts the user chose, as a PDF for a
 * prescriber or a clinic visit. The PDF writer loads only on the first export (it is precached
 * like every chunk, so this works offline); the file is built on the device and leaves only
 * through the share sheet or a download the user starts.
 */
export function useReportExport() {
  const journal = useJournalStore()
  const settings = useSettingsStore()
  const notify = useNotifyStore()
  const state = reactive({ busy: false })

  function sourceFor(period: ReportPeriod, now: number): Omit<ReportSource, 'sections'> {
    return {
      medications: journal.medications,
      doses: journal.doses,
      weights: journal.weights,
      symptoms: journal.symptoms,
      glucose: journal.glucose,
      levelGroups: journal.levelGroups,
      units: { weight: settings.weightUnit, a1c: settings.a1cUnit, glucose: settings.glucoseUnit },
      profile: settings.profile,
      period,
      now,
      locale: navigator.language,
    }
  }

  /** The parts with anything to print for `period`. */
  function available(period: ReportPeriod, now: number): Set<ReportSection> {
    return availableSections(sourceFor(period, now))
  }

  async function exportReport(
    period: ReportPeriod,
    sections: readonly ReportSection[],
  ): Promise<boolean> {
    state.busy = true
    try {
      const now = systemClock().getTime()
      const data = collectReport({ ...sourceFor(period, now), sections })
      const { renderReport } = await import('@/services/report/renderReport')
      const pdf = new Blob([renderReport(data)], { type: 'application/pdf' })
      const result = await saveFile(`gliplog-report-${fileDate(now)}.pdf`, pdf)
      if (result === 'downloaded') notify.show('Report saved to your downloads', 'success')
      return result !== 'cancelled'
    } catch {
      notify.show("Couldn't make the report on this device", 'error')
      return false
    } finally {
      state.busy = false
    }
  }

  return { state, actions: { exportReport, available } }
}

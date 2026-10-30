import { reactive } from 'vue'
import { useJournalStore } from '@/stores/journal'
import { useSettingsStore } from '@/stores/settings'
import { useNotifyStore } from '@/stores/notify'
import type { ReportPeriod } from '@/domain/report'
import { collectReport } from '@/services/report/collectReport'
import { saveFile } from '@/services/fileTransfer'
import { fileDate, systemClock } from '@/services/time'

/**
 * Export the journal report for a period as a PDF, for a prescriber or a clinic visit. The PDF
 * writer loads only on the first export (it is precached like every chunk, so this works
 * offline); the file is built on the device and leaves only through the share sheet or a
 * download the user starts.
 */
export function useReportExport() {
  const journal = useJournalStore()
  const settings = useSettingsStore()
  const notify = useNotifyStore()
  const state = reactive({ busy: false })

  async function exportReport(period: ReportPeriod): Promise<boolean> {
    state.busy = true
    try {
      const now = systemClock().getTime()
      const data = collectReport({
        medications: journal.medications,
        doses: journal.doses,
        weights: journal.weights,
        symptoms: journal.symptoms,
        glucose: journal.glucose,
        units: {
          weight: settings.weightUnit,
          a1c: settings.a1cUnit,
          glucose: settings.glucoseUnit,
        },
        period,
        now,
        locale: navigator.language,
      })
      const { renderJournalReport } = await import('@/services/report/journalReport')
      const pdf = new Blob([renderJournalReport(data)], { type: 'application/pdf' })
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

  return { state, actions: { exportReport } }
}

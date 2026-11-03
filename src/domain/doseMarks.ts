/**
 * Doses marked on a body-measure line (weight), at the line's height on the day each was taken,
 * so the line reads against the dosing history. Every dose gets a mark; only a change of
 * strength gets a label, since a weekly label would crowd a phone-width chart.
 */
import { valueAt } from './photos'

export interface DoseMarkInput {
  /** Pools doses of one medicine, so a change is read per medicine. */
  key: string
  /** The medicine's name, for the readout and the table. */
  label: string
  /** Epoch milliseconds. */
  at: number
  mg: number
}

export interface DoseMark extends DoseMarkInput {
  /** The line's height at `at`, in the line's own units. */
  value: number
  /** The first dose of a medicine on the line, or one at a different strength from its last. */
  changed: boolean
  /** The first dose of its medicine on the line. */
  first: boolean
}

/**
 * Marks for the doses that fall within the line's span (see `valueAt`; a dose more than a few
 * days past the first or last weigh-in has no measured height and is left off). The first mark
 * of each medicine on the line is labelled even when its strength began before the line did,
 * so the reader always sees which strength is in use.
 */
export function doseMarks(
  doses: readonly DoseMarkInput[],
  line: readonly { at: number; value: number }[],
): DoseMark[] {
  const lastMg = new Map<string, number>()
  const shown = new Set<string>()
  const marks: DoseMark[] = []
  for (const dose of [...doses].sort((a, b) => a.at - b.at)) {
    const previous = lastMg.get(dose.key)
    lastMg.set(dose.key, dose.mg)
    const value = valueAt(line, dose.at)
    if (value === null) continue
    const first = !shown.has(dose.key)
    shown.add(dose.key)
    marks.push({ ...dose, value, changed: first || previous !== dose.mg, first })
  }
  return marks
}

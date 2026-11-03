/**
 * Estimated medication levels drawn in a strip under a body measure (weight, BMI, HbA1c,
 * glucose), on the same time axis. They sit in their own panel rather than on a second axis of
 * the same plot, so neither scale can be lined up against the other to suggest a cause.
 *
 * Each medication is scaled to its own peak in the window: semaglutide and tirzepatide doses
 * differ several-fold in mg for a similar effect, so a shared mg axis would make a switch look
 * like "more drug". The amount in mg stays available beside every percentage.
 */
import { amountAt, rateConstants, simulate, type DoseEvent, type PkParameters } from './pk'

/**
 * At most three lines: three colours pass the colour-vision checks against each other in both
 * themes, and few people take more than two medicines that need separate curves.
 */
export const LEVEL_STRIP_MAX = 3

/** Below this share of the largest dose, a line's peak counts as cleared and draws flat. */
const CLEARED_FRACTION = 0.01

const DAY_MS = 86_400_000

export interface StripInput {
  key: string
  label: string
  params: PkParameters
  /** Every dose in mg, oldest first; doses before the window still count toward it. */
  doses: DoseEvent[]
}

export interface StripSeries {
  key: string
  label: string
  /** `[at, percent of own peak, amount in mg]`. */
  points: [number, number, number][]
  /** The highest estimated amount in the window, in mg; 0 when every dose has cleared. */
  peakMg: number
}

export interface StripReading {
  key: string
  label: string
  percent: number
  mg: number
}

/**
 * The shared window: from the first entry to the later of the last entry and now. A lone entry
 * from today would give no width, so the window then reaches back a week.
 */
export function stripWindow(times: readonly number[], now: number): { start: number; end: number } {
  const start = Math.min(...times, now)
  const end = Math.max(...times, now)
  return end - start > 0 ? { start, end } : { start: end - 7 * DAY_MS, end }
}

const percentOf = (mg: number, peak: number) => (peak > 0 ? (mg / peak) * 100 : 0)

function peakOf(input: StripInput, highest: number): number {
  const largestDose = input.doses.reduce((max, d) => Math.max(max, d.amount), 0)
  // A residue of long-cleared doses would otherwise scale up to a full-height line.
  return highest >= CLEARED_FRACTION * largestDose ? highest : 0
}

/** Every line sampled over the window and scaled to its own peak there. */
export function levelStrip(
  inputs: readonly StripInput[],
  window: { start: number; end: number },
): StripSeries[] {
  return inputs.map((input) => {
    const raw = simulate(input.doses, input.params, window)
    const peakMg = peakOf(
      input,
      raw.reduce((max, p) => Math.max(max, p.amount), 0),
    )
    return {
      key: input.key,
      label: input.label,
      points: raw.map((p) => [p.at, percentOf(p.amount, peakMg), p.amount]),
      peakMg,
    }
  })
}

/** Each line's level at one moment, computed exactly rather than read off the samples. */
export function stripReadings(
  inputs: readonly StripInput[],
  series: readonly StripSeries[],
  at: number,
): StripReading[] {
  return inputs.map((input, i) => {
    const mg = amountAt(at, input.doses, rateConstants(input.params))
    return {
      key: input.key,
      label: input.label,
      percent: percentOf(mg, series[i]?.peakMg ?? 0),
      mg,
    }
  })
}

/**
 * A colour slot (0 to max - 1) for each key. Keys that already had one keep it, so a medicine
 * never changes colour when another comes or goes; a new key takes the lowest free slot.
 */
export function assignSlots(
  keys: readonly string[],
  previous: ReadonlyMap<string, number>,
  max = LEVEL_STRIP_MAX,
): Map<string, number> {
  const slots = new Map<string, number>()
  for (const key of keys) {
    const slot = previous.get(key)
    if (slot !== undefined && slot < max) slots.set(key, slot)
  }
  const used = new Set(slots.values())
  for (const key of keys) {
    if (slots.has(key)) continue
    const free = Array.from({ length: max }, (_, i) => i).find((i) => !used.has(i))
    if (free === undefined) break
    slots.set(key, free)
    used.add(free)
  }
  return slots
}

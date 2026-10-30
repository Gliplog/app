/** The periods a report can cover. */
export type ReportPeriod = '30d' | '90d' | 'all'

const DAY_MS = 86_400_000

/** Epoch ms the period starts at; -Infinity for everything logged. */
export function periodStart(period: ReportPeriod, now: number): number {
  if (period === 'all') return -Infinity
  return now - (period === '30d' ? 30 : 90) * DAY_MS
}

/**
 * Round axis ticks spanning `min` to `max`, about `target` steps of 1, 2, 2.5 or 5 times a
 * power of ten, with the range widened to whole steps. A flat series gets a band around it.
 */
export function niceRange(min: number, max: number, target = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  if (max - min < 1e-9) {
    min -= 1
    max += 1
  }
  const raw = (max - min) / target
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw)!
  const from = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let v = from; v < max + step - step * 1e-9; v += step) ticks.push(Number(v.toPrecision(12)))
  return ticks
}

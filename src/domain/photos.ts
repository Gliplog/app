/**
 * Progress photos: sizing for storage, which weigh-in belongs beside a photo, and which two
 * photos a comparison opens on. Pixels are handled in `services/photos`; this is arithmetic.
 */

export const PHOTO_POSES = ['front', 'side', 'back', 'other'] as const

export type PhotoPose = (typeof PHOTO_POSES)[number]

export const POSE_LABELS: Record<PhotoPose, string> = {
  front: 'Front',
  side: 'Side',
  back: 'Back',
  other: 'Other',
}

/** Long edge of a stored photo: sharp on a phone, about 250 KB as a JPEG. */
export const IMAGE_EDGE = 1600
/** Long edge of a grid thumbnail, enough for a three-column grid on a high-density screen. */
export const THUMB_EDGE = 360

/** `width` × `height` scaled to fit `edge` on its longer side, never enlarged. */
export function fitWithin(
  width: number,
  height: number,
  edge: number,
): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) throw new RangeError('Image size must be positive.')
  const scale = Math.min(1, edge / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

const DAY_MS = 86_400_000

/**
 * The weigh-in closest in time to `at`, within `maxDays` either side, so a photo is shown with
 * a weight only when one was logged near it. Ties go to the earlier weigh-in.
 */
export function nearestWeight<T extends { at: number }>(
  weights: readonly T[],
  at: number,
  maxDays = 3,
): T | null {
  let best: T | null = null
  for (const w of weights) {
    const gap = Math.abs(w.at - at)
    if (gap > maxDays * DAY_MS) continue
    if (!best || gap < Math.abs(best.at - at) || (gap === Math.abs(best.at - at) && w.at < best.at))
      best = w
  }
  return best
}

/**
 * The pair a comparison opens on: the newest photo and the oldest one in the same pose, so a
 * front view is compared with a front view. Null until there are two photos of one pose.
 */
export function defaultComparison<T extends { id: string; at: number; pose: PhotoPose }>(
  photos: readonly T[],
): { before: T; after: T } | null {
  const sorted = [...photos].sort((a, b) => a.at - b.at)
  const after = sorted[sorted.length - 1]
  if (!after) return null
  const before = sorted.find((p) => p.pose === after.pose && p.id !== after.id)
  return before ? { before, after } : null
}

/**
 * How far apart two photos were taken and, when both have a nearby weigh-in, the change between
 * those weigh-ins (later minus earlier, in kg). Whole weeks from two weeks apart, days before.
 */
export function photoGap(
  a: { at: number; weight: { kg: number } | null },
  b: { at: number; weight: { kg: number } | null },
): { days: number; weeks: number | null; changeKg: number | null } {
  const [first, last] = a.at <= b.at ? [a, b] : [b, a]
  const days = Math.floor((last.at - first.at) / DAY_MS)
  return {
    days,
    weeks: days >= 14 ? Math.round(days / 7) : null,
    changeKg: first.weight && last.weight ? last.weight.kg - first.weight.kg : null,
  }
}

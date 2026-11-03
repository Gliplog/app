/**
 * Whether the medications marked as in use are different medicines: different molecules
 * (semaglutide and tirzepatide), or one molecule by different routes (an injection and a
 * tablet). A brand and a compounded version of the same molecule and route share a level
 * profile and are not flagged, nor are two brands of it (Ozempic and Wegovy).
 *
 * This states what the user's own records show, so they can catch a medication left marked
 * as in use after a switch. It makes no clinical claim and gives no advice.
 */

export interface OverlapMedication {
  id: string
  name: string
  /** The level profile shared by the same molecule and route, or null outside the catalog. */
  pkProfile: string | null
  molecule: string | null
  route: 'injection' | 'tablet' | null
}

type OverlapKind = 'molecules' | 'routes' | 'unknown'

export interface Overlap {
  kind: OverlapKind
  /** Names of every medication involved, in the order given. */
  names: string[]
  /** Distinct molecules, for the copy; empty for `unknown`. */
  molecules: string[]
  /**
   * Identifies this combination of medicines, so a dismissal holds until it changes. Built from
   * level profiles, so adding a second brand of a medicine already listed does not re-warn.
   */
  key: string
}

const groupKey = (m: OverlapMedication) => m.pkProfile ?? `med:${m.id}`

/** The overlap among active medications, or null when they are all one medicine. */
export function findOverlap(active: readonly OverlapMedication[]): Overlap | null {
  const keys = [...new Set(active.map(groupKey))]
  if (keys.length < 2) return null
  const unknown = active.some((m) => m.pkProfile === null || m.molecule === null)
  const molecules = [...new Set(active.map((m) => m.molecule).filter((m): m is string => !!m))]
  const kind: OverlapKind = unknown ? 'unknown' : molecules.length > 1 ? 'molecules' : 'routes'
  return {
    kind,
    names: active.map((m) => m.name),
    molecules: unknown ? [] : molecules,
    key: [...keys].sort().join('+'),
  }
}

/** "A", "A and B", "A, B and C". */
export function joinNames(names: readonly string[]): string {
  if (names.length < 2) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** The notice's headline and explanation, neutral and factual. */
export function overlapText(overlap: Overlap): { title: string; body: string } {
  const both = overlap.names.length === 2 ? 'both' : 'all'
  const title = `${joinNames(overlap.names)} are ${both} marked as in use`
  const why =
    overlap.kind === 'molecules'
      ? `They're different medicines: ${joinNames(overlap.molecules)}.`
      : overlap.kind === 'routes'
        ? `They're ${overlap.molecules[0]} taken two ways, as an injection and as a tablet.`
        : `Gliplog can't tell whether they're the same medicine.`
  return {
    title,
    body: `${why} If you've switched, mark the old one as stopped.`,
  }
}

/** Stored dismissals are untrusted input; keep a bounded list of strings. */
export function sanitizeDismissed(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && v.length < 500).slice(-50)
}

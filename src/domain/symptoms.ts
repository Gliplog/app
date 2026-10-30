import type { SourceRef } from './catalog'

/**
 * Side effects a user can log, in plain words. The list is the adverse reactions printed in the
 * US labels' clinical-trial tables (section 6.1) for semaglutide and tirzepatide, so it covers
 * what people in the trials reported most; "Something else" covers the rest. Gliplog records
 * what the user felt; it never says whether a symptom is caused by a medicine.
 */
const WEGOVY: SourceRef = {
  kind: 'label',
  citation: 'WEGOVY (semaglutide) US prescribing information, section 6.1, Table 3',
  url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ee06186f-2aa3-4990-a760-757579d8f77b',
}
const ZEPBOUND: SourceRef = {
  kind: 'label',
  citation: 'ZEPBOUND (tirzepatide) US prescribing information, section 6.1, Table 1',
  url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=487cd7e7-434c-4925-99fa-aa80b1cc776b',
}
const MOUNJARO: SourceRef = {
  kind: 'label',
  citation: 'MOUNJARO (tirzepatide) US prescribing information, section 6.1, Table 1',
  url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d2d7da5d-ad07-4228-955f-cf7e355c8cc0',
}

export const SYMPTOM_SOURCES: SourceRef[] = [WEGOVY, ZEPBOUND, MOUNJARO]

export const SYMPTOMS = [
  'nausea',
  'vomiting',
  'diarrhea',
  'constipation',
  'stomach-pain',
  'headache',
  'tiredness',
  'indigestion',
  'decreased-appetite',
  'dizziness',
  'bloating',
  'burping',
  'gas',
  'reflux',
  'hair-loss',
  'injection-site',
  'low-blood-sugar',
  'skin-sensitivity',
  'other',
] as const

export type Symptom = (typeof SYMPTOMS)[number]

/** Plain words first; the label's own term follows where it differs, for the prescriber. */
export const SYMPTOM_LABELS: Record<Symptom, string> = {
  nausea: 'Nausea',
  vomiting: 'Vomiting',
  diarrhea: 'Diarrhea',
  constipation: 'Constipation',
  'stomach-pain': 'Stomach pain',
  headache: 'Headache',
  tiredness: 'Tiredness',
  indigestion: 'Indigestion',
  'decreased-appetite': 'Less appetite',
  dizziness: 'Dizziness',
  bloating: 'Bloating',
  burping: 'Burping',
  gas: 'Gas',
  reflux: 'Heartburn or reflux',
  'hair-loss': 'Hair loss',
  'injection-site': 'Injection site reaction',
  'low-blood-sugar': 'Low blood sugar',
  'skin-sensitivity': 'Skin sensitivity or tingling',
  other: 'Something else',
}

/** The term the labels use, shown in a report so it matches what a prescriber reads. */
export const SYMPTOM_LABEL_TERMS: Partial<Record<Symptom, string>> = {
  'stomach-pain': 'abdominal pain',
  tiredness: 'fatigue',
  indigestion: 'dyspepsia',
  'decreased-appetite': 'decreased appetite',
  bloating: 'abdominal distension',
  burping: 'eructation',
  gas: 'flatulence',
  reflux: 'gastroesophageal reflux disease',
  'low-blood-sugar': 'hypoglycemia',
  'skin-sensitivity': 'dysesthesia',
}

export const SEVERITIES = ['mild', 'moderate', 'severe'] as const
export type Severity = (typeof SEVERITIES)[number]

export const SEVERITY_LABELS: Record<Severity, string> = {
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
}

/** What each level means, so entries stay comparable over months. */
export const SEVERITY_HINTS: Record<Severity, string> = {
  mild: 'Noticeable, but didn’t get in the way',
  moderate: 'Got in the way of some things',
  severe: 'Stopped me from doing things',
}

/**
 * The labels' warning about pancreatitis, shown when severe stomach pain is logged. It quotes
 * the label; it is not a diagnosis.
 */
export const PANCREATITIS_NOTE = {
  text: 'The prescribing labels describe severe stomach pain that may reach through to the back, with or without nausea or vomiting, as a possible sign of pancreatitis, and ask people to contact their healthcare provider promptly if they suspect it.',
  source: {
    kind: 'label',
    citation: 'ZEPBOUND (tirzepatide) US prescribing information, section 17 (acute pancreatitis)',
    url: ZEPBOUND.url,
  } satisfies SourceRef,
}

export interface SymptomEntry {
  symptom: Symptom
  /** The user's words for "Something else"; empty otherwise. */
  otherText: string
  severity: Severity
  /** Epoch milliseconds. */
  at: number
}

export interface SymptomSummary {
  /** The symptom key, or `other:<text>` so each "something else" is counted on its own. */
  key: string
  symptom: Symptom
  name: string
  count: number
  bySeverity: Record<Severity, number>
  lastAt: number
  /** Median days from the dose before each entry to the entry, or null with no dose before. */
  medianDaysAfterDose: number | null
}

const DAY_MS = 86_400_000

/** Display name of an entry: the user's own words for "Something else". */
export function symptomName(e: Pick<SymptomEntry, 'symptom' | 'otherText'>): string {
  return e.symptom === 'other' && e.otherText.trim()
    ? e.otherText.trim()
    : SYMPTOM_LABELS[e.symptom]
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/**
 * Each symptom logged since `since`: how often, how strong, when last, and how long after a dose
 * it tends to come, the pattern a prescriber usually asks about. Most frequent first.
 */
export function summarizeSymptoms(
  entries: readonly SymptomEntry[],
  doseTimes: readonly number[],
  since: number,
): SymptomSummary[] {
  const doses = [...doseTimes].sort((a, b) => a - b)
  const groups = new Map<string, { entries: SymptomEntry[] }>()
  for (const e of entries) {
    if (e.at < since) continue
    const key = e.symptom === 'other' ? `other:${symptomName(e).toLowerCase()}` : e.symptom
    const g = groups.get(key) ?? { entries: [] }
    g.entries.push(e)
    groups.set(key, g)
  }
  return [...groups.entries()]
    .map(([key, g]) => {
      const bySeverity: Record<Severity, number> = { mild: 0, moderate: 0, severe: 0 }
      const gaps: number[] = []
      for (const e of g.entries) {
        bySeverity[e.severity]++
        const before = doses.filter((d) => d <= e.at)
        const last = before[before.length - 1]
        if (last !== undefined) gaps.push((e.at - last) / DAY_MS)
      }
      const first = g.entries[0]!
      return {
        key,
        symptom: first.symptom,
        name: symptomName(first),
        count: g.entries.length,
        bySeverity,
        lastAt: Math.max(...g.entries.map((e) => e.at)),
        medianDaysAfterDose: median(gaps),
      }
    })
    .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt)
}

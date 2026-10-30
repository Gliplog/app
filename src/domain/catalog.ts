import type { PkParameters } from './pk'

/**
 * Where a number came from. `label` is a regulator-approved prescribing label, `trial` a
 * published clinical trial, `standard` a public-health standard (the WHO BMI bands), `model` an
 * assumption made by Tidebook where sources give only a range.
 */
export type SourceKind = 'label' | 'trial' | 'standard' | 'model'

/** How each kind of source is named wherever a figure is shown or shared. */
export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  label: 'Prescribing label',
  trial: 'Clinical trial',
  standard: 'Health standard',
  model: 'Modelling choice',
}

export interface SourceRef {
  kind: SourceKind
  citation: string
  url?: string
}

type Route = 'injection' | 'tablet'

/** `brand`: an approved product; `compounded`: pharmacy-made, not FDA-approved. */
type ProductKind = 'brand' | 'compounded'

interface CatalogPk extends PkParameters {
  /** Ranges or caveats from the source, shown beside the chart. */
  notes: string
  sources: SourceRef[]
}

/**
 * How one molecule behaves by one route. Doses pool by profile: the body does not know whether
 * semaglutide came from an Ozempic pen or a compounded vial, so switching keeps one curve.
 */
export interface PkProfile {
  id: string
  name: string
  /** Human pharmacokinetics, or null when the amount in the body cannot be estimated honestly. */
  pk: CatalogPk | null
  pkUnavailableReason?: string
}

interface TitrationStep {
  /** First week (injections) or day (tablets) of the step, counted from 1. */
  from: number
  doseMg: number
}

interface Titration {
  unit: 'week' | 'day'
  steps: TitrationStep[]
  /** What the label says after the last step, in plain words. */
  maintenance: string
  source: SourceRef
}

export interface CatalogProduct {
  id: string
  name: string
  kind: ProductKind
  /** Generic name, shown beside a brand: "semaglutide". */
  molecule: string
  route: Route
  maker: string | null
  /** The label's dosing interval; compounded products start here and the user may change it. */
  intervalDays: number
  /** Dose strengths, from the label for brands; typical label doses for compounded products. */
  strengths: { values: number[]; source: SourceRef }
  titration: Titration | null
  pkProfile: string
  /** Trials the user's progress can be set beside, most relevant first. */
  trialIds: string[]
  /** Shown on the medication card: an indication or a caution. */
  note: string
}

export type Population = 'obesity' | 't2d'

export const POPULATION_LABELS: Record<Population, string> = {
  obesity: 'Adults with obesity or overweight, without diabetes',
  t2d: 'Adults with type 2 diabetes',
}

/** A mean change at the endpoint week from the arm's mean baseline. */
interface EndpointChange {
  baseline: number
  change: number
}

export interface TrialArm {
  label: string
  /** Null for placebo or a non-GLP-1 comparator. */
  doseMg: number | null
  /** Set when the arm is a different medicine from the trial's own (semaglutide in SURPASS-2). */
  molecule?: string
  baselineKg: number
  /** Mean change at `weeks`: percent of baseline weight, or kilograms (see `measure`). */
  change: number
  /** HbA1c in percent (NGSP) at the same week, as the label prints it. */
  hba1c?: EndpointChange
  /** Fasting plasma or serum glucose in mg/dL, where the label prints it. */
  fastingGlucoseMgDl?: EndpointChange
}

/** Where a trial's glycemic results come from; they are often in a different table. */
interface TrialGlycemic {
  source: SourceRef
  /** The label's own name for its fasting glucose row ("Fasting serum glucose"). */
  fastingGlucoseLabel?: string
}

export interface Trial {
  id: string
  name: string
  molecule: string
  route: Route
  population: Population
  /** One line on who took part, beyond the population. */
  design: string
  weeks: number
  measure: 'percent' | 'kg'
  arms: TrialArm[]
  /** How the label analysed it: who is counted and how missing weights were handled. */
  analysis: string
  /** HbA1c (and sometimes fasting glucose) at the endpoint, when the label prints them. */
  glycemic?: TrialGlycemic
  source: SourceRef
}

export interface Catalog {
  version: number
  pkProfiles: PkProfile[]
  products: CatalogProduct[]
  trials: Trial[]
}

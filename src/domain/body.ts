/**
 * Body measures derived from the profile: age from a birth month, and body mass index from
 * height and weight. BMI is a population screening measure; the categories are the WHO adult
 * cut-offs and do not apply under 18.
 */

/** A birth month as "YYYY-MM". Kept as a calendar string, never an instant, so no time zone shifts it. */
export type BirthMonth = string

const BIRTH_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/

export function isBirthMonth(value: unknown): value is BirthMonth {
  return typeof value === 'string' && BIRTH_MONTH.test(value)
}

export interface CalendarDate {
  year: number
  /** 1 to 12. */
  month: number
}

/**
 * Completed years on `on`. Only the birth month is known, so a birthday month counts as
 * already reached: the age is never overstated by more than the days left in that month.
 */
export function ageOn(birth: BirthMonth, on: CalendarDate): number | null {
  const match = BIRTH_MONTH.exec(birth)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const age = on.year - year - (on.month < month ? 1 : 0)
  return age >= 0 ? age : null
}

/** Weight over height squared (kg/m²). */
export function bmi(weightKg: number, heightCm: number): number {
  if (!(weightKg > 0) || !(heightCm > 0))
    throw new RangeError('Weight and height must be positive.')
  const m = heightCm / 100
  return weightKg / (m * m)
}

type BmiCategory =
  'underweight' | 'healthy' | 'overweight' | 'obesity-1' | 'obesity-2' | 'obesity-3'

export interface BmiBand {
  category: BmiCategory
  label: string
  /** Inclusive lower bound, kg/m². */
  from: number
}

/** WHO adult BMI classification (Technical Report Series 894, 2000). */
export const BMI_BANDS: readonly BmiBand[] = [
  { category: 'underweight', label: 'Below the healthy range', from: 0 },
  { category: 'healthy', label: 'Healthy range', from: 18.5 },
  { category: 'overweight', label: 'Above the healthy range', from: 25 },
  { category: 'obesity-1', label: 'Obesity class 1', from: 30 },
  { category: 'obesity-2', label: 'Obesity class 2', from: 35 },
  { category: 'obesity-3', label: 'Obesity class 3', from: 40 },
]

export const BMI_SOURCE = {
  kind: 'standard',
  citation:
    'WHO Technical Report Series 894: Obesity, preventing and managing the global epidemic (2000)',
  url: 'https://iris.who.int/handle/10665/42330',
} as const

export const ADULT_AGE = 18

/** The WHO band for an adult's BMI, or null under 18. An unknown age is treated as adult. */
export function bmiBand(value: number, age: number | null): BmiBand | null {
  if (age !== null && age < ADULT_AGE) return null
  let band = BMI_BANDS[0]!
  for (const b of BMI_BANDS) if (value >= b.from) band = b
  return band
}

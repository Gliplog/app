/**
 * Body measures derived from the profile: body mass index from height and weight. BMI is a
 * population screening measure; the categories are the WHO adult cut-offs, which fit because
 * Gliplog is for adults only.
 */

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

/** Gliplog is for adults only, which is what lets it use the WHO adult BMI bands for everyone. */
export const ADULT_AGE = 18

/** The WHO adult band for a BMI. */
export function bmiBand(value: number): BmiBand {
  let band = BMI_BANDS[0]!
  for (const b of BMI_BANDS) if (value >= b.from) band = b
  return band
}

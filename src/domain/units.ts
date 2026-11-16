/**
 * Dose units Gliplog works in: doses are always milligrams, the unit every GLP-1 label uses.
 * Body units live in `bodyUnits.ts`.
 */

/**
 * Round for display without float noise (0.30000000000000004 -> 0.3). Keeps up to
 * `maxDecimals` places and drops trailing zeros.
 */
export function roundTo(value: number, maxDecimals: number): number {
  const factor = 10 ** maxDecimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/** "0.25 mg": three decimals below one unit, two above. */
export function formatAmount(value: number, unitLabel: string): string {
  return `${roundTo(value, value < 1 ? 3 : 2)} ${unitLabel}`
}

export function formatDose(mg: number): string {
  return formatAmount(mg, 'mg')
}

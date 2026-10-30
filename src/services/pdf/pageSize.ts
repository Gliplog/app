export interface PageSize {
  width: number
  height: number
}

/** ISO A4 and US Letter in points (1/72 inch). */
export const A4: PageSize = { width: 595.28, height: 841.89 }
export const LETTER: PageSize = { width: 612, height: 792 }

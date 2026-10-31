import { PdfPage, type Rgb } from '@/services/pdf/document'
import type { PageSize } from '@/services/pdf/pageSize'
import { ellipsise, wrap, type PdfFont } from '@/services/pdf/text'
import { ink } from './printPalette'
import type { ReportColumn, ReportStats, ReportTable } from './reportData'

export const MARGIN = 48
export const TOP = 48
const BOTTOM = 56
const ROW = 15

/**
 * Lays content down the page, starting a new page when the next block will not fit. Footers
 * are added once every page exists, so each can say "page n of m".
 */
export class Layout {
  readonly pages: PdfPage[] = []
  page!: PdfPage
  y = TOP
  readonly width: number

  constructor(readonly size: PageSize) {
    this.width = size.width - MARGIN * 2
    this.newPage()
  }

  newPage() {
    this.page = new PdfPage(this.size)
    this.pages.push(this.page)
    this.y = TOP
  }

  /** Whether `height` points still fit above the footer. */
  fits(height: number): boolean {
    return this.y + height <= this.size.height - BOTTOM
  }

  /** Start a new page unless `height` points still fit above the footer. */
  ensure(height: number) {
    if (!this.fits(height)) this.newPage()
  }

  /** Wrapped paragraph at the cursor, which moves below it. */
  paragraph(text: string, font: PdfFont, size: number, color: Rgb, leading = size * 1.35) {
    for (const line of wrap(text, font, size, this.width)) {
      this.ensure(leading)
      this.y += leading
      this.page.text(MARGIN, this.y - (leading - size) / 2, line, { font, size, color })
    }
  }

  /** A heading that never sits alone at the foot of a page: it moves on with what follows. */
  heading(text: string, size = 14) {
    this.ensure(size + 40)
    this.y += size + 4
    this.page.text(MARGIN, this.y, text, { font: 'bold', size, color: ink['text-1'] })
    this.y += 6
  }

  gap(points: number) {
    this.y += points
  }

  rule() {
    this.gap(10)
    this.ensure(1)
    this.page.line([MARGIN, this.y], [MARGIN + this.width, this.y], {
      color: ink.divider,
      width: 0.75,
    })
    this.gap(10)
  }

  /** Label-over-value figures: five fit one row; more split into even rows of up to four. */
  stats(stats: ReportStats) {
    if (!stats.length) return
    const per = stats.length <= 5 ? stats.length : Math.min(4, Math.ceil(stats.length / 2))
    const column = this.width / per
    for (let start = 0; start < stats.length; start += per) {
      this.ensure(34)
      stats.slice(start, start + per).forEach(([label, value], i) => {
        const x = MARGIN + i * column
        this.page.text(x, this.y + 10, label, { size: 8, color: ink['text-3'] })
        this.page.text(x, this.y + 25, ellipsise(value, 'bold', 11, column - 8), {
          font: 'bold',
          size: 11,
          color: ink['text-1'],
        })
      })
      this.y += 34
    }
  }

  /**
   * A table under `title`, continued with its header on the next page, then `notes`. With no
   * rows it prints the table's `empty` line instead.
   */
  table(title: string, table: ReportTable, notes: readonly string[] = []) {
    this.heading(title)
    if (!table.rows.length) {
      this.paragraph(table.empty, 'regular', 9, ink['text-2'])
    } else {
      this.tableHeader(table.columns)
      table.rows.forEach((cells, i) => {
        if (!this.fits(ROW)) {
          this.newPage()
          this.heading(`${title} (continued)`, 11)
          this.tableHeader(table.columns)
        }
        if (i % 2 === 1) this.page.rect(MARGIN, this.y, this.width, ROW, { fill: ink['surface-2'] })
        let x = MARGIN
        table.columns.forEach((c, j) => {
          const w = c.width * this.width
          const text = ellipsise(cells[j] ?? '', 'regular', 8.5, w - 8)
          this.page.text(c.align === 'right' ? x + w - 4 : x + 4, this.y + 10.5, text, {
            size: 8.5,
            color: c.muted ? ink['text-2'] : ink['text-1'],
            align: c.align,
          })
          x += w
        })
        this.y += ROW
      })
    }
    if (notes.length) this.gap(4)
    for (const note of notes) this.paragraph(note, 'regular', 8, ink['text-3'])
  }

  private tableHeader(columns: readonly ReportColumn[]) {
    this.y += 12
    let x = MARGIN
    for (const c of columns) {
      const w = c.width * this.width
      this.page.text(c.align === 'right' ? x + w - 4 : x + 4, this.y, c.title, {
        font: 'bold',
        size: 8.5,
        color: ink['text-2'],
        align: c.align,
      })
      x += w
    }
    this.y += 5
    this.page.line([MARGIN, this.y], [MARGIN + this.width, this.y], {
      color: ink['divider-strong'],
      width: 0.75,
    })
  }

  /** "page n of m" and `text` at the foot of every page; call once the last page exists. */
  footers(text: string) {
    this.pages.forEach((page, i) => {
      const y = this.size.height - 34
      page.line([MARGIN, y - 10], [this.size.width - MARGIN, y - 10], {
        color: ink.divider,
        width: 0.5,
      })
      page.text(MARGIN, y, text, { size: 7.5, color: ink['text-3'] })
      page.text(this.size.width - MARGIN, y, `Page ${i + 1} of ${this.pages.length}`, {
        size: 7.5,
        color: ink['text-3'],
        align: 'right',
      })
    })
  }
}

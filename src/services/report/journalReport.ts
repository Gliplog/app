import { niceRange } from '@/domain/report'
import { roundTo } from '@/domain/units'
import { buildPdf, PdfPage, type Point, type Rgb } from '@/services/pdf/document'
import type { PageSize } from '@/services/pdf/pageSize'
import { ellipsise, wrap, type PdfFont } from '@/services/pdf/text'
import { ink, MARK_COLOURS, rgb, tint } from './printPalette'

/** A measure over time, already in the reader's display unit. */
interface ReportSeries {
  points: readonly { at: number; value: number }[]
  unitLabel: string
  decimals: number
  window: { start: number; end: number }
}

interface ReportTable {
  columns: readonly ReportColumn[]
  rows: readonly (readonly string[])[]
  /** Shown in place of the table when there are no rows. */
  empty: string
}

interface ReportColumn {
  title: string
  /** Share of the page width, the columns summing to 1. */
  width: number
  align: 'left' | 'right'
}

/** Everything the report prints, already formatted for the reader's locale. */
export interface JournalReportData {
  pageSize: PageSize
  generated: string
  periodLabel: string
  /** Headline figures for the period, label then value. */
  summary: readonly (readonly [string, string])[]
  medications: ReportTable
  weight: { stats: readonly (readonly [string, string])[]; series: ReportSeries } | null
  symptoms: ReportTable
  symptomNote: string
  a1c: ReportTable
  glucose: ReportTable
  doses: ReportTable
  /** Citations printed under "About these numbers". */
  sources: readonly string[]
  /** Axis label for a date. */
  formatTick: (epochMs: number) => string
}

const MARGIN = 48
const TOP = 48
const BOTTOM = 56
const ROW = 15

const ABOUT = [
  'Everything here was logged by the person who made this report, on their own device. Tidebook ' +
    'does arithmetic and shows sourced references; it never recommends a dose and is not medical ' +
    'advice.',
  'Side effects are what the person recorded feeling, with the term the US prescribing labels ' +
    'use in brackets. The report does not say what caused them.',
]

/**
 * Lays content down the page, starting a new page when the next block will not fit. Footers
 * are added once every page exists, so each can say "page n of m".
 */
class Layout {
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

  /** Start a new page unless `height` points still fit above the footer. */
  ensure(height: number) {
    if (this.y + height > this.size.height - BOTTOM) this.newPage()
  }

  paragraph(text: string, font: PdfFont, size: number, color: Rgb, leading = size * 1.35) {
    for (const line of wrap(text, font, size, this.width)) {
      this.ensure(leading)
      this.y += leading
      this.page.text(MARGIN, this.y - (leading - size) / 2, line, { font, size, color })
    }
  }

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
}

/** Points along a cubic Bezier, for the mark's curves (the writer draws straight segments). */
function bezier(p0: Point, p1: Point, p2: Point, p3: Point, steps = 16): Point[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    const u = 1 - t
    return [
      u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
      u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1],
    ] as const
  })
}

/** The Tidebook mark from the geometry of src/assets/brand/tidebook-mark.svg (512 grid). */
function drawMark(page: PdfPage, x: number, y: number, size: number) {
  const k = size / 512
  const p = (gx: number, gy: number): Point => [x + gx * k, y + gy * k]
  const glyph = rgb(MARK_COLOURS.glyph)
  // The tile's gradient as two halves of its end colours; at this size it reads as one.
  page.rect(x, y, size, size, { fill: rgb(MARK_COLOURS.tileBottom) }, 112 * k)
  page.rect(x, y, size, size * 0.55, { fill: rgb(MARK_COLOURS.tileTop) }, 112 * k)
  page.rect(x, y + size * 0.3, size, size * 0.25, { fill: rgb(MARK_COLOURS.tileTop) })
  const tide = [
    ...bezier(p(92, 330), p(150, 330), p(168, 160), p(228, 160)),
    ...bezier(p(228, 160), p(292, 160), p(316, 292), p(420, 300)).slice(1),
  ]
  page.polyline(tide, { color: glyph, width: 40 * k })
  const wave = [
    ...bezier(p(92, 404), p(156, 380), p(188, 428), p(256, 404)),
    ...bezier(p(256, 404), p(324, 380), p(356, 380), p(420, 404)).slice(1),
  ]
  page.polyline(wave, { color: tint(glyph, 0.6), width: 24 * k })
  const [cx, cy] = p(228, 160)
  page.circle(cx, cy, 30 * k, { fill: rgb(MARK_COLOURS.peak) })
}

function drawHeader(layout: Layout, data: JournalReportData) {
  const { page } = layout
  drawMark(page, MARGIN, TOP - 6, 26)
  const word = page.text(MARGIN + 34, TOP + 13, 'Tide', {
    font: 'bold',
    size: 15,
    color: ink['text-1'],
  })
  page.text(MARGIN + 34 + word, TOP + 13, 'book', { font: 'bold', size: 15, color: ink.brand })
  page.text(layout.size.width - MARGIN, TOP + 12, `Generated ${data.generated}`, {
    size: 8.5,
    color: ink['text-3'],
    align: 'right',
  })

  layout.y = TOP + 52
  page.text(MARGIN, layout.y, 'REPORT', { font: 'bold', size: 8, color: ink.accent })
  layout.y += 24
  page.text(MARGIN, layout.y, 'GLP-1 journal', { font: 'bold', size: 22, color: ink['text-1'] })
  layout.y += 18
  page.text(MARGIN, layout.y, data.periodLabel, { size: 10.5, color: ink['text-2'] })
  layout.y += 18
  drawStats(layout, data.summary)
  layout.rule()
}

function drawStats(layout: Layout, stats: JournalReportData['summary']) {
  if (!stats.length) return
  layout.ensure(40)
  const { page } = layout
  const per = Math.min(stats.length, 4)
  const column = layout.width / per
  stats.forEach(([label, value], i) => {
    if (i > 0 && i % per === 0) layout.y += 34
    const x = MARGIN + (i % per) * column
    page.text(x, layout.y + 10, label, { size: 8, color: ink['text-3'] })
    page.text(x, layout.y + 25, ellipsise(value, 'bold', 11, column - 8), {
      font: 'bold',
      size: 11,
      color: ink['text-1'],
    })
  })
  layout.y += 34
}

function drawTableHeader(layout: Layout, columns: readonly ReportColumn[]) {
  const { page } = layout
  layout.y += 12
  let x = MARGIN
  for (const c of columns) {
    const w = c.width * layout.width
    page.text(c.align === 'right' ? x + w - 4 : x + 4, layout.y, c.title, {
      font: 'bold',
      size: 8.5,
      color: ink['text-2'],
      align: c.align,
    })
    x += w
  }
  layout.y += 5
  page.line([MARGIN, layout.y], [MARGIN + layout.width, layout.y], {
    color: ink['divider-strong'],
    width: 0.75,
  })
}

/** A titled table, continued with its header on the next page; `note` follows the last row. */
function drawTable(layout: Layout, title: string, table: ReportTable, note?: string) {
  layout.heading(title)
  if (!table.rows.length) {
    layout.paragraph(table.empty, 'regular', 9, ink['text-2'])
    layout.rule()
    return
  }
  drawTableHeader(layout, table.columns)
  table.rows.forEach((cells, i) => {
    if (layout.y + ROW > layout.size.height - BOTTOM) {
      layout.newPage()
      layout.heading(`${title} (continued)`, 11)
      drawTableHeader(layout, table.columns)
    }
    const { page } = layout
    if (i % 2 === 1) page.rect(MARGIN, layout.y, layout.width, ROW, { fill: ink['surface-2'] })
    let x = MARGIN
    table.columns.forEach((c, j) => {
      const w = c.width * layout.width
      const text = ellipsise(cells[j] ?? '', 'regular', 8.5, w - 8)
      page.text(c.align === 'right' ? x + w - 4 : x + 4, layout.y + 10.5, text, {
        size: 8.5,
        color: ink['text-1'],
        align: c.align,
      })
      x += w
    })
    layout.y += ROW
  })
  if (note) {
    layout.gap(4)
    layout.paragraph(note, 'regular', 8, ink['text-3'])
  }
  layout.rule()
}

function drawLineChart(
  page: PdfPage,
  box: { x: number; y: number; width: number; height: number },
  series: ReportSeries,
  formatTick: JournalReportData['formatTick'],
) {
  const { points, window, unitLabel, decimals } = series
  const values = points.map((p) => p.value)
  const ticks = niceRange(Math.min(...values), Math.max(...values))
  const lo = ticks[0]!
  const hi = ticks[ticks.length - 1]!
  const label = (v: number) => `${roundTo(v, decimals)} ${unitLabel}`.trim()
  const gutter = 44
  const plot = {
    x: box.x + gutter,
    y: box.y + 8,
    width: box.width - gutter - 6,
    height: box.height - 8 - 18,
  }
  const span = Math.max(1, window.end - window.start)
  const px = (at: number) => plot.x + ((at - window.start) / span) * plot.width
  const py = (v: number) => plot.y + plot.height - ((v - lo) / (hi - lo)) * plot.height
  const base = plot.y + plot.height

  for (const t of ticks) {
    page.line([plot.x, py(t)], [plot.x + plot.width, py(t)], {
      color: ink['chart-grid'],
      width: 0.5,
    })
    page.text(plot.x - 6, py(t) + 2.6, label(t), {
      size: 7.5,
      color: ink['chart-axis'],
      align: 'right',
    })
  }
  for (let i = 0; i <= 3; i++) {
    const at = window.start + (span * i) / 3
    const align = i === 0 ? 'left' : i === 3 ? 'right' : 'center'
    page.text(px(at), base + 12, formatTick(at), { size: 7.5, color: ink['chart-axis'], align })
  }
  const line: Point[] = points.map((p) => [px(p.at), py(p.value)])
  page.polyline(line, { color: ink['chart-logged'], width: 1.5 })
  for (const [x, y] of line) page.circle(x, y, 1.8, { fill: ink['chart-logged'] })
}

function drawWeight(layout: Layout, data: JournalReportData) {
  const weight = data.weight
  layout.heading('Weight')
  if (!weight) {
    layout.paragraph('No weigh-ins in this period.', 'regular', 9, ink['text-2'])
    layout.rule()
    return
  }
  drawStats(layout, weight.stats)
  if (weight.series.points.length > 1) {
    layout.ensure(170)
    drawLineChart(
      layout.page,
      { x: MARGIN, y: layout.y, width: layout.width, height: 160 },
      weight.series,
      data.formatTick,
    )
    layout.y += 162
  }
  layout.rule()
}

function drawFooters(layout: Layout) {
  const { pages, size } = layout
  pages.forEach((page, i) => {
    const y = size.height - 34
    page.line([MARGIN, y - 10], [size.width - MARGIN, y - 10], { color: ink.divider, width: 0.5 })
    page.text(MARGIN, y, 'Tidebook · A personal journal, not medical advice.', {
      size: 7.5,
      color: ink['text-3'],
    })
    page.text(size.width - MARGIN, y, `Page ${i + 1} of ${pages.length}`, {
      size: 7.5,
      color: ink['text-3'],
      align: 'right',
    })
  })
}

/**
 * Lay out the journal report and serialise it to PDF bytes. Pure: the same data gives the same
 * file, so it is tested without a browser. Callers format every date and number first.
 */
export function renderJournalReport(data: JournalReportData): Uint8Array<ArrayBuffer> {
  const layout = new Layout(data.pageSize)
  drawHeader(layout, data)
  drawTable(layout, 'Medications', data.medications)
  drawWeight(layout, data)
  drawTable(layout, 'Side effects', data.symptoms, data.symptomNote)
  drawTable(layout, 'HbA1c', data.a1c)
  drawTable(layout, 'Blood glucose', data.glucose)
  drawTable(layout, 'Dose log', data.doses)
  layout.heading('About these numbers', 12)
  for (const paragraph of [...ABOUT, ...data.sources.map((s) => `Source: ${s}`)]) {
    layout.paragraph(paragraph, 'regular', 8.5, ink['text-2'])
    layout.gap(3)
  }
  drawFooters(layout)
  return buildPdf(layout.pages, 'Tidebook report')
}

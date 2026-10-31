import { niceRange, niceTicks } from '@/domain/report'
import { roundTo } from '@/domain/units'
import type { PdfPage, Point, Rgb } from '@/services/pdf/document'
import { ellipsise, measure } from '@/services/pdf/text'
import { ink, tint } from './printPalette'
import type { ReportChart, ReportSeries, ReportTimelineRow } from './reportData'

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

interface AxisOptions {
  formatTick: (epochMs: number, spanMs: number) => string
  /** Print the time labels under this plot; stacked panels print them only under the last. */
  timeAxis: boolean
  /** Width left of the plot for value labels; stacked panels share one so their plots align. */
  gutter?: number
}

const TONE: Record<ReportSeries['tone'], Rgb> = {
  logged: ink['chart-logged'],
  preview: ink['chart-preview'],
  trial: ink['chart-trial'],
  placebo: ink['chart-placebo'],
}
const PAPER: Rgb = [1, 1, 1]

const TICK_SIZE = 7.5
const TITLE_ROW = 14
const AXIS_ROW = 18
const TIMELINE_ROW = 14

function valueTicks(chart: ReportChart): number[] {
  const values = [
    ...chart.series.flatMap((s) => s.points.map((p) => p.value)),
    ...chart.guides.map((g) => g.value),
    ...chart.band.flatMap((b) => [b.low, b.high]),
  ]
  if (!values.length) return [0, 1]
  if (chart.scale === 'zero') return niceTicks(Math.max(...values))
  const min = Math.min(...values)
  const max = Math.max(...values)
  // A little room either side, so a line at the edge is not drawn on the frame.
  const pad = Math.max((max - min) * 0.1, 5 * 10 ** -chart.decimals)
  return niceRange(min - pad, max + pad)
}

const tickLabel = (chart: ReportChart, v: number) =>
  chart.unitLabel === '%' ? `${roundTo(v, 3)}%` : `${roundTo(v, 3)} ${chart.unitLabel}`.trim()

/** The value-label width a chart needs, so stacked panels can share the widest. */
export function chartGutter(chart: ReportChart): number {
  return (
    Math.max(...valueTicks(chart).map((t) => measure(tickLabel(chart, t), 'regular', TICK_SIZE))) +
    8
  )
}

/** Height a timeline of `rows` takes, with or without its time labels. */
export function timelineHeight(rows: number, timeAxis: boolean): number {
  return TITLE_ROW + rows * TIMELINE_ROW + (timeAxis ? AXIS_ROW : 4)
}

/**
 * At most two points per column of the plot: the lowest and highest in each, in time order.
 * A long period of daily doses keeps every spike's height without writing thousands of
 * segments the eye cannot tell apart.
 */
function thin(points: readonly Point[], columns: number): Point[] {
  if (points.length <= columns * 2) return [...points]
  const x0 = points[0]![0]
  const step = (points[points.length - 1]![0] - x0) / columns || 1
  const out: Point[] = []
  let bucket: Point[] = []
  let index = 0
  const flush = () => {
    if (!bucket.length) return
    const lo = bucket.reduce((a, b) => (b[1] > a[1] ? b : a))
    const hi = bucket.reduce((a, b) => (b[1] < a[1] ? b : a))
    out.push(...(lo[0] <= hi[0] ? [lo, hi] : [hi, lo]))
    bucket = []
  }
  for (const p of points) {
    const i = Math.min(columns - 1, Math.floor((p[0] - x0) / step))
    if (i !== index) {
      flush()
      index = i
    }
    bucket.push(p)
  }
  flush()
  return out
}

/** Week labels on round numbers from week 0, for a trial comparison. */
function drawWeekLabels(page: PdfPage, plot: Box, window: ReportChart['window']) {
  const baseline = plot.y + plot.height
  const span = Math.max(1, window.end - window.start)
  for (const week of niceTicks(window.end, 6)) {
    if (week > window.end) continue
    const x = plot.x + ((week - window.start) / span) * plot.width
    page.text(x, baseline + 12, week === 0 ? 'Week 0' : String(week), {
      size: TICK_SIZE,
      color: ink['chart-axis'],
      align: week === 0 ? 'left' : 'center',
    })
  }
}

function drawTimeLabels(
  page: PdfPage,
  plot: Box,
  window: ReportChart['window'],
  formatTick: AxisOptions['formatTick'],
) {
  const span = window.end - window.start
  const baseline = plot.y + plot.height
  for (let i = 0; i <= 4; i++) {
    const at = window.start + (span * i) / 4
    const align = i === 0 ? 'left' : i === 4 ? 'right' : 'center'
    page.text(plot.x + (plot.width * i) / 4, baseline + 12, formatTick(at, span), {
      size: TICK_SIZE,
      color: ink['chart-axis'],
      align,
    })
  }
}

/** The legend's swatch: the series' own mark, so it reads without colour. */
function swatch(page: PdfPage, x: number, y: number, s: ReportSeries) {
  if (s.style === 'line' || s.style === 'area') {
    page.line([x, y], [x + 10, y], { color: TONE[s.tone], width: 2 })
  } else mark(page, x + 5, y, s)
}

/** One unjoined point in the series' shape; open when the point is marked hollow. */
function mark(page: PdfPage, x: number, y: number, s: ReportSeries, hollow = false) {
  const color = TONE[s.tone]
  const style = hollow ? { fill: PAPER, stroke: { color, width: 1.2 } } : { fill: color }
  if (s.style === 'diamond') {
    page.polygon(
      [
        [x, y - 4],
        [x + 3.4, y],
        [x, y + 4],
        [x - 3.4, y],
      ],
      style,
    )
  } else if (s.style === 'triangle') {
    page.polygon(
      [
        [x, y - 4],
        [x + 3.8, y + 2.8],
        [x - 3.8, y + 2.8],
      ],
      style,
    )
  } else if (s.style === 'hollow') {
    page.circle(x, y, 2.4, { fill: PAPER, stroke: { color, width: 1.1 } })
  } else {
    page.circle(x, y, 2.2, style)
  }
}

const BAND_LABEL = 'Range across trials'

/** Width of the legend, or 0 when one series needs none. */
function legendWidth(chart: ReportChart): number {
  if (chart.series.length < 2 && !chart.band.length) return 0
  const labels = [...chart.series.map((s) => s.label), ...(chart.band.length ? [BAND_LABEL] : [])]
  return labels.reduce((w, l) => w + measure(l, 'regular', TICK_SIZE) + 24, 0)
}

/**
 * Draw `chart` into `box`: title and legend on top, value labels on the left, then the series,
 * dose markers, band, reference lines and "Now". Values are plotted as given; nothing is computed
 * here beyond placing them.
 */
export function drawChart(page: PdfPage, box: Box, chart: ReportChart, options: AxisOptions) {
  const ticks = valueTicks(chart)
  const lo = ticks[0]!
  const hi = ticks[ticks.length - 1]!
  const gutter = options.gutter ?? chartGutter(chart)
  const legend = legendWidth(chart)
  const titleWidth = chart.title ? measure(chart.title, 'bold', 9) : 0
  // A legend that would run into the title takes a row of its own below it.
  const legendRow = legend > 0 && titleWidth + legend + 16 > box.width ? TITLE_ROW : 0
  const top = box.y + TITLE_ROW + legendRow
  const plot: Box = {
    x: box.x + gutter,
    y: top + 4,
    width: box.width - gutter - 6,
    height: box.height - TITLE_ROW - legendRow - 4 - (options.timeAxis ? AXIS_ROW : 4),
  }
  const { start, end } = chart.window
  const span = Math.max(1, end - start)
  const px = (at: number) => plot.x + ((at - start) / span) * plot.width
  const py = (v: number) => plot.y + plot.height - ((v - lo) / (hi - lo)) * plot.height
  const baseline = plot.y + plot.height

  if (chart.title) {
    page.text(box.x, box.y + 10, chart.title, { font: 'bold', size: 9, color: ink['text-1'] })
  }
  if (legend > 0) {
    const y = box.y + legendRow
    let x = box.x + box.width
    if (chart.band.length) {
      x -= measure(BAND_LABEL, 'regular', TICK_SIZE)
      page.text(x, y + 9.5, BAND_LABEL, { size: TICK_SIZE, color: ink['text-2'] })
      x -= 14
      page.rect(x, y + 4, 10, 6, { fill: tint(ink['chart-trial'], 0.3) }, 1.5)
      x -= 10
    }
    for (const s of [...chart.series].reverse()) {
      x -= measure(s.label, 'regular', TICK_SIZE)
      page.text(x, y + 9.5, s.label, { size: TICK_SIZE, color: ink['text-2'] })
      x -= 14
      swatch(page, x, y + 7, s)
      x -= 10
    }
  }

  for (const t of ticks) {
    page.line([plot.x, py(t)], [plot.x + plot.width, py(t)], {
      color: ink['chart-grid'],
      width: 0.5,
    })
    page.text(plot.x - 6, py(t) + 2.6, tickLabel(chart, t), {
      size: TICK_SIZE,
      color: ink['chart-axis'],
      align: 'right',
    })
  }
  if (options.timeAxis && chart.x === 'weeks') drawWeekLabels(page, plot, chart.window)
  else if (options.timeAxis) drawTimeLabels(page, plot, chart.window, options.formatTick)

  if (chart.band.length > 1) {
    const upper = chart.band.map((b): Point => [px(b.at), py(b.high)])
    const lower = chart.band.map((b): Point => [px(b.at), py(b.low)]).reverse()
    page.polygon([...upper, ...lower], { fill: tint(ink['chart-trial'], 0.16) })
    const edge = { color: tint(ink['chart-trial'], 0.55), width: 0.75 }
    page.polyline(upper, edge)
    page.polyline(lower, edge)
  }

  for (const g of chart.guides) {
    if (g.value < lo || g.value > hi) continue
    page.line([plot.x, py(g.value)], [plot.x + plot.width, py(g.value)], {
      color: ink['chart-now'],
      width: 0.6,
      dash: [3, 2],
    })
    page.text(plot.x + plot.width - 2, py(g.value) - 2.5, g.label, {
      size: 6.5,
      color: ink['chart-axis'],
      align: 'right',
    })
  }

  for (const s of chart.series) {
    const color = TONE[s.tone]
    const pts = s.points.filter((p) => p.at >= start && p.at <= end)
    if (s.style === 'diamond' || s.style === 'triangle' || s.style === 'points') {
      for (const p of pts) mark(page, px(p.at), py(p.value), s, p.hollow)
      continue
    }
    const line = thin(
      pts.map((p): Point => [px(p.at), py(p.value)]),
      Math.ceil(plot.width),
    )
    if (s.style === 'area' && line.length > 1) {
      page.polygon([[line[0]![0], baseline], ...line, [line[line.length - 1]![0], baseline]], {
        fill: tint(color, 0.12),
      })
      page.polyline(line, { color, width: 1.25 })
    } else if (s.style === 'line') {
      page.polyline(line, { color, width: 1.5 })
      if (line.length < 60) for (const [x, y] of line) page.circle(x, y, 1.8, { fill: color })
    } else if (s.style === 'hollow') {
      for (const [x, y] of line) mark(page, x, y, s)
    }
  }

  page.line([plot.x, baseline], [plot.x + plot.width, baseline], {
    color: ink['divider-strong'],
    width: 0.75,
  })
  for (const at of chart.markers) {
    if (at < start || at > end) continue
    const x = px(at)
    page.polygon(
      [
        [x, baseline - 5],
        [x - 3.5, baseline + 1],
        [x + 3.5, baseline + 1],
      ],
      { fill: ink['chart-axis'] },
    )
  }
  if (chart.now !== null && chart.now >= start && chart.now <= end) {
    page.line([px(chart.now), plot.y], [px(chart.now), baseline], {
      color: ink['chart-now'],
      width: 0.75,
      dash: [2, 2],
    })
    page.text(px(chart.now) + 3, plot.y + 6, 'Now', { size: 7, color: ink['chart-axis'] })
  }
}

/**
 * Rows of instants on the same time axis as the panels above them, each labelled in the
 * gutter: a tick per dose of a medicine without a curve, and per side effect.
 */
export function drawTimeline(
  page: PdfPage,
  box: Box,
  rows: readonly ReportTimelineRow[],
  window: ReportChart['window'],
  options: AxisOptions & { gutter: number; title: string },
) {
  const plot: Box = {
    x: box.x + options.gutter,
    y: box.y + TITLE_ROW,
    width: box.width - options.gutter - 6,
    height: rows.length * TIMELINE_ROW,
  }
  const span = Math.max(1, window.end - window.start)
  const px = (at: number) => plot.x + ((at - window.start) / span) * plot.width
  page.text(box.x, box.y + 10, options.title, { font: 'bold', size: 9, color: ink['text-1'] })
  rows.forEach((row, i) => {
    const y = plot.y + i * TIMELINE_ROW + TIMELINE_ROW / 2
    page.text(plot.x - 6, y + 2.6, ellipsise(row.label, 'regular', TICK_SIZE, options.gutter - 8), {
      size: TICK_SIZE,
      color: ink['chart-axis'],
      align: 'right',
    })
    page.line([plot.x, y], [plot.x + plot.width, y], { color: ink['chart-grid'], width: 0.5 })
    for (const at of row.at) {
      if (at < window.start || at > window.end) continue
      page.line([px(at), y - 4], [px(at), y + 4], { color: ink['chart-logged'], width: 1 })
    }
  })
  if (options.timeAxis) drawTimeLabels(page, plot, window, options.formatTick)
}

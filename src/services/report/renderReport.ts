import { buildPdf, type PdfPage, type Point } from '@/services/pdf/document'
import { measure } from '@/services/pdf/text'
import { Layout, MARGIN, TOP } from './layout'
import { chartGutter, drawChart, drawTimeline, timelineHeight } from './pdfChart'
import { ink, MARK_COLOURS, rgb, tint } from './printPalette'
import type { ReportChart, ReportCohort, ReportData, ReportLevels } from './reportData'

const LEVELS_CAVEAT =
  'Estimated amount left in the body from logged doses, not blood levels. Based on a simple ' +
  'model from the half-life and time to peak.'

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

/** The Gliplog mark from the geometry of src/assets/brand/gliplog-mark.svg (512 grid). */
function drawMark(page: PdfPage, x: number, y: number, size: number) {
  const k = size / 512
  const p = (gx: number, gy: number): Point => [x + gx * k, y + gy * k]
  const glyph = rgb(MARK_COLOURS.glyph)
  // The tile's gradient as two halves of its end colours; at this size it reads as one.
  page.rect(x, y, size, size, { fill: rgb(MARK_COLOURS.tileBottom) }, 112 * k)
  page.rect(x, y, size, size * 0.55, { fill: rgb(MARK_COLOURS.tileTop) }, 112 * k)
  page.rect(x, y + size * 0.3, size, size * 0.25, { fill: rgb(MARK_COLOURS.tileTop) })
  const curve = [
    ...bezier(p(92, 330), p(150, 330), p(168, 160), p(228, 160)),
    ...bezier(p(228, 160), p(292, 160), p(316, 292), p(420, 300)).slice(1),
  ]
  page.polyline(curve, { color: glyph, width: 40 * k })
  const wave = [
    ...bezier(p(92, 404), p(156, 380), p(188, 428), p(256, 404)),
    ...bezier(p(256, 404), p(324, 380), p(356, 380), p(420, 404)).slice(1),
  ]
  page.polyline(wave, { color: tint(glyph, 0.6), width: 24 * k })
  const [cx, cy] = p(228, 160)
  page.circle(cx, cy, 30 * k, { fill: rgb(MARK_COLOURS.peak) })
}

function drawHeader(layout: Layout, data: ReportData) {
  const { page } = layout
  drawMark(page, MARGIN, TOP - 6, 26)
  const word = page.text(MARGIN + 34, TOP + 13, 'Glip', {
    font: 'bold',
    size: 15,
    color: ink['text-1'],
  })
  page.text(MARGIN + 34 + word, TOP + 13, 'log', { font: 'bold', size: 15, color: ink.brand })
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
  layout.y += 10
  layout.stats(data.summary)
  layout.rule()
}

/** A rounded label like the app's badges; returns its width. */
function pill(
  page: PdfPage,
  x: number,
  baseline: number,
  text: string,
  fg: readonly [number, number, number],
  bg: readonly [number, number, number],
) {
  const size = 8.5
  const width = measure(text, 'bold', size) + 14
  page.rect(x, baseline - 10.5, width, 15, { fill: bg }, 7.5)
  page.text(x + 7, baseline, text, { font: 'bold', size, color: fg })
  return width
}

/** A chart at the cursor, on the next page when it will not fit; the cursor moves below it. */
function chart(layout: Layout, data: ReportData, spec: ReportChart, height = 180) {
  layout.ensure(height + 2)
  drawChart(layout.page, { x: MARGIN, y: layout.y, width: layout.width, height }, spec, {
    formatTick: data.formatTick,
    timeAxis: true,
  })
  layout.y += height + 2
}

function drawCombined(layout: Layout, data: ReportData) {
  const { panels, timeline, window, notes } = data.combined!
  layout.heading('Combined chart')
  const labelWidth = Math.max(0, ...timeline.map((r) => measure(r.label, 'regular', 7.5)))
  // One gutter for every panel, so their plots line up on the shared time axis.
  const gutter = Math.max(40, Math.min(labelWidth, 110) + 8, ...panels.map(chartGutter))
  const options = { formatTick: data.formatTick, gutter }
  const PANEL = 96
  const AXIS = 14
  const timelineAt = timeline.length ? timelineHeight(timeline.length, true) : 0
  panels.forEach((panel, i) => {
    const last = i === panels.length - 1 && !timeline.length
    const next = i < panels.length - 1 ? PANEL : timelineAt
    // Time labels go under the last panel, and under any panel the next one leaves behind.
    layout.ensure(PANEL + AXIS + 2)
    const timeAxis = last || !layout.fits(PANEL + 2 + next + 2)
    const height = PANEL + (timeAxis ? AXIS : 0)
    drawChart(layout.page, { x: MARGIN, y: layout.y, width: layout.width, height }, panel, {
      ...options,
      timeAxis,
    })
    layout.y += height + 2
  })
  if (timeline.length) {
    layout.ensure(timelineAt + 2)
    drawTimeline(
      layout.page,
      { x: MARGIN, y: layout.y, width: layout.width, height: timelineAt },
      timeline,
      window,
      { ...options, timeAxis: true, title: 'Events' },
    )
    layout.y += timelineAt + 2
  }
  layout.gap(4)
  for (const note of notes) layout.paragraph(note, 'regular', 8, ink['text-3'])
  layout.rule()
}

function drawLevels(layout: Layout, data: ReportData, medicine: ReportLevels) {
  // Keep a medicine's name, figures and chart together on one page.
  layout.ensure(medicine.curve ? 300 : 110)
  layout.heading(medicine.name, 12)
  const { page } = layout

  if (medicine.pk) {
    layout.y += 14
    let x = MARGIN
    x += pill(page, x, layout.y, `t½ ${medicine.pk.halfLife}`, ink.brand, tint(ink.brand, 0.14)) + 6
    x += pill(page, x, layout.y, `peak ${medicine.pk.peak}`, ink.brand, tint(ink.brand, 0.14)) + 6
    const [fg, bg] = medicine.pk.userSupplied
      ? [ink['notice-fg'], ink['notice-bg']]
      : [ink['good-fg'], ink['good-bg']]
    pill(page, x, layout.y, medicine.pk.sourceLabel, fg, bg)
    layout.y += 8
  }

  layout.stats(medicine.stats)

  if (medicine.curve) {
    layout.gap(2)
    chart(layout, data, medicine.curve.chart)
    if (medicine.curve.note) layout.paragraph(medicine.curve.note, 'regular', 8, ink['text-2'])
    layout.paragraph(LEVELS_CAVEAT, 'regular', 8, ink['text-3'])
  } else if (medicine.noCurveReason) {
    layout.gap(4)
    layout.paragraph(medicine.noCurveReason, 'regular', 9, ink['text-2'])
  }

  if (medicine.pk && !medicine.pk.userSupplied) {
    layout.gap(4)
    if (medicine.pk.notes) layout.paragraph(medicine.pk.notes, 'regular', 8, ink['text-2'])
    for (const citation of medicine.pk.citations) {
      layout.paragraph(`Source: ${citation}`, 'regular', 8, ink['text-3'])
    }
  }
  layout.rule()
}

function drawWeight(layout: Layout, data: ReportData) {
  const weight = data.weight!
  layout.heading('Weight')
  layout.stats(weight.stats)
  if (weight.weight) chart(layout, data, weight.weight, 160)
  if (weight.bmi) {
    layout.gap(6)
    chart(layout, data, weight.bmi, 140)
  }
  layout.gap(2)
  for (const note of weight.notes) layout.paragraph(note, 'regular', 8, ink['text-3'])
  layout.rule()
}

function drawSugar(layout: Layout, data: ReportData) {
  const sugar = data.sugar!
  if (sugar.a1cChart || sugar.glucoseChart) {
    layout.heading('Blood sugar')
    if (sugar.a1cChart) chart(layout, data, sugar.a1cChart, 140)
    if (sugar.glucoseChart) {
      layout.gap(6)
      chart(layout, data, sugar.glucoseChart, 140)
    }
    layout.rule()
  }
  layout.table('HbA1c', sugar.a1c)
  layout.rule()
  layout.table('Blood glucose', sugar.glucose)
  layout.rule()
}

function drawCohort(layout: Layout, data: ReportData, cohort: readonly ReportCohort[]) {
  // The section's heading and introduction stay with its first chart.
  layout.ensure(300)
  layout.heading('Compared with trial cohorts')
  layout.paragraph(
    'Your change beside the published averages from trials of the same medicine. Week 0 is ' +
      'your first dose, whatever period this report covers.',
    'regular',
    9,
    ink['text-2'],
  )
  for (const c of cohort) {
    layout.gap(6)
    layout.ensure(250)
    layout.heading(c.title, 11)
    chart(layout, data, c.chart, 200)
    layout.gap(2)
    for (const line of c.caption) layout.paragraph(line, 'regular', 8, ink['text-2'])
    for (const citation of c.citations) {
      layout.paragraph(`Source: ${citation}`, 'regular', 8, ink['text-3'])
    }
  }
  layout.rule()
}

/**
 * Lay out the report and serialise it to PDF bytes, printing only the sections the reader
 * chose. Pure: the same data gives the same file, so it is tested without a browser. Callers
 * format every date and number for the reader's locale before passing them in.
 */
export function renderReport(data: ReportData): Uint8Array<ArrayBuffer> {
  const layout = new Layout(data.pageSize)
  drawHeader(layout, data)
  if (data.combined) drawCombined(layout, data)
  if (data.weight) drawWeight(layout, data)
  if (data.sugar) drawSugar(layout, data)
  if (data.cohort?.length) drawCohort(layout, data, data.cohort)
  if (data.levels) {
    if (data.levels.length) {
      layout.ensure(data.levels[0]!.curve ? 330 : 140)
      layout.heading('Estimated levels')
    }
    for (const levels of data.levels) drawLevels(layout, data, levels)
  }
  if (data.symptoms) {
    layout.table('Side effects', data.symptoms.table, data.symptoms.notes)
    layout.rule()
  }
  if (data.doses) {
    layout.table('Medications', data.doses.medications)
    layout.rule()
    layout.table('Dose log', data.doses.log)
    layout.rule()
  }
  layout.footers('Gliplog · A personal journal, not medical advice.')
  return buildPdf(layout.pages, 'Gliplog report')
}

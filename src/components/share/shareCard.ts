import { init, use, type EChartsCoreOption } from 'echarts/core'
import { LineChart, ScatterChart } from 'echarts/charts'
import { GridComponent, LegendComponent, MarkLineComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import markUrl from '@/assets/brand/gliplog-mark.svg'
import type { ChartColors } from '@/composables/useChartColors'
import { drawPin, PIN } from '@/components/charts/photoPins'
import {
  drawBrandRow,
  drawFooter,
  loadImage,
  paintBackdrop,
  readTokens,
  toPng,
  wrap,
} from './cardCanvas'

// An offscreen chart draws only what is registered in the module that creates it.
use([LineChart, ScatterChart, GridComponent, LegendComponent, MarkLineComponent, CanvasRenderer])

/** What a share card shows. Every value is already formatted for the device's locale. */
export interface ShareCardContent {
  /** Small label above the title: "Weight", "Estimated levels". */
  eyebrow: string
  title: string
  /** Up to three headline figures, label then value. */
  stats: (readonly [string, string])[]
  /** The chart, drawn from the same option builder as the app; null for none. */
  chart: EChartsCoreOption | null
  /** One or two plain sentences under the chart: what it is and where figures came from. */
  caption: string
  /** When the card was made, formatted for the device's locale. */
  madeAt: string
  /** Progress photos to pin on the chart's first line: `src` is a thumbnail URL. */
  photos?: { at: number; value: number; src: string }[]
}

/** Portrait 4:5, the shape messaging apps show without cropping. */
const WIDTH = 1080
const HEIGHT = 1350
const PAD = 72

/**
 * Draw a share card to a PNG: the Gliplog mark and date, a title, the headline figures, the
 * chart on a glass panel, and a caption saying what the chart is. Drawn on the device; it
 * leaves only through the share sheet or a download the user starts, and carries no metadata
 * beyond its pixels.
 */
export async function renderShareCard(
  content: ShareCardContent,
  chartColors: ChartColors,
): Promise<Blob> {
  const t = readTokens()
  const font = chartColors.font
  await Promise.all([
    document.fonts.load(`700 64px ${font}`),
    document.fonts.load(`600 28px ${font}`),
    document.fonts.load(`400 28px ${font}`),
  ])
  const mark = await loadImage(markUrl)
  const photos = await Promise.all(
    (content.photos ?? []).map(async (p) => ({ ...p, image: await loadImage(p.src) })),
  )

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  const inner = WIDTH - PAD * 2

  paintBackdrop(ctx, t, WIDTH, HEIGHT)
  drawBrandRow(ctx, t, font, mark, content.madeAt, WIDTH, PAD)

  // Title block.
  let y = PAD + 150
  ctx.font = `700 24px ${font}`
  ctx.fillStyle = t.accent
  ctx.letterSpacing = '4px'
  ctx.fillText(content.eyebrow.toUpperCase(), PAD, y)
  ctx.letterSpacing = '0px'
  ctx.font = `700 64px ${font}`
  ctx.fillStyle = t['text-1']
  y += 76
  ctx.fillText(wrap(ctx, content.title, inner, 1)[0] ?? '', PAD, y)

  // Headline figures.
  y += 64
  const stats = content.stats.slice(0, 3)
  const column = inner / Math.max(stats.length, 1)
  stats.forEach(([label, value], i) => {
    ctx.font = `600 24px ${font}`
    ctx.fillStyle = t['text-3']
    ctx.fillText(label, PAD + i * column, y)
    ctx.font = `700 42px ${font}`
    ctx.fillStyle = t['text-1']
    ctx.fillText(value, PAD + i * column, y + 52, column - 16)
  })

  // The chart on a glass panel. Laid out at half size and drawn at twice the pixel ratio, so
  // its text reads at the size it has in the app.
  y += stats.length ? 96 : 8
  const panelH = 600
  ctx.fillStyle = t['glass-card']
  ctx.beginPath()
  ctx.roundRect(PAD - 24, y, inner + 48, panelH, 36)
  ctx.fill()
  ctx.strokeStyle = t['glass-edge']
  ctx.lineWidth = 2
  ctx.stroke()
  if (content.chart) {
    const host = document.createElement('div')
    const chart = init(host, null, {
      renderer: 'canvas',
      width: inner / 2,
      height: (panelH - 56) / 2,
      devicePixelRatio: 2,
    })
    try {
      chart.setOption({ ...content.chart, animation: false, dataZoom: [], tooltip: undefined })
      ctx.drawImage(
        chart.getRenderedCanvas({ backgroundColor: 'transparent', pixelRatio: 2 }),
        PAD,
        y + 28,
        inner,
        panelH - 56,
      )
      // Pins are drawn here rather than as chart symbols: ECharts loads image symbols after
      // the first render, which would leave them out of this one-shot image.
      const scale = 2
      for (const p of photos) {
        const at = chart.convertToPixel({ seriesIndex: 0 }, [p.at, p.value]) as number[]
        const pin = drawPin(p.image, { surface: t.surface, text: t['text-1'] }, 4)
        const w = PIN.width * scale * 1.2
        const h = PIN.height * scale * 1.2
        ctx.drawImage(pin, PAD + at[0]! * scale - w / 2, y + 28 + at[1]! * scale - h, w, h)
      }
    } finally {
      chart.dispose()
    }
  }

  // Caption.
  y += panelH + 56
  ctx.font = `400 26px ${font}`
  ctx.fillStyle = t['text-2']
  for (const line of wrap(ctx, content.caption, inner, 3)) {
    ctx.fillText(line, PAD, y)
    y += 36
  }

  drawFooter(ctx, t, font, HEIGHT, PAD)
  return toPng(canvas)
}

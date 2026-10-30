import { init, use, type EChartsCoreOption } from 'echarts/core'
import { LineChart, ScatterChart } from 'echarts/charts'
import { GridComponent, LegendComponent, MarkLineComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import markUrl from '@/assets/brand/tidebook-mark.svg'
import type { ChartColors } from '@/composables/useChartColors'

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
}

/** Portrait 4:5, the shape messaging apps show without cropping. */
const WIDTH = 1080
const HEIGHT = 1350
const PAD = 72

const TOKENS = [
  'bg',
  'text-1',
  'text-2',
  'text-3',
  'brand',
  'accent',
  'backdrop-1',
  'backdrop-2',
  'glass-card',
  'glass-edge',
] as const
type CardTokens = Record<(typeof TOKENS)[number], string>

function readTokens(): CardTokens {
  const style = getComputedStyle(document.querySelector('.v-application') ?? document.body)
  return Object.fromEntries(
    TOKENS.map((t) => [t, style.getPropertyValue(`--tb-${t}`).trim()]),
  ) as CardTokens
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load the Tidebook mark'))
    img.src = src
  })
}

/** Greedy word wrap to `width`; the last of `maxLines` lines is ellipsised. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number) {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width <= width || !line) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] = `${lines[maxLines - 1]!.replace(/\s+\S*$/, '')}…`
  }
  return lines
}

/**
 * Draw a share card to a PNG: the Tidebook mark and date, a title, the headline figures, the
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

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  const inner = WIDTH - PAD * 2

  // The app's paper with its two soft pools of colour.
  ctx.fillStyle = t.bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  for (const [x, y, r, colour] of [
    [0, 0, 900, t['backdrop-1']],
    [WIDTH, 120, 760, t['backdrop-2']],
  ] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, colour)
    g.addColorStop(1, 'transparent')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
  }

  // Brand row: mark, two-tone wordmark, date.
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(PAD, PAD, 64, 64, 14)
  ctx.clip()
  ctx.drawImage(mark, PAD, PAD, 64, 64)
  ctx.restore()
  ctx.font = `700 40px ${font}`
  ctx.fillStyle = t['text-1']
  ctx.fillText('Tide', PAD + 84, PAD + 46)
  ctx.fillStyle = t.brand
  ctx.fillText('book', PAD + 84 + ctx.measureText('Tide').width, PAD + 46)
  ctx.font = `400 26px ${font}`
  ctx.fillStyle = t['text-3']
  ctx.textAlign = 'right'
  ctx.fillText(content.madeAt, WIDTH - PAD, PAD + 44)
  ctx.textAlign = 'left'

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

  ctx.font = `600 24px ${font}`
  ctx.fillStyle = t['text-3']
  ctx.fillText('Made with Tidebook · Not medical advice', PAD, HEIGHT - PAD + 12)

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode the image'))),
      'image/png',
    ),
  )
}

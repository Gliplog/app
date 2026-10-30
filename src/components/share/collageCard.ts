import markUrl from '@/assets/brand/gliplog-mark.svg'
import { COLLAGE_FORMATS, coverCrop, gridLayout, type CollageFormat } from '@/domain/collage'
import {
  drawBrandRow,
  drawFooter,
  loadImage,
  paintBackdrop,
  readTokens,
  toPng,
  wrap,
} from './cardCanvas'

/** What a collage shows. Text is already formatted for the device's locale. */
export interface CollageContent {
  format: CollageFormat
  /** Oldest first: a full-size image URL, when it was taken, and its tile label. */
  photos: { src: string; at: number; label: string }[]
  eyebrow: string
  title: string
  /** Up to three headline figures, label then value. */
  stats: (readonly [string, string])[]
  caption: string
  /** The first and last dates, under the time ruler. */
  from: string
  to: string
  madeAt: string
}

const PAD = 72
const GAP = 20
const RADIUS = 28

/**
 * Draw a collage of progress photos to a PNG: the brand row, a title and figures, equal
 * cover-cropped tiles in time order each labelled with its date or week, a ruler showing when
 * each was taken across the span, and a caption. Drawn on the device from the stored images;
 * it carries no metadata beyond its pixels.
 */
export async function renderCollage(content: CollageContent, font: string): Promise<Blob> {
  const t = readTokens()
  const { width: W, height: H } = COLLAGE_FORMATS[content.format]
  await Promise.all([
    document.fonts.load(`700 64px ${font}`),
    document.fonts.load(`600 26px ${font}`),
    document.fonts.load(`400 26px ${font}`),
  ])
  const [mark, ...images] = await Promise.all([
    loadImage(markUrl),
    ...content.photos.map((p) => loadImage(p.src)),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')
  const inner = W - PAD * 2

  paintBackdrop(ctx, t, W, H)
  drawBrandRow(ctx, t, font, mark!, content.madeAt, W, PAD)

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

  const stats = content.stats.slice(0, 3)
  if (stats.length) {
    y += 60
    const column = inner / stats.length
    stats.forEach(([label, value], i) => {
      ctx.font = `600 24px ${font}`
      ctx.fillStyle = t['text-3']
      ctx.fillText(label, PAD + i * column, y)
      ctx.font = `700 40px ${font}`
      ctx.fillStyle = t['text-1']
      ctx.fillText(value, PAD + i * column, y + 50, column - 16)
    })
    y += 50
  }

  // Tiles fill the space between the title and the ruler, caption and footer; the ruler then
  // sits just under them, so a tall story keeps the photos and their timeline together.
  const top = y + 48
  const bottom = H - PAD - 200
  const tiles = gridLayout(
    images.length,
    { x: PAD, y: top, width: inner, height: bottom - top },
    GAP,
  )
  tiles.forEach((tile, i) => {
    const img = images[i]!
    ctx.save()
    ctx.shadowColor = `color-mix(in srgb, ${t['text-1']} 18%, transparent)`
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 8
    ctx.fillStyle = t.surface
    ctx.beginPath()
    ctx.roundRect(tile.x, tile.y, tile.width, tile.height, RADIUS)
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.beginPath()
    ctx.roundRect(tile.x, tile.y, tile.width, tile.height, RADIUS)
    ctx.clip()
    const crop = coverCrop(img.naturalWidth, img.naturalHeight, tile.width, tile.height)
    ctx.drawImage(
      img,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      tile.x,
      tile.y,
      tile.width,
      tile.height,
    )
    ctx.restore()

    // The label sits on a frosted chip in the tile's corner, readable over any photo.
    const label = content.photos[i]!.label
    const size = tile.width < 260 ? 22 : 26
    ctx.font = `600 ${size}px ${font}`
    const chipW = ctx.measureText(label).width + size * 1.2
    const chipH = size * 1.8
    const chipX = tile.x + 16
    const chipY = tile.y + tile.height - chipH - 16
    ctx.fillStyle = `color-mix(in srgb, ${t.surface} 86%, transparent)`
    ctx.beginPath()
    ctx.roundRect(chipX, chipY, Math.min(chipW, tile.width - 32), chipH, chipH / 2)
    ctx.fill()
    ctx.fillStyle = t['text-1']
    ctx.fillText(label, chipX + size * 0.6, chipY + chipH * 0.66, tile.width - 32 - size * 1.2)
  })

  // A ruler across the span: one dot per photo at the moment it was taken, so uneven gaps
  // between photos read as they happened.
  const rulerY = Math.max(...tiles.map((r) => r.y + r.height)) + 56
  const first = content.photos[0]?.at ?? 0
  const span = Math.max(1, (content.photos[content.photos.length - 1]?.at ?? 0) - first)
  ctx.strokeStyle = t['glass-edge']
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(PAD, rulerY)
  ctx.lineTo(W - PAD, rulerY)
  ctx.stroke()
  ctx.fillStyle = t.brand
  for (const p of content.photos) {
    ctx.beginPath()
    ctx.arc(PAD + ((p.at - first) / span) * inner, rulerY, 9, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.font = `600 22px ${font}`
  ctx.fillStyle = t['text-3']
  ctx.fillText(content.from, PAD, rulerY + 40)
  ctx.textAlign = 'right'
  ctx.fillText(content.to, W - PAD, rulerY + 40)
  ctx.textAlign = 'left'

  ctx.font = `400 26px ${font}`
  ctx.fillStyle = t['text-2']
  let captionY = rulerY + 92
  for (const line of wrap(ctx, content.caption, inner, 2)) {
    ctx.fillText(line, PAD, captionY)
    captionY += 34
  }

  drawFooter(ctx, t, font, H, PAD)
  return toPng(canvas)
}

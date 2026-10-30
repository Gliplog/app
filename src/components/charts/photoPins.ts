import { coverCrop } from '@/domain/collage'

/** A pin's size in CSS pixels: a 3:4 photo frame with a pointer below it. */
export const PIN = { width: 30, frame: 40, height: 48 } as const

export interface PinColors {
  /** The frame and pointer, the colour of a card. */
  surface: string
  /** Shadow tint, the text colour at low strength. */
  text: string
}

/**
 * A progress photo drawn as a map-style pin: the photo cropped into a rounded frame on a card-
 * coloured border, with a pointer whose tip marks the date and weight on the line. Drawn at
 * `scale` so it stays sharp on high-density screens and in share images.
 */
export function drawPin(
  photo: CanvasImageSource & { width: number; height: number },
  colors: PinColors,
  scale = 3,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = PIN.width * scale
  canvas.height = PIN.height * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  const inset = 2
  const border = 2
  const w = PIN.width - inset * 2
  const h = PIN.frame - inset
  const mid = PIN.width / 2

  ctx.save()
  ctx.shadowColor = `color-mix(in srgb, ${colors.text} 30%, transparent)`
  ctx.shadowBlur = 3
  ctx.shadowOffsetY = 1
  ctx.fillStyle = colors.surface
  ctx.beginPath()
  ctx.roundRect(inset, inset, w, h, 6)
  ctx.moveTo(mid - 5, inset + h - 0.5)
  ctx.lineTo(mid, PIN.height - 1)
  ctx.lineTo(mid + 5, inset + h - 0.5)
  ctx.fill()
  ctx.restore()

  const fw = w - border * 2
  const fh = h - border * 2
  const crop = coverCrop(photo.width, photo.height, fw, fh)
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(inset + border, inset + border, fw, fh, 4)
  ctx.clip()
  ctx.drawImage(
    photo,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    inset + border,
    inset + border,
    fw,
    fh,
  )
  ctx.restore()
  return canvas
}

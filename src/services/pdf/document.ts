import type { PageSize } from './pageSize'
import { measure, pdfString, toWinAnsi, type PdfFont } from './text'

/** A colour as red, green, blue, each 0 to 1. */
export type Rgb = readonly [number, number, number]

export interface TextStyle {
  font?: PdfFont
  size?: number
  color?: Rgb
  align?: 'left' | 'right' | 'center'
}

export interface StrokeStyle {
  color: Rgb
  width?: number
  /** Dash and gap lengths in points; omitted for a solid line. */
  dash?: readonly [number, number]
}

export interface ShapeStyle {
  fill?: Rgb
  stroke?: StrokeStyle
}

export type Point = readonly [number, number]

const FONT_RESOURCE: Record<PdfFont, string> = { regular: 'F1', bold: 'F2' }

/** Four decimals at most, no trailing zeros: compact and exact enough for print. */
function num(n: number): string {
  if (!Number.isFinite(n)) throw new RangeError(`Not a finite number: ${n}`)
  return String(Math.round(n * 10_000) / 10_000)
}

function colour(c: Rgb): string {
  return c.map(num).join(' ')
}

/** Cubic Bezier handle length for a quarter circle. */
const KAPPA = 0.5523

/**
 * One page. Coordinates are in points from the top-left corner with y growing downwards, the
 * way the layout thinks; the page flips them into PDF's bottom-left space. Every drawing call
 * appends operators to the page's content stream; text goes in only through `pdfString`.
 */
export class PdfPage {
  readonly ops: string[] = []

  constructor(readonly size: PageSize) {}

  private y(top: number): number {
    return this.size.height - top
  }

  private strokeOps(s: StrokeStyle): string {
    return `${colour(s.color)} RG ${num(s.width ?? 1)} w ${s.dash ? `[${s.dash.map(num).join(' ')}] 0 d` : '[] 0 d'}`
  }

  private paint(path: string, style: ShapeStyle) {
    const op = style.fill && style.stroke ? 'B' : style.fill ? 'f' : 'S'
    const parts = ['q']
    if (style.fill) parts.push(`${colour(style.fill)} rg`)
    if (style.stroke) parts.push(this.strokeOps(style.stroke))
    parts.push(path, op, 'Q')
    this.ops.push(parts.join(' '))
  }

  /**
   * Draw one line of text with its baseline at `y`. Text is encoded to WinAnsi here and only
   * here, so callers pass ordinary strings. Returns the text's width in points.
   */
  text(x: number, y: number, value: string, style: TextStyle = {}): number {
    const font = style.font ?? 'regular'
    const size = style.size ?? 10
    const encoded = toWinAnsi(value)
    const width = measure(value, font, size)
    const left = style.align === 'right' ? x - width : style.align === 'center' ? x - width / 2 : x
    this.ops.push(
      `BT /${FONT_RESOURCE[font]} ${num(size)} Tf ${colour(style.color ?? [0, 0, 0])} rg ` +
        `${num(left)} ${num(this.y(y))} Td ${pdfString(encoded)} Tj ET`,
    )
    return width
  }

  line(from: Point, to: Point, stroke: StrokeStyle) {
    this.paint(`${num(from[0])} ${num(this.y(from[1]))} m ${num(to[0])} ${num(this.y(to[1]))} l`, {
      stroke,
    })
  }

  /** An open path through `points` (a curve as straight segments). */
  polyline(points: readonly Point[], stroke: StrokeStyle) {
    if (points.length < 2) return
    this.paint(this.pathThrough(points), { stroke })
  }

  /** A closed shape through `points`. */
  polygon(points: readonly Point[], style: ShapeStyle) {
    if (points.length < 3) return
    this.paint(`${this.pathThrough(points)} h`, style)
  }

  rect(x: number, y: number, width: number, height: number, style: ShapeStyle, radius = 0) {
    if (radius <= 0) {
      this.paint(`${num(x)} ${num(this.y(y + height))} ${num(width)} ${num(height)} re`, style)
      return
    }
    const r = Math.min(radius, width / 2, height / 2)
    const k = r * KAPPA
    const [l, t, rt, b] = [x, this.y(y), x + width, this.y(y + height)]
    this.paint(
      [
        `${num(l + r)} ${num(t)} m`,
        `${num(rt - r)} ${num(t)} l`,
        `${num(rt - r + k)} ${num(t)} ${num(rt)} ${num(t - r + k)} ${num(rt)} ${num(t - r)} c`,
        `${num(rt)} ${num(b + r)} l`,
        `${num(rt)} ${num(b + r - k)} ${num(rt - r + k)} ${num(b)} ${num(rt - r)} ${num(b)} c`,
        `${num(l + r)} ${num(b)} l`,
        `${num(l + r - k)} ${num(b)} ${num(l)} ${num(b + r - k)} ${num(l)} ${num(b + r)} c`,
        `${num(l)} ${num(t - r)} l`,
        `${num(l)} ${num(t - r + k)} ${num(l + r - k)} ${num(t)} ${num(l + r)} ${num(t)} c h`,
      ].join(' '),
      style,
    )
  }

  circle(cx: number, cy: number, r: number, style: ShapeStyle) {
    const k = r * KAPPA
    const y = this.y(cy)
    this.paint(
      [
        `${num(cx + r)} ${num(y)} m`,
        `${num(cx + r)} ${num(y + k)} ${num(cx + k)} ${num(y + r)} ${num(cx)} ${num(y + r)} c`,
        `${num(cx - k)} ${num(y + r)} ${num(cx - r)} ${num(y + k)} ${num(cx - r)} ${num(y)} c`,
        `${num(cx - r)} ${num(y - k)} ${num(cx - k)} ${num(y - r)} ${num(cx)} ${num(y - r)} c`,
        `${num(cx + k)} ${num(y - r)} ${num(cx + r)} ${num(y - k)} ${num(cx + r)} ${num(y)} c h`,
      ].join(' '),
      style,
    )
  }

  private pathThrough(points: readonly Point[]): string {
    return points.map(([x, y], i) => `${num(x)} ${num(this.y(y))} ${i === 0 ? 'm' : 'l'}`).join(' ')
  }
}

/**
 * Serialise pages into a PDF 1.4 file using the standard Helvetica fonts (not embedded, so the
 * file stays small and every viewer has them). The file holds only drawing operators and text:
 * no scripts, actions, links, attachments, timestamps or producer string, and its only metadata
 * is `title`. Every character is one byte, so the cross-reference offsets are exact.
 */
export function buildPdf(pages: readonly PdfPage[], title: string): Uint8Array<ArrayBuffer> {
  if (!pages.length) throw new RangeError('A PDF needs at least one page')
  const objects: string[] = []
  const add = (body: string) => objects.push(body)

  // Fixed object numbers: 1 catalog, 2 page tree, 3 and 4 fonts, 5 info, then two per page.
  const pageRef = (i: number) => 6 + i * 2
  add('<< /Type /Catalog /Pages 2 0 R >>')
  add(
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageRef(i)} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  )
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  add(`<< /Title ${pdfString(toWinAnsi(title))} >>`)
  pages.forEach((page, i) => {
    const content = page.ops.join('\n')
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(page.size.width)} ${num(page.size.height)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageRef(i) + 1} 0 R >>`,
    )
    add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  })

  // The second line's high bytes mark the file as binary for transfer tools.
  let file = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(file.length)
    file += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = file.length
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) file += `${String(offset).padStart(10, '0')} 00000 n \n`
  file += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`

  const bytes = new Uint8Array(file.length)
  for (let i = 0; i < file.length; i++) {
    const code = file.charCodeAt(i)
    if (code > 0xff) throw new RangeError(`Character U+${code.toString(16)} is not a single byte`)
    bytes[i] = code
  }
  return bytes
}

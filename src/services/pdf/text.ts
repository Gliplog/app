import { HELVETICA_BOLD_WIDTHS, HELVETICA_WIDTHS, WIN_ANSI_HIGH } from './fontMetrics'

export type PdfFont = 'regular' | 'bold'

/** Readable stand-ins for characters the standard fonts cannot show. */
const TRANSLITERATIONS: Record<string, string> = {
  '≥': '>=',
  '≤': '<=',
  '≈': '~',
  '−': '-',
  '→': '->',
  '←': '<-',
  α: 'alpha',
  β: 'beta',
  γ: 'gamma',
  δ: 'delta',
  κ: 'kappa',
  μ: 'µ',
  // Letters with a stroke are not accented forms in Unicode, so stripping marks misses them.
  Ł: 'L',
  ł: 'l',
  Đ: 'D',
  đ: 'd',
  Ħ: 'H',
  ħ: 'h',
  ı: 'i',
}

function winAnsiByte(codePoint: number): number | undefined {
  if (codePoint >= 0x20 && codePoint <= 0x7e) return codePoint
  if (codePoint >= 0xa0 && codePoint <= 0xff) return codePoint
  return WIN_ANSI_HIGH.get(codePoint)
}

/**
 * Text as the single-byte WinAnsi string a standard PDF font draws: one char per byte, every
 * char code at most 0xFF. Line breaks, control characters and Unicode spaces become plain
 * spaces (a string in a content stream is one line). Accented letters outside WinAnsi lose their accent, a few
 * symbols are spelled out, and anything else (emoji, other scripts) becomes "?".
 */
export function toWinAnsi(text: string): string {
  let out = ''
  for (const ch of text.normalize('NFC')) {
    const cp = ch.codePointAt(0)!
    // Intl output carries thin and narrow no-break spaces ("Jul 31 – Oct 29", "8:00 AM").
    if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0) || (cp > 0xff && /\p{Zs}/u.test(ch))) {
      out += ' '
      continue
    }
    const direct = winAnsiByte(cp)
    if (direct !== undefined) {
      out += String.fromCharCode(direct)
      continue
    }
    const spelled = TRANSLITERATIONS[ch]
    if (spelled !== undefined) {
      out += toWinAnsi(spelled)
      continue
    }
    const base = ch.normalize('NFD').replace(/\p{M}/gu, '')
    const baseByte = base.length === 1 ? winAnsiByte(base.codePointAt(0)!) : undefined
    out += baseByte !== undefined ? String.fromCharCode(baseByte) : '?'
  }
  return out
}

/** Width in points of `text` set in `font` at `size`, as the PDF viewer will lay it out. */
export function measure(text: string, font: PdfFont, size: number): number {
  const widths = font === 'bold' ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS
  const encoded = toWinAnsi(text)
  let total = 0
  for (let i = 0; i < encoded.length; i++) total += widths[encoded.charCodeAt(i) - 32] ?? 0
  return (total * size) / 1000
}

/**
 * Greedy word wrap of `text` to `width` points. A single word wider than the line is kept whole
 * rather than split mid-word; with `maxLines`, the last line is ellipsised.
 */
export function wrap(
  text: string,
  font: PdfFont,
  size: number,
  width: number,
  maxLines = Infinity,
): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (!line || measure(next, font, size) <= width) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] = ellipsise(`${lines[maxLines - 1]!}\u2026`, font, size, width)
  }
  return lines
}

/** Shorten `text` with a trailing ellipsis until it fits `width` points. */
export function ellipsise(text: string, font: PdfFont, size: number, width: number): string {
  if (measure(text, font, size) <= width) return text
  let cut = text.replace(/\u2026$/, '')
  while (cut && measure(`${cut}\u2026`, font, size) > width) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}\u2026`
}

/**
 * A PDF literal string from WinAnsi text (`toWinAnsi`): the only way any text, user-entered
 * included, enters a content stream. Escaping the backslash and both parentheses means no input
 * can close the string and inject operators.
 */
export function pdfString(encoded: string): string {
  return `(${encoded.replace(/[\\()]/g, (c) => `\\${c}`)})`
}

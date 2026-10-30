import { describe, expect, it } from 'vitest'
import { buildPdf, PdfPage } from '@/services/pdf/document'
import { A4 } from '@/services/pdf/pageSize'
import { readPdf, withoutStrings } from './pdfParse'

function onePage(draw: (page: PdfPage) => void) {
  const page = new PdfPage(A4)
  draw(page)
  return readPdf(buildPdf([page], 'Test'))
}

describe('buildPdf', () => {
  it('writes a well-formed file whose cross-reference offsets are exact', () => {
    const pdf = onePage((p) => {
      p.text(48, 60, 'Hello')
      p.rect(48, 80, 100, 40, { fill: [0.9, 0.9, 0.9] }, 6)
      p.circle(200, 100, 20, { stroke: { color: [0, 0, 0], width: 2 } })
      p.polyline(
        [
          [10, 10],
          [20, 30],
        ],
        { color: [0, 0.5, 0], dash: [2, 2] },
      )
    })
    expect(pdf.text.startsWith('%PDF-1.4\n')).toBe(true)
    expect(pdf.text.endsWith('%%EOF\n')).toBe(true)
    expect(pdf.objects.size).toBe(7)
    expect(pdf.streams).toHaveLength(1)
  })

  it('carries no scripts, actions, links, attachments or identifying metadata', () => {
    const { text } = onePage((p) => p.text(48, 60, 'Draws'))
    for (const key of [
      '/JavaScript',
      '/JS',
      '/OpenAction',
      '/AA',
      '/URI',
      '/Launch',
      '/EmbeddedFile',
      '/CreationDate',
      '/ModDate',
      '/Producer',
      '/Author',
      '/Metadata',
    ]) {
      expect(text).not.toContain(key)
    }
    expect(text).toContain('/Info 5 0 R')
    expect(text).toContain('<< /Title (Test) >>')
  })

  it('keeps hostile text inside one escaped string', () => {
    const { streams } = onePage((p) => p.text(48, 60, 'x) Tj /F2 99 Tf (y\\'))
    expect(streams[0]).toContain('(x\\) Tj /F2 99 Tf \\(y\\\\)')
    const ops = withoutStrings(streams[0]!)
    expect(ops.match(/\bTj\b/g)).toHaveLength(1)
    expect(ops.match(/\bTf\b/g)).toHaveLength(1)
  })

  it("flips the layout's top-left coordinates into PDF space", () => {
    const { streams } = onePage((p) => p.text(48, 60, 'A'))
    expect(streams[0]).toContain(`48 ${Math.round((A4.height - 60) * 10_000) / 10_000} Td`)
  })

  it('right-aligns text by its measured width', () => {
    const { streams } = onePage((p) => p.text(100, 60, 'Hello', { align: 'right' }))
    expect(streams[0]).toContain('77.22 ')
  })

  it('refuses an empty document and non-finite coordinates', () => {
    expect(() => buildPdf([], 'x')).toThrow(RangeError)
    expect(() => onePage((p) => p.text(Number.NaN, 0, 'x'))).toThrow(RangeError)
  })
})

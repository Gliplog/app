/** Minimal structural reader for the PDFs this app writes, for tests only. */
export interface ParsedPdf {
  text: string
  objects: Map<number, string>
  streams: string[]
}

export function readPdf(bytes: Uint8Array): ParsedPdf {
  const text = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
  const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(text)![1])
  const xref = text.slice(startxref)
  const count = Number(/^xref\n0 (\d+)\n/.exec(xref)![1])
  const entries = xref.split('\n').slice(3, 2 + count)
  const objects = new Map<number, string>()
  entries.forEach((entry, i) => {
    const offset = Number(entry.slice(0, 10))
    const start = `${i + 1} 0 obj\n`
    if (!text.startsWith(start, offset)) throw new Error(`xref entry ${i + 1} is off`)
    const end = text.indexOf('\nendobj\n', offset)
    objects.set(i + 1, text.slice(offset + start.length, end))
  })
  const streams: string[] = []
  for (const body of objects.values()) {
    const m = /^<< \/Length (\d+) >>\nstream\n/.exec(body)
    if (!m) continue
    const content = body.slice(m[0].length, m[0].length + Number(m[1]))
    if (body.slice(m[0].length + Number(m[1])) !== '\nendstream') {
      throw new Error('stream length does not match its content')
    }
    streams.push(content)
  }
  return { text, objects, streams }
}

/** Content stream operators with every literal string removed, honouring escapes. */
export function withoutStrings(content: string): string {
  let out = ''
  let depth = 0
  for (let i = 0; i < content.length; i++) {
    const c = content[i]!
    if (depth > 0) {
      if (c === '\\') i++
      else if (c === '(') depth++
      else if (c === ')') depth--
      continue
    }
    if (c === '(') depth = 1
    else out += c
  }
  return out
}

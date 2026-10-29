import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
// Resolved as the build tooling resolves it: the override points every consumer at vendor/.
import deepmerge from 'deepmerge'

type Merged = Record<string, unknown>

describe('vendored deepmerge', () => {
  it('is the patched copy, not the registry package', () => {
    const pkg = createRequire(import.meta.url)('deepmerge/package.json') as { version: string }
    expect(pkg.version).toBe('4.3.1-tidebook.1')
  })

  it('does not let a parsed "__proto__" key replace the prototype (GHSA-gcqx-w48m-w2h4)', () => {
    const hostile: Merged = JSON.parse('{"__proto__": {"polluted": true}, "safe": 1}')
    for (const merged of [
      deepmerge<Merged>({}, hostile),
      deepmerge<Merged>(hostile, {}),
      deepmerge.all<Merged>([hostile]),
    ]) {
      expect(Object.getPrototypeOf(merged)).toBe(Object.prototype)
      expect((merged as { polluted?: boolean }).polluted).toBeUndefined()
      expect(merged.safe).toBe(1)
    }
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })

  it('drops an inherited-name "constructor" key as upstream does; other names stay own data', () => {
    const merged = deepmerge<Merged>({}, { constructor: 'x', prototype: { a: 1 } })
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype)
    expect(Object.keys(merged)).toEqual(['prototype'])
    expect(merged.constructor).toBe(Object)
  })

  it('behaves like upstream for the build plugin call: a deep, independent clone', () => {
    // @rollup/plugin-node-resolve calls deepMerge({}, defaults) on its own defaults.
    const defaults = {
      dedupe: [],
      extensions: ['.mjs', '.js'],
      resolveOnly: [],
      nested: { a: [1] },
    }
    const merged = deepmerge<typeof defaults>({}, defaults)
    expect(merged).toEqual(defaults)
    expect(merged.extensions).not.toBe(defaults.extensions)
    expect(merged.nested).not.toBe(defaults.nested)
  })

  it('concatenates arrays and merges nested objects like upstream', () => {
    expect(deepmerge<Merged>({ a: [1], b: { x: 1 } }, { a: [2], b: { y: 2 } })).toEqual({
      a: [1, 2],
      b: { x: 1, y: 2 },
    })
  })
})

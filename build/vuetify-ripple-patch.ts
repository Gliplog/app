import type { Plugin } from 'vite'

/*
 * Vuetify 4.3.0 leaves a ripple on screen after any touch shorter than its 80 ms show delay, such
 * as a tap that stops a fling. On that touchend the ripple shows late and its hide is re-queued
 * with setTimeout as `rippleHide(e)`, but `e.currentTarget` is null once dispatch ends, so the
 * deferred hide finds no element and the ripple stays until the control is touched again. Both
 * tabs of the bottom navigation then look pressed. Upstream master still has the bug; the patch
 * hands the element to the deferred call. Drop it when Vuetify ships the fix: the build fails if
 * the patched source no longer matches.
 */
const RIPPLE_MODULE = /[\\/]vuetify[\\/]lib[\\/]directives[\\/]ripple[\\/]index\.js$/

const EDITS: ReadonlyArray<readonly [before: string, after: string]> = [
  [
    'function rippleHide(e) {\n  const element = e.currentTarget;',
    'function rippleHide(e, element = e.currentTarget) {',
  ],
  ['rippleHide(e);\n    });', 'rippleHide(e, element);\n    });'],
]

/** Returns Vuetify's ripple module with the deferred hide fixed; throws if the source has moved on. */
export function patchRippleSource(code: string): string {
  return EDITS.reduce((patched, [before, after]) => {
    if (patched.split(before).length !== 2) {
      throw new Error(`Vuetify ripple patch: expected exactly one "${before.split('\n')[0]}"`)
    }
    return patched.replace(before, after)
  }, code)
}

/**
 * Applies `patchRippleSource` wherever Vuetify's ripple module is loaded: the production build,
 * Vitest, and (registered under `optimizeDeps.rolldownOptions.plugins`) the dev pre-bundle. With
 * `required`, a build that never loads the module fails, so a moved file cannot skip the patch.
 */
export function vuetifyRipplePatch({ required = false } = {}): Plugin {
  let patched = false
  return {
    name: 'tidebook-vuetify-ripple-patch',
    enforce: 'pre',
    transform(code, id) {
      if (!RIPPLE_MODULE.test(id)) return null
      patched = true
      return { code: patchRippleSource(code), map: null }
    },
    buildEnd(error) {
      if (required && !error && !patched) {
        this.error('Vuetify ripple patch: the ripple module was never loaded')
      }
    },
  }
}

import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { VitePWA } from 'vite-plugin-pwa'
import { vuetifyRipplePatch } from './build/vuetify-ripple-patch.ts'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

/*
 * The app is served from the `app` repository of the Gliplog organisation on GitHub Pages
 * (https://gliplog.com/app/); the marketing site owns the root of that origin.
 * GLIPLOG_BASE overrides it, e.g. "/" for a custom domain. Always starts and ends with "/".
 */
function webBase(): string {
  return normalizeBase(process.env.GLIPLOG_BASE ?? '/app/')
}

function normalizeBase(value: string): string {
  const trimmed = value.replace(/^\/+|\/+$/g, '')
  return trimmed ? `/${trimmed}/` : '/'
}

/*
 * GitHub Pages cannot send response headers, so the Content-Security-Policy ships as a meta
 * tag. It is added only to the production build: the dev server injects inline HMR helpers.
 * 'unsafe-inline' for styles is required because Vuetify writes its theme into a <style> tag.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'gliplog-csp',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  }
}

/*
 * `vite build --mode android` builds the Capacitor bundle: served from the app's own origin
 * at "/", with no service worker (the APK already holds every asset, and a worker would keep
 * serving the previous version's files after an app update). It writes to its own directory
 * so it never mixes with the Pages build.
 */
export default defineConfig(({ command, mode }) => {
  const native = mode === 'android'
  const base = native ? '/' : webBase()
  return {
    base,
    define: { __APP_VERSION__: JSON.stringify(pkg.version), __NATIVE__: JSON.stringify(native) },
    plugins: [
      vuetifyRipplePatch({ required: command === 'build' }),
      vue(),
      vuetify({ autoImport: true }),
      contentSecurityPolicy(),
      VitePWA({
        disable: native,
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png', 'layers.css'],
        manifest: {
          id: base,
          name: 'Gliplog: GLP-1 Journal',
          short_name: 'Gliplog',
          description:
            'A private, offline journal for GLP-1 doses, weight and BMI. All data stays on this device.',
          lang: 'en',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'any',
          background_color: '#fbf8f3',
          theme_color: '#2d6567',
          categories: ['health', 'medical', 'lifestyle'],
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,webmanifest}'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          // ECharts is one large chunk; it must be precached for the PK chart to work offline.
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        },
        devOptions: { enabled: false },
      }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    optimizeDeps: {
      // The dev server pre-bundles Vuetify, which bypasses the plugins above.
      rolldownOptions: { plugins: [vuetifyRipplePatch()] },
      // Vuetify 4: keep overlay modules in one pre-bundle so nested overlays stack in dev.
      include: [
        'vuetify/components/VOverlay',
        'vuetify/components/VDialog',
        'vuetify/components/VMenu',
        'vuetify/components/VSelect',
        'vuetify/components/VTooltip',
      ],
    },
    build: {
      target: 'es2022',
      outDir: native ? 'dist-android' : 'dist',
      chunkSizeWarningLimit: 900,
    },
  }
})

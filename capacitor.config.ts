import type { CapacitorConfig } from '@capacitor/cli'

/*
 * The Android app bundles the web build from `npm run build:android` (base "/", no service
 * worker). IndexedDB is scoped to the WebView origin, so the scheme and hostname are pinned:
 * changing either after release would strand every user's data. The appId is permanent once
 * published on Google Play.
 */
const config: CapacitorConfig = {
  appId: 'io.github.gliplog',
  appName: 'Gliplog',
  webDir: 'dist-android',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
  },
  // Web debugging stays at Capacitor's default: on for debug builds only.
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // A white silhouette of the mark: Android draws status bar icons from the alpha channel only.
    LocalNotifications: { smallIcon: 'ic_stat_gliplog', iconColor: '#2d6567' },
  },
}

export default config

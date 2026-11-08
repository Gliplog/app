/**
 * Words that depend on which build is running, so copy names the right phone and settings
 * screen. Fixed at build time (`__PLATFORM__`), so each bundle carries only its own.
 */

/** The phone's system, as copy names it: "in Android settings". */
export const systemName = __PLATFORM__ === 'ios' ? 'iOS' : 'Android'

/** Where to turn Gliplog's notifications back on when the app cannot open the screen itself. */
export const notificationSettingsSteps =
  __PLATFORM__ === 'ios'
    ? 'Open Settings, then Apps, Gliplog, Notifications.'
    : 'Open Android Settings, then Apps, Gliplog, Notifications.'

/** Where to turn the camera back on when the app cannot open the screen itself. */
export const cameraSettingsSteps =
  __PLATFORM__ === 'ios'
    ? 'Open Settings, then Apps, Gliplog, and turn on Camera.'
    : 'Open Android Settings, then Apps, Gliplog, Permissions, Camera.'

/** The phone's health store, as copy names it. */
export const healthStoreName = __PLATFORM__ === 'ios' ? 'Apple Health' : 'Health Connect'

/** Where to change Gliplog's access to Apple Health; Health Connect opens its own screen. */
export const healthAccessSteps = 'Open Settings, then Privacy & Security, Health, Gliplog.'

/**
 * The app's id on both stores (`appId` in capacitor.config.ts). The health store reports it as
 * the source of what Gliplog wrote, so sync never takes back its own readings.
 */
export const appSourceId = 'io.github.gliplog.app'

/**
 * The apps the web build points to for notifications. Update when the iOS app reaches the App
 * Store, so iPhone users are pointed to it too.
 */
export const nativeApps = 'the Gliplog app for Android'

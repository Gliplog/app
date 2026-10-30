/**
 * Words that depend on which build is running, so copy names the right phone and settings
 * screen. Fixed at build time (`__PLATFORM__`), so each bundle carries only its own.
 */

/** The phone's system, as copy names it: "Android will ask you to confirm". */
export const systemName = __PLATFORM__ === 'ios' ? 'iOS' : 'Android'

/** Where to turn Gliplog's notifications back on when the app cannot open the screen itself. */
export const notificationSettingsSteps =
  __PLATFORM__ === 'ios'
    ? 'Open Settings, then Apps, Gliplog, Notifications.'
    : 'Open Android Settings, then Apps, Gliplog, Notifications.'

/**
 * The apps the web build points to for notifications. Update when the iOS app reaches the App
 * Store, so iPhone users are pointed to it too.
 */
export const nativeApps = 'the Gliplog app for Android'

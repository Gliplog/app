# Releasing

Gliplog ships in three places from one codebase: the PWA on GitHub Pages, Google Play, and
F-Droid. iOS is planned.

## Every release

1. Bump `version` in `package.json` (`versionCode` is `major * 10000 + minor * 100 + patch`, so
   0.1.0 is 100).
2. Add `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt` (500 characters at most).
3. `make check-all`, then merge to `main`; Pages deploys on its own.
4. Tag `v<version>` and push the tag. `release.yml` builds the signed `.aab` and `.apk` and
   attaches them to a GitHub release.

## Signing

Create one upload key and keep it out of the repository, backed up in two places. A lost key
means the app can never be updated under the same listing.

```bash
keytool -genkeypair -v -keystore upload.jks -alias gliplog -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 upload.jks   # paste into the GLIPLOG_KEYSTORE_BASE64 secret
```

Repository secrets: `GLIPLOG_KEYSTORE_BASE64`, `GLIPLOG_KEYSTORE_PASSWORD`,
`GLIPLOG_KEY_ALIAS`, `GLIPLOG_KEY_PASSWORD`. Enrol in Play App Signing so Google holds the
app signing key and this one is only the upload key.

## Google Play

- **Listing.** Title and short description come from `fastlane/metadata/android/en-US/`. Keep
  brand names out of the title, short description and icon; mention them only in the full
  description, with the trademark line.
- **Privacy policy.** `https://gliplog.com/privacy.html`.
- **Data safety.** No data collected, no data shared. The app has no network permission, so no
  data is transmitted; data stays on the device and the user can delete it (Settings, Erase
  everything, or uninstall).
- **Health apps declaration.** Declare the app as a health app with the medication-tracking
  and weight-tracking features. It is not a medical device and makes no treatment claims; the
  in-app disclaimer and the store description say so.
- **Content rating and target audience.** Adults (18+).
- **Testing.** New personal developer accounts must run a closed test with enough testers for
  the period Play requires before production access; check the current rule in Play Console.

Play's policies change; read the current Health apps and Data safety pages in Play Console
before each submission rather than relying on this list.

## F-Droid

F-Droid builds from source, so nothing proprietary may be in the build: Capacitor and its
plugins are open source, there are no Google Play Services, and `dependenciesInfo` is off in
`android/app/build.gradle` so no encrypted dependency report is added.

1. Fork `fdroiddata` on GitLab and add `metadata/io.github.gliplog.yml` from
   [fdroid/io.github.gliplog.yml](fdroid/io.github.gliplog.yml), with the release commit.
2. Run `fdroid lint` and `fdroid build -v -l io.github.gliplog` in the fdroidserver container.
3. Open the merge request. Later releases are picked up from tags (`UpdateCheckMode: Tags`).

The listing text, icon and screenshots come from `fastlane/metadata/android/en-US/`. Add phone
screenshots to `images/phoneScreenshots/` (PNG, from a real device) before the first
submission.

## iOS (planned)

Capacitor supports iOS from the same web build: `npm install @capacitor/ios`,
`npx cap add ios`, then open `ios/` in Xcode on a Mac. Keep the same rules as Android: bundle
every asset, no network entitlement beyond the WebView, and a fixed origin so IndexedDB data
survives updates. App Store review needs the privacy nutrition label ("Data Not Collected") and
the same privacy policy URL. Until then, iPhone and iPad users install the PWA from Safari.

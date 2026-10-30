# Gliplog

A private, offline journal for GLP-1 medication: doses, weight, BMI, and how your progress sits
beside the published clinical trials. Install it from the browser to your phone or tablet's home
screen, or from the Android app stores; it then works with no connection. Everything you enter
stays on your device.

Live at [gliplog.com/app](https://gliplog.com/app/). The project site is
[gliplog.com](https://gliplog.com/).

> Gliplog does arithmetic and shows sourced reference figures. It does not recommend doses and
> is not medical advice. Brand names are the trademarks of their owners; Gliplog is not
> affiliated with Novo Nordisk, Eli Lilly or any other manufacturer.

## Features

- **Doses.** Log each dose with its date, time and, for injections, the site (with a rotation
  hint). Today shows when the next dose falls from your own interval.
- **Weight and BMI.** Log weigh-ins in kilograms or pounds; add your height (cm or ft and in)
  to see BMI over time with the WHO adult bands. Adult bands are not shown under 18.
- **Profile.** Height, birth month and year (for age), gender and a goal weight. Every field is
  optional, and gender is never used in a calculation.
- **Trial comparison.** Your change since your first dose beside the endpoint averages from the
  trials in each medicine's US prescribing information (STEP, SURMOUNT, SURPASS, SUSTAIN, OASIS,
  ATTAIN). Only published endpoints are shown; no curve is invented between them.
- **Estimated levels.** For semaglutide and tirzepatide injections and orforglipron tablets, an
  estimate of medicine remaining in the body from the label half-life and time to peak. Doses of
  the same medicine pool across brands, so switching keeps one curve. Semaglutide tablets get no
  curve: under 2% is absorbed.
- **Compounded vials.** Enter the vial strength once and every dose also reads as units on a
  U-100 syringe.
- **Private and offline.** No account, no server, no analytics, and nothing you enter is ever
  sent. The web app only checks GitHub Pages for its own updates; the Android app makes no
  requests at all. Back up to a JSON file you keep, and restore from it.
- **Phones and tablets, light and dark.** Follows the device theme.

## Medications

Ozempic, Wegovy (pen and tablets), Mounjaro, Zepbound, Foundayo, Rybelsus, Ozempic tablets,
compounded semaglutide and compounded tirzepatide, plus anything else you name yourself. Adding
one is a data change: see [docs/adding-a-medication.md](docs/adding-a-medication.md).

## How the numbers work

- Starting weight: your last weigh-in on or before your first logged dose (as trials measure it),
  else your first one after it, which the app says.
- Change: kilograms and percent of the starting weight; weeks count from the first dose.
- Trial comparison: your latest weigh-in up to the trial's endpoint week, beside each arm's
  mean change at that week, in the trial's own measure (percent or kilograms).
- BMI: weight in kg divided by height in metres squared.
- Levels: a one-compartment model with first-order absorption and elimination, fitted to the
  published half-life and time to peak and summed over doses. It estimates medicine remaining in
  the body, not blood concentration.
- Syringe units: dose / strength gives mL; mL x 100 gives U-100 units.

## Installing on a device

Settings shows the steps for the browser you are using.

| Device                  | Steps                                                     |
| ----------------------- | --------------------------------------------------------- |
| Android, Chrome or Edge | Menu, Install and create shortcut (or Add to Home screen) |
| Android, Firefox        | Menu, Add app to Home screen                              |
| iPhone or iPad, Safari  | Share, Add to Home Screen                                 |
| iPhone or iPad, Chrome  | Share (in the address bar), Add to Home Screen            |

On iPhone and iPad, Safari and the installed app keep separate data; use a backup to move it.
Make regular backups (Settings): browsers can clear site data under storage pressure. The app
shares its origin with the project site, so clearing site data for `gliplog.com` erases
the app's data too.

## Development

Requires Node 24 (see `.nvmrc`).

```bash
nvm use
make install
make dev          # http://localhost:5173/app/
make check        # fast gate
make check-all    # full gate, including offline e2e tests
```

Project conventions for contributors and coding agents are in [CLAUDE.md](CLAUDE.md) and
`.claude/skills/`.

## Deploying to GitHub Pages

This repository is `Gliplog/app`, served at `https://gliplog.com/app/`.

1. In the repository settings, under Pages, set the source to **GitHub Actions**.
2. Push to `main`. `.github/workflows/deploy.yml` runs the gate, builds with the repository name
   as the base path (`/app/`), and publishes.

For a custom domain served from the root, set the repository variable `GLIPLOG_BASE` to `/`.

## Android, Google Play and F-Droid

The Android app is a [Capacitor](https://capacitorjs.com) shell around the same web build,
bundled into the APK so it works offline from first launch. It requests no network permission;
CI fails if the merged manifest ever asks for one. Cloud backup is off.

```bash
make android      # build dist-android/ and sync it into android/
cd android && ./gradlew assembleDebug    # needs JDK 21 and the Android SDK
```

- `.github/workflows/android.yml` builds a debug APK on every push.
- `.github/workflows/release.yml` builds a signed App Bundle (Play) and APK on a `v*` tag and
  attaches both to a GitHub release.
- `fastlane/metadata/android/` holds the store listing that F-Droid reads.

The app id `io.github.gliplog` and the WebView origin `https://localhost` must never change
after release. The release checklist, Play's health-app and Data safety answers, the F-Droid
submission and the path to iOS are in [docs/releasing.md](docs/releasing.md).

## License

AGPL-3.0. See [LICENSE](LICENSE).

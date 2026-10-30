# Architecture

Part of the `engineering-standards` skill.

## Layout

```
src/
  domain/        pure logic: units (weight, height, formatting), body (age, BMI, WHO bands),
                 progress (baseline, change series, trial comparison, cohort overlay), schedule
                 (next dose, syringe units), pk, levels (pooling and the curve model), glucose
                 (HbA1c and glucose units, glycemic comparison), symptoms (side-effect list and
                 summary), listing, catalog types
  data/          medications.json, its JSON Schema, typed loader (index.ts)
  db/            Dexie database (schema history), repository, backup export/restore
  stores/        Pinia: journal (medications, doses, weights, side effects, blood sugar, the
                 focused medication), settings (units, theme, profile),
                 notify, confirm
  composables/   useBodyMetrics, useChartColors, useInstallPrompt, useStoragePersistence, useNow,
                 usePaging, useHideOnScroll
  services/      time.ts (the only clock and date formatter), fileTransfer.ts (share/download),
                 pdf/ (dependency-free PDF writer), report/ (journal report data and layout)
  components/    journal/ (dialogs), charts/, common/
  views/         one per route: Today, Progress, History, Settings
  plugins/       vuetify.ts (themes, defaults), icons.ts (inline SVG icons), fonts.ts
  styles/        tokens.css (design tokens), theme.css (global and Vuetify overrides)
public/          icons, favicon, layers.css (cascade layer order, linked before bundles)
tests/           Vitest, mirrors src/
e2e/             Playwright against `vite preview` of the production build
scripts/         gate scripts (contrast, tokens, markdown), Android icons
vendor/          patched copies of build-time dependencies (see testing-and-gates.md)
build/           Vite plugins that patch a dependency at build time (see testing-and-gates.md)
fastlane/        store listing metadata (F-Droid reads it; Play mirrors it)
```

## Data flow

A view reads from a store or a composable; a store reads and writes through `repository`;
the repository is the only code that touches Dexie. Arithmetic is always a call into
`domain/`. Dialogs keep their form state locally and reset it from props on each open; anything
that must survive a reload goes into the database.

## Storage

- IndexedDB via Dexie, database `gliplog`. Tables: `medications`, `doses`, `weights`,
  `symptoms` and `glucose` (both from version 2), `settings` (key/value; the profile is the
  `profile` key, sanitised on load).
- HbA1c is stored in NGSP percent and glucose in mg/dL, unrounded, with the unit typed;
  Settings chooses the display units, as for weight.
- Ids are `crypto.randomUUID()`; timestamps are UTC ISO strings. A birth month is a `YYYY-MM`
  calendar string, never an instant.
- Deleting a medication deletes its doses in the same transaction. Stopping one keeps both.
- `navigator.storage.persist()` is requested on launch (Settings shows the result). Safari may
  still evict data; a backup file (Settings, Save a backup) is the only guarantee. The app
  shares the `gliplog.com` origin with the marketing site, which must never register a
  service worker or run scripts.
- Backups are versioned JSON (`format: "gliplog-backup"`, version 2). `parseBackup` validates
  untrusted input fully before `restoreBackup` replaces data atomically; a version 1 file
  restores with no side effects or blood sugar.

## Progress and trials

`domain/progress.ts` picks the baseline (last weigh-in at or before the first dose, else the
first after it, flagged), measures weeks from the first dose, and compares the latest weigh-in
up to a trial's endpoint week with each arm's published mean, in the trial's own measure.
Progress measures week 0 from the first dose of the chosen medicine (its level group), so a
switch from semaglutide to tirzepatide is compared with SURMOUNT from the first tirzepatide
dose. `domain/cohort.ts` merges every published readout of a medicine (weight, HbA1c, fasting
glucose) across its trials: each arm is a point at its trial's final week, and the band is
the range of active arms at each readout week, joined by straight lines from week 0. Kilogram
trials show as percent of the arm's starting weight, flagged as derived. Blood-sugar
comparisons open on the type 2 diabetes trials, because people without diabetes barely change.
Each trial's own card, as printed, is folded below the merged chart.

## Sharing and reports

- Share images (`components/share/`) are drawn on a canvas on the device: a 4:5 card with the
  mark, headline figures, the same ECharts option as the app, and a caption. Numbers are off
  by default for trends (weight shows as percent change). They leave only through the share
  sheet or a download (`services/fileTransfer.ts`).
- The PDF report (`services/report/`, writer in `services/pdf/`) is built on the device from
  formatted data: medications, weight, side effects with the labels' terms, HbA1c, glucose
  and the dose log. Standard fonts, no scripts or metadata; text enters only through
  `pdfString`. The print palette mirrors the light tokens and is tested against them.

## PK model

`domain/pk.ts` implements a one-compartment model with first-order absorption and elimination
(the Bateman function), superposed over doses. `ka` is solved from the published half-life and
time to peak by bisection, which handles flip-flop kinetics. The output is an amount in the body
in mg, not a concentration. Doses pool by PK profile (`domain/levels.ts`), so brands of the same
medicine and route share one curve.

## PWA and hosting

- `vite-plugin-pwa` (generateSW) precaches every built asset, including the ECharts chunk and
  fonts. `registerType: 'prompt'`: an update waits until the user reloads (`UpdatePrompt.vue`).
- Base path comes from `GLIPLOG_BASE` (default `/gliplog/`). The router uses hash history so
  every URL resolves to `index.html` on GitHub Pages and offline.
- A production-only meta CSP (`default-src 'self'`) is injected by `vite.config.ts`, because
  GitHub Pages cannot set headers. Styles need `'unsafe-inline'` for Vuetify's theme tag.

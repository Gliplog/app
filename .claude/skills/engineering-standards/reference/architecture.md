# Architecture

Part of the `engineering-standards` skill.

## Layout

```
src/
  domain/        pure logic: units (weight, height, formatting), body (age, BMI, WHO bands),
                 progress (baseline, change series, trial comparison), schedule (next dose,
                 syringe units), pk, levels (pooling and the curve model), listing, catalog types
  data/          medications.json, its JSON Schema, typed loader (index.ts)
  db/            Dexie database (schema history), repository, backup export/restore
  stores/        Pinia: journal (medications, doses, weights), settings (units, theme, profile),
                 notify, confirm
  composables/   useBodyMetrics, useChartColors, useInstallPrompt, useStoragePersistence, useNow,
                 usePaging, useHideOnScroll
  services/      time.ts (the only clock and date formatter), fileTransfer.ts (share/download)
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

- IndexedDB via Dexie, database `tidebook`. Tables: `medications`, `doses`, `weights`,
  `settings` (key/value; the profile is the `profile` key, sanitised on load).
- Ids are `crypto.randomUUID()`; timestamps are UTC ISO strings. A birth month is a `YYYY-MM`
  calendar string, never an instant.
- Deleting a medication deletes its doses in the same transaction. Stopping one keeps both.
- `navigator.storage.persist()` is requested on launch (Settings shows the result). Safari may
  still evict data; a backup file (Settings, Save a backup) is the only guarantee. The app
  shares the `tidebook.github.io` origin with the marketing site, which must never register a
  service worker or run scripts.
- Backups are versioned JSON (`format: "tidebook-backup"`). `parseBackup` validates untrusted
  input fully before `restoreBackup` replaces data atomically.

## Progress and trials

`domain/progress.ts` picks the baseline (last weigh-in at or before the first dose, else the
first after it, flagged), measures weeks from the first dose, and compares the latest weigh-in
up to a trial's endpoint week with each arm's published mean, in the trial's own measure.

## PK model

`domain/pk.ts` implements a one-compartment model with first-order absorption and elimination
(the Bateman function), superposed over doses. `ka` is solved from the published half-life and
time to peak by bisection, which handles flip-flop kinetics. The output is an amount in the body
in mg, not a concentration. Doses pool by PK profile (`domain/levels.ts`), so brands of the same
medicine and route share one curve.

## PWA and hosting

- `vite-plugin-pwa` (generateSW) precaches every built asset, including the ECharts chunk and
  fonts. `registerType: 'prompt'`: an update waits until the user reloads (`UpdatePrompt.vue`).
- Base path comes from `TIDEBOOK_BASE` (default `/tidebook/`). The router uses hash history so
  every URL resolves to `index.html` on GitHub Pages and offline.
- A production-only meta CSP (`default-src 'self'`) is injected by `vite.config.ts`, because
  GitHub Pages cannot set headers. Styles need `'unsafe-inline'` for Vuetify's theme tag.

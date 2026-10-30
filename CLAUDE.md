# Tidebook

A private, offline journal for GLP-1 medication (brand and compounded): doses, weight, BMI,
side effects, HbA1c and glucose, trial comparisons and estimated levels. A static PWA on GitHub
Pages at `https://tidebook.github.io/app/`, also shipped as a Capacitor Android app (Google Play and
F-Droid). No backend, no accounts, no network requests; all data stays in IndexedDB on the
device. The marketing site is the separate `Tidebook/tidebook.github.io` repository, which
shares this origin.

## Commands

All commands run on the Node version in `.nvmrc` (`nvm use`); never system Node.

| Command          | Purpose                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `make install`   | `npm ci`                                                                                         |
| `make dev`       | Vite dev server (no service worker in dev)                                                       |
| `make check`     | Fast gate: lint, format, typecheck, token and contrast checks, markdown, knip, unit tests, build |
| `make check-all` | Full gate before declaring done: adds Playwright e2e (offline, PWA) and `npm audit`              |
| `make preview`   | Serve the production build at `http://localhost:4173/app/`                                       |
| `make android`   | Build the Capacitor bundle (`dist-android/`) and sync it into `android/`                         |

## Skills and rules

| Skill                                           | Load when                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `.claude/skills/engineering-standards/SKILL.md` | Structure, domain logic, storage, stores, tests, tooling, deployment |
| `.claude/skills/front-end/SKILL.md`             | Components, views, styling, theming, charts, copy                    |
| `.claude/skills/medication-catalog/SKILL.md`    | Editing `src/data/medications.json`                                  |

Path-scoped rules in `.claude/rules/` cover comments, markdown, time, data and privacy, and the
catalog. A post-edit hook lints edited TypeScript and Vue, checks markdown for em-dashes, runs
the catalog tests after JSON edits, and re-checks contrast after token edits. Releases (Play,
F-Droid, iOS later) are in `docs/releasing.md`.

## Non-negotiables

- No network requests, CDNs, analytics, or remote fonts; every asset is bundled and precached.
- All persistence through `src/db/repository.ts`; schema changes add a Dexie version.
- Arithmetic lives in `src/domain/` (pure, unit tested). Weight is stored in kg and height in
  cm, unrounded; units convert only for display and entry.
- Every number shown to users carries a source. Trial figures are copied from the label as
  printed and never read off a figure. The cohort chart joins one medicine's published
  readouts from different trials with straight lines, and shows a kilogram readout as percent
  of the arm's starting weight; both are labelled on the chart and in its sources
  (`src/domain/cohort.ts`). PK curves only from human data or clearly labelled user-supplied
  values.
- Tidebook does arithmetic and shows sourced references; it never recommends a dose.
- Copy is warm, plain and inclusive: no shame or judgement about weight, every profile field
  optional, gender never used in a calculation.
- Brand names are trademarks of their owners; Tidebook is not affiliated with any maker, and
  says so in Settings.

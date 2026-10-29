---
name: medication-catalog
description: 'Use when adding or editing a medication, PK profile, titration, or trial in src/data/medications.json.'
---

# Medication catalog

The catalog is `src/data/medications.json`, typed by `src/domain/catalog.ts`, validated by
`src/data/medications.schema.json` and `tests/data/catalog.spec.ts`. The walkthrough for a new
medication is `docs/adding-a-medication.md`.

## Shape

| Section      | Holds                                                                           |
| ------------ | ------------------------------------------------------------------------------- |
| `pkProfiles` | One per medicine and route; doses pool by profile across brands                 |
| `products`   | Brand or compounded product: strengths, titration, interval, profile, trial ids |
| `trials`     | Endpoint week, arms (dose, baseline kg, mean change), measure, analysis, source |

## Rules

1. Figures come from the US prescribing label (DailyMed). Verify each against the label's
   structured text (`/dailymed/services/v2/spls/<setid>.xml`), not a summary of it.
2. A trial reports one endpoint week; never add intermediate points. `measure` is the label's
   own unit (`percent` or `kg`).
3. A product lists only trials of its own medicine and route (a comparator arm of its medicine
   counts, as semaglutide 1 mg in SURPASS-2), most relevant population first.
4. Titration steps use label strengths and are shown as the label's schedule, never as advice.
5. Compounded products reuse the brand's PK profile and trials, and their note says the trials
   studied the brand product.
6. Ids are kebab-case and permanent: stored medications reference product ids.

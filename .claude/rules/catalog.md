---
paths: ['src/data/**']
---

# Medication catalog

- Every number shown to users carries a source (`label`, `trial`, `standard`, `model`). Trial
  endpoints are copied exactly as printed in the label's section 14; never read a value off a
  figure, and never store a converted value in the catalog. Merging readouts across trials and
  deriving percent from kilograms happen only in `src/domain/cohort.ts`, flagged as derived.
- Built-in PK curves require human data: the schema demands a `label` or `trial` source on `pk`.
  Where an estimate would mislead, `pk` is `null` with a `pkUnavailableReason`.
- Edit the JSON, then run `npx vitest run tests/data`: the schema and consistency tests are the
  gate. Detail: the `medication-catalog` skill.

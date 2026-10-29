# Adding a medication

Medications, their pharmacokinetic profiles and the trials they are compared with live in
`src/data/medications.json`, checked by `src/data/medications.schema.json` and
`tests/data/catalog.spec.ts`. Adding one needs no code change.

## Steps

1. **PK profile.** If the medicine and route are new, add a `pkProfiles` entry. Use the half-life
   and time to peak from the prescribing label (section 12.3). Where the label gives a range,
   pick a value inside it and add a `model` source saying so. If an amount-in-body estimate
   would mislead (an oral medicine with about 1% bioavailability), set `pk` to `null` and write a
   `pkUnavailableReason`.
2. **Trials.** For each trial to compare with, copy the endpoint means exactly as printed in the
   label's section 14 table: week, each arm's mean change, and each arm's baseline weight. Use
   `percent` when the label reports percent and `kg` when it reports kilograms; never convert
   one into the other. Never add intermediate weeks read off a figure.
3. **Product.** Add the `products` entry: label strengths, the titration steps from section 2,
   the interval, the PK profile id, and trial ids with the most relevant first (the same
   population as the product's indication).
4. Run `npx vitest run tests/data`. The tests check the schema, every reference, that trials
   match the product's medicine and route, and that titration doses are label strengths.

## Sources

Link to the DailyMed label (`https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=...`).
To check numbers against the label text, download the structured label from
`https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/<setid>.xml` and search its section 14
tables; summaries of the label can misread a table.

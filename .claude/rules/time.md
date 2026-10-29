---
paths: ['src/**']
---

# Time

- Records store UTC ISO-8601 strings (`nowIso()`); a local or naive timestamp in storage is a bug.
- Only `src/services/time.ts` reads the clock or formats dates; ESLint rejects `new Date()`,
  `Date.now()` and `toLocale*String()` elsewhere. Pass a `Clock` into code that needs "now" so
  tests can fix it.
- Display uses the device locale and time zone through `Intl`, never a hard-coded format.

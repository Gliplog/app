---
paths: ['src/**']
---

# Data and privacy

- Gliplog makes no network requests: no `fetch`, no CDN, no analytics, no remote fonts or icons.
  ESLint blocks `fetch`; the e2e suite fails on any non-local request; the production CSP is
  `default-src 'self'`.
- All user data goes through `src/db/repository.ts` (IndexedDB via Dexie). Never use
  `localStorage`/`sessionStorage` (ESLint blocks them): data outside the database is missed by
  backups.
- A Dexie schema change is a new `db.version(n + 1)` with an `.upgrade()`; never edit a released
  version. The user's device holds the only copy of their data.
- A change to stored row shapes updates `src/db/backup.ts` validation and bumps
  `BACKUP_VERSION` when old backups need migrating on restore.

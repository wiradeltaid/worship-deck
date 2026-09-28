# 04: Factory Reset Backend Endpoint and Admin UI Integration

**What to build:** In `internal/httpapi/admin_reset.go`, `internal/httpapi/server.go`, `spa/src/pages/AdminSyncPage.tsx`, `src/lib/i18n/`, `package.json`, and `tests/factory-reset.test.mjs`:

1. **Architectural Authority (`DEC-078`)**:
   - Backed by `DEC-078`, which explicitly narrows `AD-17`'s bulk re-seed prohibition to allow an authenticated, interactive administrator-initiated factory restoration while maintaining the strict prohibition against automatic re-seeding on restart or read.

2. **Backend Factory Reset Handler (`internal/httpapi/admin_reset.go`)**:
   - Register route `POST /api/admin/reset-factory` in `internal/httpapi/server.go`.
   - Security gate:
     - Return HTTP 401 Unauthorized if session is absent or expired.
     - Return HTTP 403 Forbidden if authenticated caller role is not `admin`.
   - In handler `handleResetFactory`:
     - Clear dynamic user data tables: `services`, `service_field_values`, `service_form_layout_snapshots`, `service_registry_snapshots`, `service_song_set_layouts`, `announcement_items`, `sync_tombstones`, `sync_device_mutations`.
     - Delete authored custom templates (`WHERE seed_hash IS NULL`) and non-default songbooks.
     - Re-seed canonical defaults:
       - Reseed default songbook (SDAH from `data/song-book/sdah.json`).
       - Reseed default scripture (KJV from `data/en/bible-translation/kjv.json`).
       - Reseed default layout trio from `data/default-song-set-layouts.json`.
       - Reseed default registry from `data/default-registry.json` and `data/asset-map.json`.
     - Remove user uploaded assets in uploads directory, strictly preserving `./data/fonts/` and bundled font files.
     - Preserve user `accounts` (so admin remains authenticated) and system `settings`.
     - Return JSON `{ "ok": true, "message": "Factory reset complete" }`.

3. **Admin UI Action and Confirmation Dialog (`spa/src/pages/AdminSyncPage.tsx`)**:
   - Add a destructive action card in the Admin interface:
     - Title: "Factory Reset" / "Reset ke Data Awal Pabrik".
     - Description: "Resets all local services, custom layouts, and cached media back to fresh out-of-the-box defaults."
     - Button: "Reset to Factory Defaults" with confirmation modal (`Dialog`) requiring explicit confirmation before calling `POST /api/admin/reset-factory`.
   - On success: show success notification and reload page to refresh in-memory state.

4. **Bilingual Localization (`src/lib/i18n/`)**:
   - Add i18n keys for factory reset title, description, confirmation dialog, and button labels to `keys.ts`, `catalogue-en.ts`, and `catalogue-id.ts` ensuring 100% parity.

5. **Automated Verification Suite (`tests/factory-reset.test.mjs`)**:
   - Assert `POST /api/admin/reset-factory` returns HTTP 401 for anonymous callers and HTTP 403 for authenticated operator role accounts.
   - Assert that invoking factory reset on a populated database clears custom services and restores default seeds.
   - Assert bilingual i18n key parity for new factory reset keys.

Satisfies `FR-20`, `FR-21`, `UC-14`, `UC-15`.

**Blocked by:** SPEC-92-03

**Status:** open

- [ ] In `internal/httpapi/`:
      - Implement `handleResetFactory` and register route `POST /api/admin/reset-factory`.
      - Enforce 401 on unauthenticated and 403 on non-admin callers.
- [ ] In `spa/src/pages/AdminSyncPage.tsx`:
      - Implement factory reset button and destructive confirmation dialog.
- [ ] In `src/lib/i18n/`:
      - Add bilingual i18n keys to `keys.ts`, `catalogue-en.ts`, and `catalogue-id.ts`.
- [ ] In `package.json`:
      - Register `tests/factory-reset.test.mjs`.
- [ ] In `tests/factory-reset.test.mjs`:
      - Implement test suite for factory reset endpoint and UI contracts.

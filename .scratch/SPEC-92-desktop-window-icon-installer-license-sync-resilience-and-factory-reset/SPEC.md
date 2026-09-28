# SPEC-92 — Desktop Window Icon, Installer License Page, Sync Asset Resilience, and Factory Reset

## Requirement Traceability & Scope
- **PRD**: `offline-deck`, `operator-turn`
- **Architectural Decisions**:
  - `AD-17` (narrowed by `DEC-078`: Explicit Administrator Factory Reset)
  - `AD-30` (Three-Tier Architecture — Go HTTP API + Vite React SPA + Node.js PPTX worker)
  - `AD-31` (Artifact Registry — Admin-Configurable Structure and Slides)
  - `AD-33` (Free-Canvas Song-Set Layout Trio Seeding — Title, Verse, Reff roles)
  - `DEC-078` (Administrator Factory Reset Operation Narrows AD-17)
- **Functional Requirements**:
  - `FR-20` (Offline Presentation Capability)
  - `FR-21` (Offline Structure Survival across Restarts and Redeploy)
  - `FR-40` (Manual Device Sync — Bidirectional Data and Asset Exchange between Local and Remote Instances)
- **Use Cases**:
  - `UC-14`, `UC-15` (Artifact Management & Seed Baseline)
  - `UC-32` (Manual Device Data Sync)
- **Components**: `hub`, `registry`
- **Touches**: `artifacts`, `desktop`, `installer`, `settings`, `sync`

---

## Problem Statement

During hand-testing of the standalone Windows desktop installer and cross-machine cloud sync, four issues were identified by the operator:

1. **Missing Installer License Agreement Page:**
   - In `installer/worship-deck.iss`, the Inno Setup configuration lacks a `LicenseFile` directive in `[Setup]`.
   - Consequently, the installer skips the standard legal agreement step and navigates directly to component/directory selection.
   - Upstream SSOT policy in `ops` (`ops/research/wdi-ecosystem-strategy/legal/license-policy.md` § 6 and `legal/worship-deck/license-page.en.md`) mandates that WorshipDeck code is distributed under the MIT License and requires the unabridged `LICENSE` file to be packaged and presented to users during installation (consistent with sister products `wira-desk` and `snapdown`).

2. **Missing Window Title Bar and Taskbar Icon in Native Desktop Runtime:**
   - Although the application `.exe` has embedded Windows PE icon resources via `rsrc_windows_amd64.syso`, the runtime window created by `webview2` in `internal/desktop/window_windows.go` does not bind the icon to the window's `HWND`.
   - As a result, the window title bar (top-left corner) and the Windows taskbar show a generic executable icon instead of the branded WorshipDeck icon while the application is running.

3. **Cloud Sync Pull Failure with "error: Asset not found":**
   - In `src/lib/sync/client.ts`, `extractUploadHashes` used an overbroad regular expression `hex64Regex = /^[a-f0-9]{64}$/i` across all string properties.
   - When pulling cloud updates from `presenter-dev.bic.my.id`, layout metadata columns such as `seed_hash` (e.g. `7219112486...` in `song_set_layouts`) are falsely interpreted as upload file hashes.
   - The client checks local storage, determines the hash is missing, and requests `GET /api/sync/assets/{hash}` from the remote server.
   - Because `seed_hash` is a layout JSON digest and not an uploaded binary file in `/var/lib/presenter-dev/uploads/`, the server returns HTTP 404 `"Asset not found"`, causing `executePull` in `AdminSyncPage.tsx` to throw a fatal `SyncHttpError` and abort the entire pull operation.
   - Furthermore, asset hydration lacks graceful degradation: an individual missing media asset aborts the entire synchronization of core schedules, hymns, and orders of service.

4. **Lack of Uninstall Data Wipe Option and In-App Factory Reset:**
   - The uninstaller preserves `%LocalAppData%\WorshipDeck` by default, but provides no prompt or option for operators who wish to perform a clean uninstallation and wipe all cached databases.
   - Operators troubleshooting corrupted local databases or wishing to restore the initial installation state currently have no in-app mechanism to reset the application back to factory default seeds. Under `AD-17`, bulk re-seeding of live databases was strictly forbidden to prevent automatic restart resurrection of deleted templates; an explicit administrative reset requires architectural authorization via `DEC-078`.

---

## Solution

1. **Installer License Page (`installer/worship-deck.iss`)**:
   - Add `LicenseFile=..\dist-desktop\LICENSE` in `[Setup]`.
   - Staged directly from repo root `LICENSE` (unabridged MIT License text approved in `ops/research/wdi-ecosystem-strategy/legal/license-policy.md`).
   - Displays the official MIT License agreement page during the Inno Setup installation wizard prior to directory selection.

2. **Native Win32 Window Icon Stamping (`internal/desktop/window_windows.go`)**:
   - In `RunDesktopWindow`, after creating the `webview2` instance, retrieve the Win32 window handle (`HWND`).
   - Load the icon resource embedded in the module (resource ID 1 from `rsrc_windows_amd64.syso`) via `LoadIconW` or `ExtractIconW`.
   - Dispatch `WM_SETICON` messages for both `ICON_SMALL` (title bar, 16x16 / system small) and `ICON_BIG` (taskbar / Alt+Tab, 32x32 / system big).

3. **Sync Asset Extraction Filtering and Resilient Hydration Pipeline (`src/lib/sync/client.ts`, `spa/src/pages/AdminSyncPage.tsx`)**:
   - In `src/lib/sync/client.ts`:
     - Maintain strict SHA-256 (64 hex characters) asset identity per the published sync protocol.
     - Eliminate the blind `hex64Regex.test(val)` check.
     - Match only URI paths explicitly referencing uploaded files: `/\/api\/uploads\/([a-f0-9]{64})\.[a-z0-9]+/gi`.
     - Explicitly ignore layout/schema metadata digests (`seed_hash`, `content_hash`, and entity UUIDs).
   - In `spa/src/pages/AdminSyncPage.tsx`:
     - Wrap individual asset download calls in a try-catch block during `executePull`.
     - Catch HTTP 404 (`Asset not found`) errors specifically as non-fatal missing auxiliary assets.
     - Track skipped assets with their hash and reason in a structured list (`skippedAssets`).
     - Display a partial-success status in the UI: e.g. `"Pull completed! Applied X updates from cloud. Y media assets could not be downloaded."`
     - Preserve fatal handling for authentication failures (401/403) to trigger the re-auth dialog.

4. **Uninstaller Data Removal Option and In-App Factory Reset (`installer/worship-deck.iss`, `internal/httpapi/`, `spa/src/pages/`)**:
   - Uninstaller Data Prompt:
     - In `installer/worship-deck.iss` under `[Code]`, in `CurUninstallStepChanged` at `usUninstall`:
       Prompt the operator with `MsgBox`:
       `"Do you also want to delete all user data, service plans, and local databases in %LocalAppData%\WorshipDeck?\n\nSelect 'No' to keep your data for future installations."`
     - If `IDYES`, delete `{localappdata}\WorshipDeck` recursively using `DelTree`. If `IDNO`, preserve the directory.
   - In-App Factory Reset (`DEC-078`):
     - Implement backend endpoint `POST /api/admin/reset-factory` in `internal/httpapi/admin_reset.go`.
     - Enforce authorization: `401 Unauthorized` for missing/expired session; `403 Forbidden` for authenticated non-admin.
     - Truncate dynamic tables: `services`, `service_field_values`, `service_form_layout_snapshots`, `service_registry_snapshots`, `service_song_set_layouts`, `announcement_items`, `sync_tombstones`.
     - Preserve `accounts` and `settings`.
     - Re-seed canonical factory files: `default-song-set-layouts.json`, `default-registry.json`, `asset-map.json`, `sdah.json`, `kjv.json`.
     - Purge non-font files in `uploads/`, strictly preserving `./data/fonts/`.
     - Expose a "Reset to Factory Defaults" action in Admin UI with a double-confirmation modal and bilingual copy (EN/ID).

---

## User Stories

1. As an operator installing WorshipDeck on Windows, I want to review the application license terms during setup, so that our organization complies with open-source licensing requirements.
2. As a desktop operator, I want the running application window and taskbar entry to display the official WorshipDeck icon, so that the application is easily identifiable among open windows.
3. As an administrator pulling data from cloud (`presenter-dev`), I want layout metadata like `seed_hash` to be treated as configuration and not media uploads, so that sync pull does not fail with "Asset not found".
4. As an administrator syncing data over unreliable connections, I want missing individual media items to record clear warnings rather than crashing the entire sync, so that my services and songs are updated reliably.
5. As an operator uninstalling WorshipDeck, I want to be asked whether to delete local databases in `%LocalAppData%\WorshipDeck`, so that I can choose between a clean removal and preserving data for a future re-install.
6. As an administrator encountering local database corruption or testing initial onboarding, I want a "Reset to Factory Defaults" button in the admin interface, so that I can restore the application to its clean out-of-the-box state without manual file deletion.

---

## Implementation Decisions

- **Installer License Reference**: Point `LicenseFile` directly to `..\dist-desktop\LICENSE` (staged by `scripts/build-desktop.mjs` from the repository's MIT `LICENSE`).
- **Win32 Icon API**: Use `user32.dll` procedures `SendMessageW` (or `PostMessageW`), `GetModuleHandleW`, and `LoadIconW` with resource ID 1 (`MAKEINTRESOURCE(1)`), applying both `ICON_SMALL` (0) and `ICON_BIG` (1).
- **Asset Extraction Contract**: Restrict asset hash extraction strictly to explicit upload paths (`/api/uploads/<hash>.<ext>`). Never treat bare 64-hex strings in arbitrary JSON fields as media assets.
- **Factory Reset Authorization & Bounds**: Authorize factory reset under `DEC-078` narrowing `AD-17`. Protect `POST /api/admin/reset-factory` with `requireAdmin`, returning 401 for unauthenticated and 403 for non-admin.

---

## Testing Decisions

- `tests/installer-license-and-uninstall.test.mjs`:
  - Verify `installer/worship-deck.iss` declares `LicenseFile` pointing to the staged `LICENSE`.
  - Verify `CurUninstallStepChanged` contains the interactive confirmation prompt for `{localappdata}\WorshipDeck` deletion with `DelTree`.
- `tests/desktop-window-icon.test.mjs`:
  - Verify `internal/desktop/window_windows.go` imports and calls `SendMessage` / `WM_SETICON` with valid icon constants on Windows.
- `tests/sync-asset-resilience.test.mjs`:
  - Assert that `extractUploadHashes` ignores `seed_hash` (`7219112486...`), `content_hash`, and entity UUIDs from a realistic cloud sync payload.
  - Assert that simulated 404 errors during asset download in client pipeline resolve gracefully and populate `skippedAssets` without aborting the batch mutation push.
- `tests/factory-reset.test.mjs`:
  - Verify `POST /api/admin/reset-factory` requires admin authentication (401 for anonymous, 403 for operator role).
  - Verify that invoking factory reset on a populated database clears custom services and restores default seeds.
  - Verify bilingual i18n key parity for new factory reset keys.

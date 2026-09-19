# 04: Desktop Sync Status, Settings Drawer & Screen Replacement Matrix

**What to build:**
Implement the in-workspace Desktop Sync status, Settings Drawer, complete legacy screen replacement matrix, and comprehensive smoke test suite:
1. In-Workspace Desktop-to-Web Sync Integration:
   - Provide a persistent **Sync Status Badge** in the workspace header:
     - `🟢 Terhubung & Sinkron` (All changes synced).
     - `🟡 3 Perubahan Lokal` (Pending push/pull).
     - `🔴 Konflik Terdeteksi` (Version skew detected).
   - **Atomic Aggregate Sync Contract:**
     - Sync operations execute in a single `BEGIN IMMEDIATE` transaction in SQLite WAL mode.
     - Entire aggregate transferred together: `services` + all `schedule_items` + referenced `schedule_preset_versions`.
     - Entities identified by UUIDv7 with tombstone tracking for deletions.
     - `schema_version` gate: older desktop clients encountering newer schema elements receive a non-destructive upgrade prompt rather than failing silently.
   - **Conflict Resolution Dialog (`ServiceConflict`):**
     - Side-by-side diff viewer showing local vs. server payloads.
     - Deterministic resolution options: "Gunakan Versi Lokal" (force push with incremented revision), "Gunakan Versi Server" (accept remote), or "Simpan sebagai Salinan Baru" (fork instance with fresh UUIDv7).
2. In-Workspace Settings & Administration Drawer:
   - Provide a gear icon (⚙️ "Pengaturan") in the workspace shell opening a comprehensive drawer:
     - Tab 1: **Akun & Akses** (`AccountsManager`): manage operators and admin users.
     - Tab 2: **Ibadah & Alkitab** (`WorshipSettings`): default slide transitions (fade, none, push) and installed Bible versions (TB2, KJV, BIS).
     - Tab 3: **Sistem & Retensi** (`SystemSettings`): PPTX retention days, UI locale toggle (Indonesian / English).
     - Tab 4: **Alat & Paritas**: link to `ParityDiagnosticPage` (`/services/diagnostic-parity`) for visual parity checks.
3. Complete Screen Replacement & Compatibility Map:
   - Document and verify the replacement of legacy screens:
     - `DashboardPage` (`/`) &rarr; Schedule History Drawer (`📂 Riwayat Jadwal`).
     - `CreateServicePage` (`/services/new`) &rarr; Workspace Raw Rundown & Parser Tab.
     - `RunSheetPage` (`/services/:id`) &rarr; Unified 3-Panel Workspace.
     - `AdminPage` (`/admin`) &rarr; In-Workspace Settings Drawer.
     - `AdminSyncPage` (`/admin/sync`) &rarr; In-Workspace Sync Dialog.
     - `AdminArtifactsPage` (`/admin/artifacts`) &rarr; In-Place Canvas Designer + Preset Manager.
   - Compatibility Path: legacy routes remain accessible via compatibility redirects or dual-track feature flag until 100% parity is verified.
4. Comprehensive Smoke Test Suite:
   - Create `tests/smoke-spec-50.test.mjs` verifying:
     - Mode switcher toggle between Schedule Instance and Master Preset Builder.
     - Master Preset CRUD and deletion dependency check guard.
     - Schedule History drawer and explicit save action.
     - Reusable Master Song Sets, Announcement Sets, and Canvas Template registration.
     - Remote Control pairing modal QR code, rate-limited PIN, and token expiry.
     - Sync Status badge, atomic aggregate contract, and conflict resolution modal triggering.
     - Settings drawer tabs (Accounts, Worship, System).
   - Register `test:smoke-spec-50` in `package.json`.

**Satisfies:** UC-5, UC-14, FR-20, FR-21, FR-44

**Touches:** sync, operator, admin

**Blocked by:** 03

**Status:** closed

- [x] Implement in-workspace Sync Status badge, atomic aggregate transfer contract, and conflict resolution dialog.
- [x] Implement in-workspace Settings drawer with Accounts, Worship, System, and Diagnostic tabs.
- [x] Establish and verify the complete screen replacement and deprecation matrix with compatibility fallback.
- [x] Create `tests/smoke-spec-50.test.mjs` and register `test:smoke-spec-50` in `package.json`.
- [x] Verify all test assertions pass cleanly.

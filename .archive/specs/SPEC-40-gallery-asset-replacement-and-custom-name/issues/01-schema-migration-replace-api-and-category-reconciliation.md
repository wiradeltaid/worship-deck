# SPEC-40-01 — Schema Migration, In-Place Image Replace API, and Category Reconciliation

**What to build:**
Implement SQLite schema migration adding `name` column to `background_library_images`, migrate legacy `category = 'flyer'` records to `'announcement'`, provide an atomic in-place image asset replacement endpoint strictly preserving record ID and URL slug/path with optimistic concurrency, and extend PATCH/POST endpoints to support custom names and cache revalidation.

**Blocked by:** None (can start immediately)

**Status:** closed

- [x] Database Schema & Migration (`internal/db/schema.sql` and `internal/db/migrate.go`):
  - Add `name TEXT NOT NULL DEFAULT ''` to `background_library_images` table in `schema.sql`.
  - In `migrate.go`, implement `ensureBackgroundLibraryNameColumn(handle)`: check `PRAGMA table_info(background_library_images)` and add `name TEXT NOT NULL DEFAULT ''` if missing.
  - In `migrate.go`, implement idempotent data migration: `UPDATE background_library_images SET category = 'announcement' WHERE category = 'flyer'`.
- [x] Backend Domain Category & Name Parity (`internal/httpapi/background_library.go`):
  - Update `backgroundLibraryImage` struct to include `Name string `json:"name"``.
  - In `listBackgroundLibrary` and `listBackgroundLibraryForOperator`, query and serialize `COALESCE(name, '')`.
  - Transitional category handling: accept `'general'`, `'background'`, `'announcement'`. If legacy `'flyer'` is submitted, normalize it to `'announcement'`. All outgoing `GET` responses strictly emit `'announcement'`, never `'flyer'`.
  - In `createBackgroundLibraryImage`, accept optional `name` field in JSON payload; default strictly to empty string `""` if not supplied.
  - In `patchBackgroundLibraryImage`, allow updating `name` in addition to `category` and `isDefault`. Require `updatedAt` for optimistic locking.
- [x] Atomic In-Place Asset Replacement Endpoint (`internal/httpapi/background_library.go` and `internal/httpapi/uploads.go`):
  - Add handler `POST /api/admin/media-library/{id}/replace` (and alias `POST /api/admin/background-library/{id}/replace`).
  - Require admin session; enforce max upload size 20MB (`r.ParseMultipartForm(20 << 20)`).
  - Optimistic locking: read form field `updatedAt`. Scan existing `updated_at`, `url`, and verify record exists. If `storedUpdated != updatedAt`, return `409 Conflict`.
  - Invariant: The stored `url` and filename are NEVER changed.
  - Atomicity: Write incoming bytes to a temporary file (`tmp_<filename>`) in `uploadsDir()`. Upon successful write and validation, execute atomic rename (`os.Rename`) over the existing target file on disk. If write fails, the existing file remains untouched.
  - Update `updated_at` to current RFC3339 timestamp in `background_library_images`.
  - In `uploads.go` (`getUpload`): replace `Cache-Control: public, max-age=31536000, immutable` with `Cache-Control: no-cache, must-revalidate` and `ETag`/`Last-Modified` headers, guaranteeing that browsers, slideshow views, and PPTX worker immediately revalidate and fetch fresh bytes.
- [x] Unit & Handler Tests:
  - Add unit tests in `internal/httpapi/background_library_test.go` verifying:
    - Custom name persistence on create and patch (defaults to `""`).
    - Category migration and filtering with `'announcement'` (legacy `'flyer'` normalized).
    - In-place image replace preserving identical ID and exact URL path.
    - Concurrency conflict check on replace (`409 Conflict` on stale `updatedAt`).
    - Cache revalidation headers on upload endpoint (`no-cache, must-revalidate`).

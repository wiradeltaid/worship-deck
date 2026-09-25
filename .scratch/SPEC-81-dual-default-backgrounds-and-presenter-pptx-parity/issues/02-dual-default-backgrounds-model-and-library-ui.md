# 02: Dual Default Backgrounds Data Model & Background Library UI (WSD-W2)

**What to build:** In the database schema (`internal/db/schema.sql` and migrations), establish a normalized table `background_default_assignments` with columns `role` (`CHECK (role IN ('song_set', 'general'))`), `background_image_id`, and `updated_at`, using `FOREIGN KEY (background_image_id) REFERENCES background_library_images(id) ON DELETE CASCADE` to honor UC-25 (deleting an image asset from library must never be blocked; resolution gracefully unsets the default role and falls through). Migrate legacy `background_library_images.is_default`: if 1 default exists, seed into both roles; if 0, leave empty; if multiple exist, deterministically choose lowest ID. In `internal/httpapi/background_library.go`, provide endpoint handlers to query and update default assignments for each role (`PUT /api/admin/background-defaults/{role}`, `DELETE /api/admin/background-defaults/{role}`, and include `defaultRoles: string[]` in `listBackgroundLibrary` and `listBackgroundLibraryForOperator`). In `src/components/admin/BackgroundLibraryPanel.tsx`, replace the single "Make Default" button with dual actions (`Set as Song-Set Default` and `Set as General Default`), display badges for assigned roles (`Song-Set Default` and `General Default`), and update confirmation/error toasts. Author automated tests in `tests/background-dual-defaults.test.mjs` verifying schema migration, cascading deletion on asset removal, API contracts, assignment uniqueness per role, and absence guards with defect injection. Wire additively into `package.json` preserving `--test-concurrency=1`. Satisfies `UC-25` and `FR-31`.

**Blocked by:** None (can run in parallel with SPEC-81-01).

**Status:** open

- [ ] Read `internal/db/schema.sql`, `internal/httpapi/background_library.go`, and `src/components/admin/BackgroundLibraryPanel.tsx` first.
- [ ] In `internal/db/schema.sql` and migration scripts:
      - Create table `background_default_assignments (role TEXT PRIMARY KEY, background_image_id INTEGER NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (background_image_id) REFERENCES background_library_images(id) ON DELETE CASCADE)`.
      - Backfill initial rows from `background_library_images WHERE is_default = 1` for both `song_set` and `general` (deterministic lowest ID on multiple).
- [ ] In `internal/httpapi/background_library.go`:
      - Update `listBackgroundLibrary` and `listBackgroundLibraryForOperator` to return `defaultRoles: []string` on each image object.
      - Add handler `putBackgroundDefaultRole(w, r)`: `PUT /api/admin/background-defaults/{role}` body `{ "imageId": number }`.
      - Add handler `deleteBackgroundDefaultRole(w, r)`: `DELETE /api/admin/background-defaults/{role}`.
      - Ensure deleting an image in `deleteBackgroundLibraryImage` cascades cleanly without FK restriction errors.
- [ ] In `src/components/admin/BackgroundLibraryPanel.tsx`:
      - Update `BackgroundImage` interface to include `defaultRoles?: string[]`.
      - Render dual badges: `Song-Set Default` and `General Default`.
      - Render dual action buttons: `Set Song-Set Default` and `Set General Default` with busy spinners and toast notifications.
- [ ] Author `tests/background-dual-defaults.test.mjs`:
      - Verify table migration and backfill.
      - Verify deletion of default image cascades cleanly and unsets default role without error (UC-25).
      - Verify Go API handlers reject invalid roles and enforce single assignment per role.
      - Verify BackgroundLibraryPanel renders both role badges and actions.
      - Include real-file defect injection proofs.
- [ ] Wire `node --import ./tests/register-ts-resolve.mjs --test tests/background-dual-defaults.test.mjs` into `package.json` test script additively preserving `--test-concurrency=1`.
- [ ] Run test suite and `npm run typecheck` to verify 100% green execution.

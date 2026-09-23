# 01: An Admin can delete an uploaded font

**What to build:** Fonts (FR-39) has no DELETE endpoint at all — `internal/httpapi/fonts.go` has only
`listFonts`, `getFont`, `getFontManifest`, and `uploadFont`; `internal/httpapi/server.go`'s route
table registers no `DELETE` for `/api/fonts` or `/api/admin/fonts`. Every other Registry-managed
asset (Background/Media Library) has full CRUD including delete. This is already documented as a
known finding (`.how/registry/02-contracts/06-media-library.md`), confirmed still true by a
2026-09-23 reconciliation pass. Add `DELETE /api/admin/fonts/{id}`, removing both the `font_faces` row
and its uploaded file (`asset_path`) from disk.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Read `internal/httpapi/fonts.go` and `internal/httpapi/background_library.go`'s
      `deleteBackgroundLibraryImage` in full before writing the handler. **Correction from peer
      review: `deleteBackgroundLibraryImage` is NOT a file-cleanup precedent — it records a tombstone
      and deletes the DB row only, with no `os.Remove` of any kind.** There is no existing
      delete-with-file-cleanup convention in this codebase to mirror; this ticket has to define the
      font-specific post-commit unlink sequence from scratch (tombstone + row delete in one
      transaction, commit, then unlink `asset_path` from disk — the ordering, not the precedent, is
      what carries over).
- [ ] `internal/db/schema.sql`'s `font_faces` table has no `updated_at` column, unlike
      `background_library_images` — so this delete has no optimistic-concurrency precondition to
      check the way Background Library's does. Confirm this by reading the schema yourself; do not
      invent an `updated_at` requirement the table can't support, and do not silently add the column
      either — if a concurrency check turns out to be wanted, that is a decision for the ticket to
      raise, not assume.
- [ ] `DELETE /api/admin/fonts/{id}` removes the `font_faces` row and unlinks its `asset_path` file
      from disk (unlink after the database delete commits, using `filepath.Base(asset_path)` under the
      fonts directory the same way `getFont` already resolves it).
- [ ] **The unlink-failure policy must cover more than "file already missing" (confirmed by peer
      review as under-specified).** `os.ErrNotExist` (already-gone file) is fail-open, log and
      continue. A different failure — permission denied, disk I/O error — must not be silently
      swallowed the same way: since the DB row is already gone by this point, a later retry through
      the API can't reach this file again (it 404s). State the policy explicitly: at minimum, log the
      failure distinctly from the already-missing case so an operator can find and clean up the
      orphaned file manually; do not leave a same-as-missing silent continue as the only path.
- [ ] A missing/unknown font id returns `404`, matching every other admin-delete endpoint's
      not-found convention in this codebase.
- [ ] **A live reference genuinely exists and must be resolved as a real policy decision, not left
      open (confirmed by peer review, corrects this ticket's original framing as "confirm whether"):**
      `font_faces` has no foreign key, and templates store `fontFamily`/`pptxTypeface` strings rather
      than a font id, but the app actively fetches `/api/fonts` and registers the returned faces at
      boot and in presenter/projector contexts (`src/lib/registry/font-catalog.ts`, `spa/src/App.tsx`,
      `src/operator/present/PresenterOperator.tsx`, `src/projected/ProjectorClient.tsx`); PPTX import
      also does a family/source-typeface lookup to reconcile a template's font status
      (`internal/httpapi/pptx_import.go`). Deleting a font whose family/source-typeface a template
      still references leaves that template's stored `fontStatus` claiming `"uploaded"` after the face
      no longer hydrates on reload — a real behavior drift, not a hypothetical. Choose and implement
      one: (a) reject the delete (409) when any template payload references the family/source
      typeface, or (b) allow it and reconcile affected templates' `fontStatus` to reflect the fallback.
      State the choice and its test explicitly.
- [ ] Register the new route in `internal/httpapi/server.go` and land it in
      `.how/_platform/inventory-api.md` (this inventory is owned by `wdi-blueprint`, not this ticket —
      report the new row rather than hand-editing that file).
- [ ] `.how/registry/02-contracts/06-media-library.md`'s note that "no delete handler exists for
      fonts" is now stale once this ships — report it as a documentation follow-up rather than editing
      it from inside this ticket.

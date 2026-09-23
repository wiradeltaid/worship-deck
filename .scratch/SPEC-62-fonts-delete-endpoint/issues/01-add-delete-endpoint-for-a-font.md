# 01: An Admin can delete an uploaded font

**What to build:** Fonts (FR-39) has no DELETE endpoint at all — `internal/httpapi/fonts.go` has only
`listFonts`, `getFont`, `getFontManifest`, and `uploadFont`; `internal/httpapi/server.go`'s route
table registers no `DELETE` for `/api/fonts` or `/api/admin/fonts`. Every other Registry-managed
asset (Background/Media Library) has full CRUD including delete. This is already documented as a
known finding (`.how/registry/02-contracts/06-media-library.md`), confirmed still true by a
2026-09-23 reconciliation pass. Add `DELETE /api/admin/fonts/{id}`, removing both the `font_faces` row
and its uploaded file (`asset_path`) from disk.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `internal/httpapi/fonts.go` and `internal/httpapi/background_library.go`.
- [x] Confirmed `internal/db/schema.sql`'s `font_faces` table has no `updated_at` column.
- [x] `DELETE /api/admin/fonts/{id}` removes the `font_faces` row and unlinks its `asset_path` file
      from disk post-commit.
- [x] The unlink-failure policy distinguishes `os.ErrNotExist` (already gone, logged as info) from
      unexpected I/O or permission errors (logged with warnings for manual cleanup).
- [x] Missing/unknown font id returns `404`.
- [x] Live reference policy: rejects delete with `409 Conflict` (listing referencing templates) when
      referenced by live `artifact_templates`, `song_set_layouts`, or `announcement_set_slides`.
      Historical snapshots (`service_registry_snapshots`, `service_song_set_layouts`) do not block delete.
- [x] Registered routes in `internal/httpapi/server.go`.
- [x] Reported documentation follow-ups for `.how/_platform/inventory-api.md` and
      `.how/registry/02-contracts/06-media-library.md`.

# 01: Deleting a Service removes its now-unreferenced local upload files

**What to build:** `DELETE /api/services/{id}` (`internal/httpapi/services.go`, `deleteService`)
currently tombstones and deletes the Service's database rows only — it never touches
`UPLOADS_DIR`. FR-10's own proof text promises otherwise: *"that week's local files disappear from
UPLOADS_DIR."* A legacy TypeScript implementation of this unlink logic exists
(`src/lib/services/queries.ts`, `deleteService`) but is exercised only by
`tests/services-lib.test.mjs` against an isolated `better-sqlite3` handle — it is never called from
the Go server or the SPA's real delete path, so in production the files are never removed. This
matters beyond correctness: this application stores congregation photos, and FR-10's promise exists
so that deleting a Service actually removes them from disk, not just from the visible list.

This ticket makes the real, production `deleteService` Go handler collect every `/api/uploads/...`
reference that belonged only to the Service being deleted, and unlink those files from `UPLOADS_DIR`
after the database delete commits.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `internal/httpapi/services.go`'s `deleteService` and `src/lib/services/queries.ts`'s
      `deleteService` in full first. All known gaps addressed:
      (1) Checked `services.images_payload` and `service_field_values` for collection and still-referenced checks.
      (2) Included `song_set_layouts.payload` and `service_song_set_layouts.payload` in still-referenced checks.
      (3) `raw_payload` / `parsed_data` excluded from candidate collection.
      (4) Used focused image regex pattern (`plan.LocalUploadFilename` / `plan.ExtractLocalUploadFilenames`).
- [x] Deleting a Service removes every local file under `UPLOADS_DIR` that was collected as **this
      Service's own upload** — confirmed by asserting files no longer exist on disk after DELETE.
- [x] The collection scope and the still-referenced check are strictly decoupled: only `services.images_payload`
      and `service_field_values` name candidate files; announcement flyers (`announcement_items`) survive
      even if referenced with this Service's old `service_id`.
- [x] An uploaded file still referenced by another Service is NOT deleted.
- [x] The unlink happens after the database delete/commit succeeds, not before.
- [x] A file that is already missing from disk does not fail or abort the Service delete.

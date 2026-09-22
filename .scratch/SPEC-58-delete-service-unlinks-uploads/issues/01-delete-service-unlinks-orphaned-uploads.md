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

**Status:** ready-for-agent

- [ ] Read `internal/httpapi/services.go`'s `deleteService` (around lines 627-709) and
      `src/lib/services/queries.ts`'s `deleteService` in full first — the TypeScript version already
      encodes the intended file-collection logic (which columns/tables hold upload refs, how "no
      longer referenced" is determined); port its logic rather than re-deriving it from scratch, and
      state explicitly if the TypeScript version's approach turns out to be wrong or incomplete.
      **Known gap in the TS reference (confirmed by peer review, port the fix, not just the bug):**
      it checks `services.images_payload`, `announcement_items.image_url`, `artifact_templates.payload`,
      `announcement_set_slides.payload`, and `background_library_images.url` for "still referenced",
      but never `service_field_values` — a table `internal/httpapi/services.go` (~line 344-373) writes
      upload URLs into directly, under variable names like `sermon_poster`, `family_photo`,
      `youth_photo`, independent of `images_payload`. A verbatim port would under-collect the deleted
      Service's own uploads stored this way, and could wrongly delete a file another Service still
      references only through its own `service_field_values` row. The collection and the
      still-referenced check must both cover `service_field_values` too.
- [ ] Deleting a Service removes every local file under `UPLOADS_DIR` that was collected as **this
      Service's own upload** — meaning it came from that Service's own `images_payload` or
      `service_field_values` rows — and is not still referenced anywhere else. Confirmed by asserting
      the file no longer exists on disk after the DELETE request completes.
- [ ] **The collection scope and the still-referenced check are two different things — do not conflate
      them (confirmed by a second peer-review round).** Only `services.images_payload` and
      `service_field_values` name what belongs to *this* Service and is therefore a *candidate* for
      deletion. `announcement_items.image_url`, `artifact_templates.payload`,
      `announcement_set_slides.payload`, and `background_library_images.url` are read only to check
      whether a candidate file is *still referenced elsewhere* before deleting it — they must never be
      added to the collection step itself. This matters concretely for `announcement_items`: its
      `service_id` column survives Service deletion on purpose (the FK to `services` was deliberately
      dropped in `internal/db/migrate_announcement_items_cascade.go` specifically so this Registry-owned
      content keeps working after the Service that referenced it is gone) — an announcement flyer must
      never be deleted by this ticket's logic, regardless of what else does or doesn't reference it,
      because it is never this Service's own upload to begin with. FR-10's proof text is explicit that
      the Artifact Registry's assets "remain untouched." State a test for this exact case: a Service
      deleted while an `announcement_items` row (with that Service's old `service_id`) still points at
      an uploaded image — the image must survive.
- [ ] An uploaded file still referenced by another Service (via its own `images_payload` or
      `service_field_values`) is NOT deleted.
- [ ] The unlink happens after the database delete/commit succeeds, not before — a failed delete must
      not leave the Service's row gone but its files also gone (or vice versa in a way that orphans
      files silently).
- [ ] A file that is already missing from disk (already deleted, moved, or never actually written)
      does not fail or abort the Service delete — log and continue, the same fail-open posture the
      Go handler already uses elsewhere in this codebase for non-critical cleanup steps.

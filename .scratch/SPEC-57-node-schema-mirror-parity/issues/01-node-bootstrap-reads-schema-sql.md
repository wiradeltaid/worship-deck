# 01: The Node database bootstrap reads its schema from the Go schema file

**What to build:** Today, running `npm run setup`, `npm run seed:demo`, or the Node test suite
creates a SQLite database from a hand-written set of `CREATE TABLE` statements that lives
separately from the Go API's own schema, and the two have already drifted twice (missing tables,
missing columns on shared tables). After this ticket, the Node side executes the Go schema file's
own text to create its tables — there is exactly one place a table or column is declared, and the
Node-bootstrapped database always has everything the real, deployed application has.

**Blocked by:** None (can start immediately).

**Status:** closed

**Inventory notes:**
- `song_set_entries.extraction_regex`: Class (a) finding — Go's `internal/db/form_layout.go` adds this column dynamically on boot (`ALTER TABLE song_set_entries ADD COLUMN extraction_regex TEXT`), but it was never backfilled into `internal/db/schema.sql` itself. Handled as an explicit allowed extra column in the schema parity guard test.
- All other historic Node schema migrations (`images_payload`, `participants_payload`, `afternoon_program`, `updated_at`, `token_version`, `category`, `name`, `seed_hash`, `position`, `registry_snapshot_at`, `(book_code, number)` on hymns, `translation_code` on bible_verses, `variable_name` and `ann_set_id` on artifact_templates) are already represented in `internal/db/schema.sql`.

- [x] The inventory above exists naming every Node-side post-creation schema change found.
- [x] `npm run setup` still completes successfully and produces a working database, unchanged from
      the outside.
- [x] `npm run seed:demo` still completes successfully against the new bootstrap.
- [x] An existing, already-created Node database (not just a fresh one) is upgraded to the full
      shape too: added `ALTER TABLE ... ADD COLUMN global_id TEXT` on `services`, `hymns`,
      `announcement_items`, `song_set_entries`, and `background_library_images`, plus `variable_name`
      and `ann_set_id` on `service_registry_snapshots`.
- [x] The full existing Node test suite passes with no changes to any test file.
- [x] A freshly bootstrapped Node database contains every table the Go schema file declares,
      including the three that were missing before this ticket (`font_faces`, `sync_tombstones`,
      and `sync_state`), and every column on tables the two sides already shared.
- [x] Whatever Node-only tooling logic ran *after* table creation before this ticket still runs at
      the same point and produces the same result.
- [x] Confirmed all statements in `internal/db/schema.sql` are valid SQLite syntax for `better-sqlite3`.

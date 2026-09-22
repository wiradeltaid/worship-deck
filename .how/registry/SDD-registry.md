---
type: sdd
component: registry
status: draft
created: 2026-08-18
updated: 2026-09-22
realizes: [UC-14, UC-15, UC-16, UC-20, UC-24, UC-25, UC-32]
binds: [AD-5, AD-6, AD-7, AD-8, AD-9, AD-11, AD-12, AD-13, AD-14, AD-15, AD-16, AD-17, AD-18, AD-19, AD-20, AD-21, AD-30, AD-31, AD-32, AD-33, AD-34, AD-35, AD-36, AD-38]
reviewed:
  date: '2026-09-22'
  sha: '75d990b26447e6024df9d00bc432f193502030a3'
  lenses: [structure, prose, edge-case-hunter]
  note: 'Re-review of the delta since 6281284: G4 depth backfilled for SPEC-32/39/40/47''s Registry-owned surface (Fonts, Media Library, Manual Sync''s asset half), none of which had ever been given its own FR, UC, or SDD depth. Widened LC-11/LC-15''s Structure rows rather than minting new LCs, matching this component''s own stated "wider surface, not a new LC" precedent — checked against that precedent''s own wording before applying it, since Hub''s parallel backfill went the other way for a documented reason (no equivalent wide gateway there). Added one Failure Behaviour row per new resource group, and wrote UC-32''s full flow (critical: true, mode: deep requires one for every critical UC). Edge-case-hunter re-verified the deletion-fonts gap (no DELETE handler exists for fonts — a real, reported asymmetry, not fixed here) and the 50 MB-vs-unbounded size-limit inconsistency between the two Manual Sync contract halves. Zero findings beyond what is already reported as findings in the contracts themselves.'
---

# SDD — Registry

As-built baseline: global live templates in SQLite plus a per-Service freeze
(`service_registry_snapshots`, AD-16). **The DEC-004 nested shape on top of that baseline is
built.** This document designed it first and is now an **as-built record** for that half: waves
W3 and W4 shipped it, and the Evidence table below marks those claims `verified` against the
files that prove them. Rows that still read `[ASSUMED]` or `[PARTIAL]` are the only ones where
this is still a design. An earlier revision of this paragraph said none of it was built, which
contradicted its own Evidence table from 2026-08-21 onward.

## Decision Summary · [outline]

Registry is `/admin/artifacts` plus its API. The main spine stays one ordered list, but a spine
row is now one of exactly two server-owned kinds — `general` or a **Song Set entry** — plus an
`ann-set` marker splicing in an Admin-authored **Announcement Set** (its own ordered list of
Generals, held in its own tables). Every Song Set entry, however many Admin has defined, shares
one canvas trio (Title/Verse/Reff) that lives **outside** the spine, in its own singleton table.
Like every other registry structure, the trio is **frozen into the per-service snapshot at Service
creation** (AD-16, reversed 2026-08-20 from an earlier live-read design — see below); it is not
read live at render time.
Two more Admin-maintained collections join the component: a **Background Library** (images only,
one global default) and a **Song Book** list (one global default), both referenced by weekly/live
choices elsewhere but owned and CRUD'd here. A Predefined Field is now a `{key}` token mixed into
a text element's own content — the closed catalog vocabulary is still a code list (AD-19), not a
table, and an unrecognised token never blocks generation (BR-13); it is flagged only when the
slide is saved.

Two surfaces, unchanged: this component does not take weekly hymn numbers, Song Book choices,
backgrounds, lyric corrections, or live background switches — those are Hub/Presenter (FR-32,
FR-33, FR-34). Announcement composition lives only here now (FR-3 retired, DEC-004); the old
Hub-owned live master list (CAP-7 as-built) is retired by AD-35.

**Physical-shape decision (left open at G3, closed here):** own tables per new concept, not one
overloaded discriminator row. `artifact_templates` keeps carrying the main spine (`general` /
`song-set-entry` / `ann-set-marker`); the shared Title/Verse/Reff trio, an Announcement Set's own
slide list, the Background Library, and the Song Book list each get a dedicated table. Reasoning:
the shared trio is not spine-ordered at all (one Title/Verse/Reff exists no matter how many
entries reference it) and an Announcement Set's slides are ordered *within that set*, not within
the spine — folding either into `artifact_templates`'s single `position` column would make
`position` mean two different things depending on a row's kind, which is exactly the ambiguity
AD-15's stable-id discipline exists to prevent. One overloaded table also cannot express
"exactly 3 rows, never more" for the trio without an application-level rule doing the work a
schema could do for free.

Expensive choices carried forward and one added: seed is bootstrap + Reset only (AD-17); a
deleted row (any of the five tables below) is not revived by restart or Reset (OQ-24). **New:**
Song Set `variable_name` uniqueness and Announcement Set / marker referential integrity are
enforced on the write path in code, never by a DB `UNIQUE`/`FOREIGN KEY` constraint — the same
discipline AD-19 already set for slot identity, extended by AD-31 to the new shape.

Screens (`inventory-screen` row 7) are not an `LC` `ui-screen`: that is a `wdi-ux` slot, skipped.

## Structure · [outline]

| LC | type | Responsibility |
| --- | --- | --- |
| LC-11 | gateway | GET/PUT/DELETE artifacts, POST reset, PUT order (as-built) **+** CRUD for Song Set entries, Announcement Sets and their slides, Background Library, Song Books (new — same gateway, wider surface, not a new `LC`) **+** Media Library, Fonts, and the asset half of Manual Device Sync (2026-09-22 backfill — same reasoning: same trust boundary, same Admin caller, one more resource family each, not a new `LC`) |
| LC-15 | service | SQLite store + AD-15 validation + snapshot clone (as-built) **+** the five new tables' store logic, `variable_name`/referential checks, migration runner (new — same service, wider surface) **+** the media/font store and content-addressed asset store (2026-09-22 backfill) |

Direction unchanged: Admin screen → LC-11 → LC-15 → SQLite. Hub/Presenter render through LC-16
(Slide plan builder), not this API. No new `LC` is registered by this design: every new HTTP
surface below is one more resource family under the existing Registry gateway (LC-11), and every
new table is one more responsibility of the existing Registry store (LC-15) — same trust boundary,
same container (`api`), same caller. Registration of any new endpoint row belongs to
`.how/_platform/inventory-api.md` / `inventory-screen.md`, owned by `wdi-blueprint`; this SDD
does not write there. Those rows were landed by that skill on 2026-08-22 (commit `0b24d5e`);
registry now owns platform rows 25–28, 31–32 and 37–69. This sentence previously pointed at a
"Drift" section that does not exist in this document.

**2026-09-22 backfill note:** Fonts (SPEC-32), Media Library (SPEC-39/40), and Manual Device Sync's
asset half (SPEC-47) all shipped under this same "wider surface, not a new `LC`" reasoning without
it ever being written down for them specifically — `wdi-reconcile` found the gap while backfilling
FR-38/FR-39/FR-40 and their UCs. Manual Device Sync's **mutation** half (Services, Song Set entries,
etc.) is Hub's own `LC-23`, a genuinely new gateway there — Hub has no equivalent "one wide admin
gateway" LC to widen the way Registry's LC-11 already is one.

## Inherited Constraints · [guarded]

| AD | How it lands here |
| --- | --- |
| AD-5 | Every new path below (`/api/admin/song-set-entries*`, `/api/admin/announcement-sets*`, `/api/admin/background-library*`, `/api/admin/song-books*`) sits inside the matcher beside `/api/admin/artifacts*` (AD-14). No new exclusion is added. |
| AD-6 | Every new write (create/rename/delete/reorder/reset) on every new table carries `updatedAt` the same way `artifact_templates` already does. |
| AD-7 | Registry supplies spine entries, the trio, Announcement Set slides, and the two libraries; the plan (Hub LC-16) orders and hydrates. |
| AD-8 | Background Library entries and every canvas image element (Main, trio, Announcement Set) resolve through the same helpers — no new image path. |
| AD-9 | The five new tables and the migration below ship as startup DDL, not a hand-run script. |
| AD-11 | All new tables live in the same file. |
| AD-12 | Unchanged — plan only. |
| AD-13 | Unchanged for every canvas surface, including the trio and Announcement Set slides. |
| AD-14 | Unchanged; Admin-only UI for every new surface too. |
| AD-15 | Validated on every write, on every canvas-bearing table (trio rows, Announcement Set slides), exactly as `artifact_templates` today. |
| AD-16 | Superseded in part by AD-35 for Announcement Sets specifically (below); the general clone-on-create / Sync-only-replace rule is otherwise unchanged and now also clones the referenced Announcement Sets **and the Title/Verse/Reff trio** into the same per-service snapshot (`service_registry_snapshots`) at creation time — **reversed 2026-08-20 (owner ruling): the trio is frozen, not read live.** An earlier draft of this design left the trio unversioned and always-live, resolved fresh at every plan build; the owner ruled freezing is better, so it now joins everything else AD-16 already clones. A live registry edit reaches an existing service's trio only through the same explicit **Sync Artifact** action as every other cloned structure — never automatically. |
| AD-17 | Bootstrap seeds the default four Song Set entries, the Title/Verse/Reff trio, and the two seed Announcement Sets (DEC-004 reference deck) once; delete on any of them stays deleted. **The `song_books` registry row is under the same rule** (DEC-004 S14, DEC-005/AD-36: "the hymn content rows and the `song_books` registry row" alike, "never re-read from the file on a later boot"). A fresh install writes it inside `upsertHymns`' bootstrap-once transaction; an existing install is repaired **once** by migration 10→11. **A boot-time reconcile is forbidden here** — an every-boot seed shipped on 2026-08-22 and resurrected a book an Admin had deliberately deleted through `DELETE /api/admin/song-books/[bookCode]` (row 55), which is exactly the resurrection AD-17 and AD-36 forbid; it was replaced by the two paths above the same day. This landing previously named only the four entries, the trio and the two sets, and that omission is how the defect was written. |
| AD-18 | Numbered migrations, never reseeds. This design's own two ran first: the Song Set physical-shape change (AD-31/AD-33) — `06-flows/song-set-physical-shape-migration.md`, `data_version` 3→4 — then the Predefined Field key rename/split (S1) — `06-flows/predefined-field-migration.md`, 4→5. The chain has since reached **11**: 8→9 added AD-26's `song_books` metadata columns (`internal/db/migrate_song_book_metadata.go`), 9→10 retired the `announcement_items` cascade (`internal/db/migrate_announcement_items_cascade.go`), and 10→11 repairs an existing install's missing `song_books` registry row exactly once (`internal/db/migrate_song_book_row.go`, mirrored in `src/lib/db/index.ts`). |
| AD-19 | Superseded in part by AD-31 for the Song Set/Announcement identities specifically (below); `general`'s closed, non-editable treatment is untouched, and the Predefined Field Catalog's own closed vocabulary is untouched (AD-32). |
| AD-20 | Unchanged; the trio and Announcement Set slides are still registry-originated, just not on the spine's own `position` axis. |
| AD-21 | `data_version` gates the predefined-field migration exactly once. |
| AD-30 | LC-11 / LC-15 on `api`, unchanged; every new surface is more API surface, not a new process. |
| AD-31 | `variable_name` uniqueness check lives in LC-15, run on create and rename; no `UNIQUE` column constraint. Marker→set reference checked the same way, in code. |
| AD-32 | Validator (`src/lib/registry/validate.ts`) parses `{key}` inside text-element `content`, checks membership in the renamed catalog (S1), and returns a save-time warning list rather than a rejection for an unrecognised key. Hydrate substitution itself is Hub LC-16's job; Registry validates and stores. |
| AD-33 | `song_set_layouts` table (3 rows: `title`/`verse`/`reff`), each validated and Reset exactly like a General (AD-15); no bounded-surface override record survives. Announcement Set slides live in `announcement_set_slides`, one row per slide, validated the same way. |
| AD-34 | Registry owns and serves the Background Library table and its default flag (UC-25); the live switch itself (UC-27) is a Presenter-owned session action over AD-10's channel and never calls into this component's write path. |
| AD-35 | Service creation / Sync (Hub LC-2) calls into LC-15's clone routine, which now also walks every referenced `ann_set_id` and clones its `announcement_set_slides` rows into the snapshot tables (below), not just the spine. |
| AD-36 | Registry owns the `SongBook` entity, so this AD binds here even though `hymns` is Hub's. The bootstrap-once write and the 10→11 repair migration are named under AD-17 above. Its *Extended* clause (OQ-38, OQ-39 closed) is what makes `POST /api/admin/song-books` (row 58) legitimate at all — an Admin may create a book with no corpus file, supplying all five AD-26 fields; `05-song-books.md` carries the collision and marker-granularity cases. Whether an Admin may **delete** a book is a promise nobody wrote: **OQ-48**. |
| AD-38 | Main Spine composition, canvas authoring, and the Song Set / Announcement Set workspaces are this component's `ArtifactEditor.tsx` and canvas engine (LC-15). Fixed `spine_position` fields are retired: multiple insertions of the same Song Set or Announcement Set each generate their own spine node (`artifact_templates` row), reordered directly in place. |

AD-1, AD-2, AD-4, AD-10, AD-24 are not listed here (OQ-30): they bind the container / chrome, not
Registry rows.

## Failure Behaviour · [guarded]

Boundaries = the rows `.how/_platform/inventory-api.md` attributes to `registry` — originally 38
(25–28, 31–32, 37–69), plus 16 more landed 2026-09-22 (75–78, 86–90, 101–104, 106–108: Fonts, Media
Library, and Manual Device Sync's asset half). Every family below now carries a platform number:
`wdi-blueprint` refreshed the three inventories from code on 2026-08-22 (commit `0b24d5e`) and again
on 2026-09-22, which retired this section's earlier claim that "none has a platform inventory row
yet". Process timeout: Go API. Registry does not retry to the client; Admin presses again.

Three Operator-facing reads are **not** covered below — `GET /api/song-books` (68),
`GET /api/background-library` (66) and `GET /api/song-set-entries` (69). They became registry-owned
in the same refresh and their failure behaviour is unwritten: **OQ-49**.

As-built rows, restored here rather than left to this file's git history — a section a reader cannot
read is not a section:

| Boundary | Slow | Absent | Lying | What the user sees | What is logged |
| --- | --- | --- | --- | --- | --- |
| GET `/api/admin/artifacts` (25) | List fetch until browser timeout | 403 | A corrupt row still appears as a label rather than breaking the list | Ordered spine with each row's label and kind | console.error on 500 |
| GET `/api/admin/artifacts/[id]` (26) | Fetch until browser timeout | 403; missing or gone → 404 | Invalid stored layout surfaces at save, not at read | The canvas as stored | console.error on 500 |
| PUT `/api/admin/artifacts/[id]` (27) | Save until browser timeout | 403; missing → 404 | Invalid layout (AD-15) → 400; stale `updatedAt` → 409 | Layout saved, or a stale-write message with a re-read | console.error on 500 |
| POST `/api/admin/artifacts/[id]/reset` (28) | Reset until browser timeout | 403; gone id → 404 **before** any seed lookup, so Reset never undeletes (OQ-24) | Stale `updatedAt` → 409 | Row returns to its shipped seed, label included (OQ-15) | console.error on 500 |
| DELETE `/api/admin/artifacts/[id]` (31) | Delete until browser timeout | 403; missing → 404 | Stale `updatedAt` → 409 | Row gone, and gone survives restart (SCN-5); `position` compacted to `0..N-1` in the same transaction (OQ-31) | console.error on 500 |
| PUT `/api/admin/artifacts/order` (32) | Reorder until browser timeout | 403 | An id not in the live list → 400; stale `updatedAt` → 409 | New order, dense positions | console.error on 500 |
| POST `/api/admin/artifacts` (37) | Create until browser timeout | 403; empty label → 400 | — | Authored General appended; it exposes no Reset, `seed_hash` being NULL (OQ-15) | console.error on 500 |
| PATCH `/api/admin/artifacts/[id]` (38) | Rename until browser timeout | 403; missing → 404 | Stale `updatedAt` → 409 | Label updates; the stable id never does (AD-15) | console.error on 500 |

New surfaces:

| Boundary (proposed path) | Slow | Absent | Lying | What the user sees | What is logged |
| --- | --- | --- | --- | --- | --- |
| GET `/api/admin/song-set-entries` | List fetch until browser timeout | 403 | Corrupt row still appears as a label, same discipline as artifacts | Every entry's `variable_name` + title | console.error on 500 |
| POST `/api/admin/song-set-entries` | Create until browser timeout | 403; empty `variable_name`/title → 400 | Duplicate `variable_name` on a live entry → 409 (AD-31, checked in code) | New entry appended to the spine | console.error on 500 |
| PATCH `/api/admin/song-set-entries/[variable_name]` | Rename until browser timeout | 403; missing → 404 | Stale `updatedAt` → 409 | Title updates; `variable_name` immutable (PATCH cannot change it) | console.error on 500 |
| DELETE `/api/admin/song-set-entries/[variable_name]` | Delete until browser timeout | 403; missing → 404 | Stale `updatedAt` → 409 | Entry removed from spine; Hub's weekly values for that name stay stored, inert | console.error on 500 |
| GET/PUT `/api/admin/song-set-layouts/[role]` (`role` = title\|verse\|reff) | Fetch/save until browser timeout | 403; unknown role → 404 | Invalid layout (AD-15) → 400; stale `updatedAt` → 409 | Shared trio edit reflected for every **new** Service created after the save, and for any **existing** Service only after an explicit Sync Artifact (AD-16, reversed 2026-08-20 — frozen, not live) | console.error on 500 |
| POST `/api/admin/song-set-layouts/[role]/reset` | Reset until browser timeout | 403; unknown role → 404 | Stale `updatedAt` → 409 | Layout returns to seed; same Reset semantics as a General (AD-33 retires the old override record) | console.error on 500 |
| GET `/api/admin/announcement-sets` | List fetch until browser timeout | 403 | Corrupt slide still appears as a label within its set | Sets and their slide counts | console.error on 500 |
| POST `/api/admin/announcement-sets` | Create until browser timeout | 403; empty label → 400 | — | New empty set; a marker is added separately (UC-15/UC-24-style add on the spine) | console.error on 500 |
| DELETE `/api/admin/announcement-sets/[id]` | Delete until browser timeout | 403; missing → 404; still referenced by a live marker → 409 | Stale `updatedAt` → 409 | Set removed only when no live marker points at it | console.error on 500 |
| PATCH `/api/admin/announcement-sets/[id]` (48) | Rename until browser timeout | 403; missing → 404 | Stale `updatedAt` → 409 | Set label updates; its id and its markers are untouched | console.error on 500 |
| GET/POST/PUT/PATCH/DELETE `/api/admin/announcement-sets/[id]/slides*` (39–46) | Same shape as `/api/admin/artifacts*` (§ as-built), scoped to one set | 403; missing set/slide → 404 | Same validation/version conflicts as a General | Same as editing any General, scoped to that set's own ordered list | console.error on 500 |
| PUT `/api/admin/announcement-sets/[id]/slides/order` (44) | Reorder until browser timeout | 403; missing set → 404 | A slide id outside this set → 400; stale `updatedAt` → 409 | New order **within that set only**; the spine's own order is untouched | console.error on 500 |
| POST `/api/admin/announcement-sets/[id]/slides/[slideId]/reset` (39) | Reset until browser timeout | 403; missing set/slide → 404 | Stale `updatedAt` → 409 | Slide returns to its shipped seed; a gone slide is 404 and is not undeleted (OQ-24) | console.error on 500 |
| GET `/api/admin/background-library` | List fetch until browser timeout | 403 | — | Image list + which one is default | console.error on 500 |
| POST `/api/admin/background-library` | Upload/add until browser timeout | 403; non-image (AD-8) → 400 | — | New image appended | console.error on 500 |
| PATCH `/api/admin/background-library/[id]` (set default) | Save until browser timeout | 403; missing → 404 | Stale `updatedAt` → 409 | Exactly one image is default | console.error on 500 |
| DELETE `/api/admin/background-library/[id]` | Delete until browser timeout | 403; missing → 404 | Stale `updatedAt` → 409 | Any weekly/live reference to it falls through to blank (AD-33/AD-34); binary itself untouched (share-by-reference discipline extends to this library) | console.error on 500 |
| GET `/api/admin/song-books` | List fetch until browser timeout | 403 | — | Books + which one is default | console.error on 500 |
| POST `/api/admin/song-books` | Add until browser timeout | 403; empty `book_code`/name → 400 | Duplicate `book_code` → 409 | New book appended | console.error on 500 |
| PATCH `/api/admin/song-books/[book_code]` (rename / set default) | Save until browser timeout | 403; missing → 404 | Stale `updatedAt` → 409 | Name or default flag updates | console.error on 500 |
| DELETE `/api/admin/song-books/[book_code]` | Delete until browser timeout | 403; missing → 404 | In use by a hymn row (`hymns.book_code`, S3) → 409, do not orphan hymn rows | Book removed only when no hymn references it | console.error on 500 |
| `/api/admin/media-library*`, `/api/media-library`, `/api/admin/fonts`, `/api/admin/artifacts/fonts`, `/api/fonts*` (`06-media-library.md`) | Upload/list until browser timeout | 403 on admin routes; 404 unknown media/font id | Non-image body → 400; font extension other than `.ttf`/`.otf` → 400 with the exact message named in the contract | Media list or font list updates; a rejected upload leaves the prior list unchanged | console.error on 500 |
| `/api/sync/assets/check`, `/api/sync/assets/upload`, `/api/sync/assets/[sha256]` (`07-manual-sync.md`) | Upload/download until browser timeout, or until the 50 MB body cap refuses it outright | 403 non-Admin; 404 unknown hash on download | A malformed hash in a `check` request is silently skipped, not reported — the caller cannot distinguish "not asked for" from "not found" from the response alone | Admin Sync screen's push/pull progress; a refused oversized upload | console.error on 500; the 50 MB cap refuses before any handler code runs |

Plan read (Hub LC-16, `loadRegistrySnapshot` or the service freeze): a corrupt row in any of the
new tables is omitted from the Deck and logged with id + reason, same as today (AD-17) — never
silently re-seeded. An unrecognised `{key}` token (AD-32, BR-13) is not a failure at generate time
at all: it renders empty and the Deck still completes; the editor's save-time flag is the only
place it is visible before then. Sync Artifact (UC-16) remains Hub's route; it now also clones
every referenced Announcement Set's slides (AD-35). Do not invent a Registry Sync route.

## Robustness Analysis · [deep]

**ABCE pass** (Boundary → Control → Entity → Behaviour), new for this revision:

| Object | Kind | Realizes | Notes |
| --- | --- | --- | --- |
| `/admin/artifacts` (extended) | Boundary (screen) | UC-14, UC-15, UC-24, UC-25 | One screen gains song-set-entry, background-library, and song-book panels; `01-ux/` is `wdi-ux`'s slot, skipped here |
| `/api/admin/song-set-entries*` | Boundary (gateway, LC-11) | UC-24 | — |
| `/api/admin/song-set-layouts/[role]*` | Boundary (gateway, LC-11) | UC-14 | — |
| `/api/admin/announcement-sets*` | Boundary (gateway, LC-11) | UC-15, UC-24-style add/remove | — |
| `/api/admin/background-library*` | Boundary (gateway, LC-11) | UC-25 | — |
| `/api/admin/song-books*` | Boundary (gateway, LC-11) | UC-25 (S3 extends its scope) | S3 names Song Book selection as part of registry's admin surface |
| Registry store (LC-15, extended) | Control | All of the above | Validation, uniqueness, referential checks, snapshot clone, migration runner |
| `SongSetEntry` | Entity | UC-24 | `variable_name` identity (AD-31) |
| `SongSetLayoutTrio` (title/verse/reff rows) | Entity | UC-14 | Singleton set of 3, shared (AD-33); the live table Admin edits — a Service reads its own frozen copy in `service_registry_snapshots`, never this table directly (AD-16, reversed 2026-08-20) |
| `AnnouncementSet` / `AnnouncementSetSlide` | Entity | UC-15 | 0..N sets, each its own ordered slide list (AD-33, BR-12) |
| `BackgroundLibraryImage` | Entity | UC-25 | Images only (S10), one default |
| `SongBook` | Entity | UC-25 (S3) | One default, referenced by `hymns.book_code` |
| Deck hydrate (Hub LC-16) | Behaviour | UC-20 | Reads the Service's frozen snapshot (spine, trio, referenced Announcement Sets — AD-16), plus the always-live Background Library and Song Book lookups; substitutes tokens; resolves background order (AD-33/34); never writes back |

| UC | Boundary in | Control | Entity | Boundary out |
| --- | --- | --- | --- | --- |
| UC-15 | `/admin/artifacts` + LC-11 | LC-15 | ArtifactTemplate, AnnouncementSet, AnnouncementSetSlide | ordered list; gone survives boot |
| UC-24 | `/admin/artifacts` (song-set panel) + LC-11 | LC-15 | SongSetEntry | spine gains/loses an entry; Hub form (FR-32) reflects it without a deploy |
| UC-25 | `/admin/artifacts` (library panels) + LC-11 | LC-15 | BackgroundLibraryImage, SongBook | weekly/live surfaces resolve through the new default |

UC-14 and UC-16 are not `critical`. UC-20 is Operator-facing plan consume (Hub/Presenter);
Registry supplies entries only (AD-7, AD-12). UC-16 is a Hub surface; do not invent a Registry
Sync route. Delete flow: `06-flows/delete-template.md`. New flows: `06-flows/copy-paste-share-by-reference.md`,
`06-flows/predefined-field-migration.md`, `06-flows/song-set-physical-shape-migration.md`. `01-ux/`
canvas belongs to `wdi-ux` (skipped).

## Evidence

| Claim | Label | Read to decide | Disposition |
| --- | --- | --- | --- |
| `artifact_templates` table exists | verified | `src/lib/db/index.ts` | — |
| Per-Service snapshot table | verified | `service_registry_snapshots`; clone in `src/lib/registry/service-snapshot.ts` | W1 / AD-16 |
| `song_set_layouts`, `announcement_sets`, `announcement_set_slides`, `background_library_images`, `song_books` tables | verified | `internal/db/schema.sql` (all five present); migrations `internal/db/migrate_song_book_metadata.go` (8→9) and `internal/db/migrate_announcement_items_cascade.go` (9→10) | **Corrected 2026-08-21.** This row read `[MISSING]` — "none exist yet" — which was true when the design was written and false once W3/W4 shipped. Kept rather than deleted per the evidence ladder: the sentence is the only record that the design once predicted them. `data_version` is now 11 |
| Song Set is a singular `base_type: 'song-set'` today (the `songset-*` per-slot extension the code comments anticipate was never built), and the shipped seed carries **five** such rows, not four — the fifth (`id: "song-set"`) drives Hub's `case "song-set":` loop over `c.dsMiddle`, not a fixed slot | verified | `src/lib/registry/types.ts:2-29` (`ARTIFACT_BASE_TYPES`, `kindOf`); `data/default-registry.json` (5 `base_type: "song-set"` rows, positions 4/9/15/20/25); `internal/plan/plan.go:354-359` | AD-31 retires this; migration designed in full — `06-flows/song-set-physical-shape-migration.md` |
| Predefined Field is a whole-element `placeholderKey` binding today | verified | `src/lib/registry/placeholder-catalog.ts:15-28` | AD-32 retires this; `06-flows/predefined-field-migration.md` |
| `hymns.book_code` is the lookup key: every hymn resolves on the pair `(book_code, number)` | verified | one resolver with a documented fallback (weekly `song_set_inputs.song_book_code` → the global default in `song_books` → the shipped constant); `internal/plan/snapshot.go` JOIN, `internal/httpapi/hymns.go`, `src/lib/lyrics.ts` | **Corrected 2026-08-21.** Previously "exists but nothing reads it". The number-only JOIN meant two installed books answered for each other |
| `song_books` selection table exists, with `locale`, `licence` and `provenance` | verified | `internal/db/schema.sql`; AD-26 metadata columns added by migration 8→9 | **Corrected 2026-08-21.** Previously "No `song_books` selection table exists". The handler validated `locale` and discarded it until the columns landed — that gap is closed |
| Announcement composition is Registry-owned; Hub owns none of it | verified | the five `/api/announcements` routes and their handler are deleted; `src/lib/announcements.ts` keeps only URL hardening, still used by `src/lib/slide-plan.ts` | **Corrected 2026-08-21.** Previously "a Hub-owned live list today". `announcement_items` is deliberately **not** dropped and no longer cascades from a Service delete (migration 9→10); the webhook still accepts `announcements[]` and ignores it (OQ-42) |
| Sync Artifact HTTP route | verified | `internal/httpapi` | Hub surface; not a Registry inventory row |
| Reset on a gone id does not revive | verified | `internal/httpapi` returns 404 before seed lookup | OQ-24; same discipline extends to every new table |
| `RegistrySnapshot` in code is the live map, not the AD-16 freeze | [PARTIAL] | `src/lib/artifacts/registry-snapshot.ts` | do not mix the names |
| `zIndex` is persisted only on a real reorder of existing elements | verified | `src/lib/registry/canvas-utils.ts` (`isOrderModified` is `hasReorderedExisting \|\| hasReorderedAdded`); guards AC-06 and AC-07 in `tests/artifact-editor-controls.test.mjs` | Insert gives the new element a `zIndex` above the maximum and leaves siblings' stored values untouched; delete leaves every survivor's untouched. Insert, reorder and delete are three separate triggers and a guard on one covers neither other — an unconditional rewrite renumbered the 40 seed layouts whose stored `zIndex` is not dense, twice, before this was closed. Both the PPTX exporter and the slideshow paint in `zIndex` order, so this decides what reaches the congregation |
| Preview row titles resolve through four sources before a fallback | verified | `src/components/SlidePreviewList.tsx`; `previewLabel`/`kindChipLabel` in `src/lib/artifacts/preview-model.ts`; source-scan guard in `tests/artifact-preview.test.mjs` | `slide.title` → `entry.label` → the kind chip → `slide.kind` → a translated last-resort string. A label blank after trimming falls through rather than rendering an empty row. The hardcoded `Untitled Slide` literal is gone — it was also the one untranslated user-facing string on this surface |
| The preview row **badge** is a closed vocabulary, separate from the title cell | verified | `resolvePreviewBadge` in `src/lib/artifacts/preview-model.ts`; badge assertions in `tests/artifact-preview.test.mjs`; `tests/translator-guard.test.mjs` | `general` for a row outside any set, `song-set-N`, `ann-set-N`, or — for a song-set child — its localized lyric role (`title`, `verse N`, `reff`, `chorus`). A slide's internal kind never appears in the badge, and the title cell is left empty when the badge already carries the role. Two defects shipped here on 2026-08-22 and both are guarded now: the badge and the title both resolved to `entry.label`, so a row printed the same text twice; and the verse number was never substituted, because this project's translator is `(key) => string` and the params object was dropped, putting a literal `VERSE {N}` on the Operator's screen. `translator-guard` fails on any second argument passed to `t` across `src/` and `spa/src/` |
| Sync Artifact reports success and refreshes the preview in place | verified | `src/operator/SyncArtifactButton.tsx`; `tests/no-router-refresh-guard.test.mjs` | Its old confirmation promised announcement flyers would survive, which FR-3's retirement made false. Success now raises a toast and the parent re-fetches, never `router.refresh()` or `navigate(0)` — those remount the route and blank the page. A refresh that fails after a successful sync is currently swallowed: **OQ-45** |
| Numeric timeout per route | [ASSUMED] | did not read `maxDuration` | platform default |
| A gone `variable_name` may be reused by a later entry with no special guard | [ASSUMED] | DEC-004/S2 is silent | smallest reasonable choice; report at G4 close (see Report) |
| A gone `AnnouncementSet` still referenced by a live marker is rejected on delete, marker must go first | [ASSUMED] | DEC-004/AD-35 does not state the guard explicitly | smallest reasonable choice; state-machines.md, this SDD |
| `reference`/`text` split (S1) cannot be told apart from the payload alone between scripture vs theme purpose | resolved | S1 gives the target keys; disambiguation rule is per-slide `artifact_templates.id`, verified executable against `data/default-registry.json` (`verse-reading` line ~331, `bible-verse-contemplation` line ~804) | Owner ruling 2026-08-20, resolved inline — `06-flows/predefined-field-migration.md` § Disambiguation; never filed as a `wdi-question` (none exists in `.control/questions/`), so the earlier `[NEEDS CONFIRMATION]`/routing note in this row was stale and is corrected here |

---

## Slots

`01-ux/` canvas is not written — belongs to `wdi-ux`. `02-contracts/` (`00-inventory`, `01-artifacts`
as-built, plus `02-song-set-entries`, `03-announcement-sets`, `04-background-library`,
`05-song-books` new). No `03-integrations/`. `04-components/LC-15-store.md` (updated). `05-model/data-model.md`
(rewritten physical shape). `06-flows/delete-template.md` (unchanged), `copy-paste-share-by-reference.md`,
`predefined-field-migration.md`, `song-set-physical-shape-migration.md`, and `canvas-authoring-controls.md` (new — as-built, W3).

## Open Items

OQ-24 · OQ-15 · OQ-14 · OQ-30 · OQ-32 · **OQ-45** (a preview refresh that fails after a
successful sync is swallowed) · **OQ-48** (Admin Song Book CRUD is served but no `FR` or `UC`
promises it, including whether an Admin may delete a book) · **OQ-49** (the three Operator-facing
registry reads — platform rows 66, 68, 69 — have no failure behaviour). The `reference`/`text` split disambiguation is **not**
open — resolved by owner ruling 2026-08-20, see `06-flows/predefined-field-migration.md` §
Disambiguation and the Evidence table above (this line previously claimed it was routed to
`wdi-question`; no such question was ever filed, and the resolution already lived in the sibling
flow document — corrected during wdi-review, 2026-08-20).

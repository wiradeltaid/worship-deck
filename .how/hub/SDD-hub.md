---
type: sdd
component: hub
status: draft
created: 2026-08-18
updated: 2026-09-22
realizes: [UC-1, UC-2, UC-3, UC-4, UC-5, UC-6, UC-7, UC-8, UC-9, UC-10, UC-16, UC-17, UC-18, UC-19, UC-22, UC-23, UC-26, UC-28, UC-30, UC-31, UC-32]
binds: [AD-1, AD-2, AD-3, AD-4, AD-5, AD-6, AD-7, AD-8, AD-9, AD-12, AD-16, AD-19, AD-23, AD-24, AD-25, AD-26, AD-28, AD-30, AD-31, AD-32, AD-34, AD-35, AD-36]
reviewed:
  date: '2026-09-22'
  sha: 'e1558cc2a77eba95aa127700f639dc50a2c9fe15'
  lenses: [structure, prose, edge-case-hunter]
  note: 'Re-review of the delta since 6281284: G4 depth backfilled for SPEC-44/46/47''s Hub-owned surface, which shipped under an autopilot mandate with no FR, UC, or SDD depth at all. Added: three LC rows (LC-19 parser profiles, LC-20 form layout, LC-23 sync mutation, each a genuinely new resource family — Hub has no existing wide gateway to widen the way Registry''s LC-11 is); two Inherited Constraints rows (AD-19, AD-32 — Hub now owns the Predefined Field Catalog''s CRUD, DEC-058 noted); three Failure Behaviour rows (parser profiles, form layout, sync mutation), the sync row naming the CORS/auth gap as the dominant failure mode rather than an edge case, and the form-layout row naming a real silent-failure bug (`fetchLayout` swallows every error). Edge-case-hunter cross-checked every new AD/DEC/FR/UC id against ARCHITECTURE-SPINE.md, the two PRDs, and usecases.yaml for contradiction — found none beyond what DEC-057/058 already resolved. Zero findings remaining.'
---

# SDD — Hub

Target: Hub UI on `spa`, APIs and plan on `api`, PPTX on `pptx-worker` (DEC-003 / AD-30). As-built: Go API in `cmd/api`, operator UI in `spa/`, shared modules in `src/`.

## Decision Summary · [outline]

Hub is the Operator SPA surface: Service list, form, Run-Sheet, generate/download PPTX, accounts, settings. This phase's intake is the Operator Hub form (`/services/new`, UC-2). `POST /api/webhook` / LC-8 remains on the Go API as last-phase CAP-11 intake (AD-3: JSON agnostic of picoclaw); it is as-built, not this phase's handover.

**DEC-004 (2026-08-20) narrows and grows Hub's form at once.** Announcement composition leaves Hub
entirely — the form only previews how the Registry's Announcement Sets expand (FR-3 retired). In its
place, two things the form did not do before: a Song Set group per Registry-configured entry, replacing
four hardcoded song fields (FR-32), and an inline per-entry lyric editor with a this-service-only
default and a separate explicit save-to-book action (FR-34) — the latter was blocked on a conflict with
AD-25, now closed by **DEC-005 / AD-36** (see `05-model/data-model.md` § *Resolved*). **Both have
shipped:** the bootstrap-once path landed first, as required, and the route is as-built at
`internal/httpapi/server.go:41` (`POST /api/services/{id}/song-sets/{variableName}/save-to-book`).

Two expensive choices reversed: (1) one authorization gate on the Go API plus a SQLite check per request (AD-5); (2) PPTX as the Sabbath guarantee, not the slideshow (AD-1).

## Structure · [outline]

| LC | type | Responsibility |
| --- | --- | --- |
| LC-1 | gateway | login / logout / change password |
| LC-2 | gateway | Service CRUD, preview, PPTX, Sync Artifact, Song Set weekly inputs + lyric override (DEC-004) |
| ~~LC-3~~ | ~~gateway~~ | ~~announcement list~~ — **retired** (DEC-004, FR-3 retired); see `02-contracts/03-announcements.md` |
| LC-4 | gateway | upload and read images |
| LC-5 | gateway | Admin accounts |
| LC-6 | gateway | settings (transition, locale, default corpus) |
| LC-7 | gateway | search hymns |
| LC-8 | gateway | picoclaw webhook — CAP-11 later; as-built, still specified |
| LC-12 | service | parse Rundown + write Service |
| LC-13 | job | generate PPTX |
| LC-16 | service | `buildSlidePlan` (also used by Presenter) |
| LC-19 | gateway | Rundown Parser Profiles CRUD (`09-rundown-parser-profiles.md`, FR-36) |
| LC-20 | gateway | Form Layout / Form Grouping / Predefined Field CRUD (`10-form-layout.md`, FR-37) |
| LC-23 | gateway | Manual Sync push/pull/status, mutation half (`11-manual-sync.md`, FR-40, experimental) |

Direction: Hub screens → LC-1…LC-7, LC-19, LC-20, LC-23 → LC-12…; picoclaw → LC-8 is later (CAP-11). All SQLite is in `web`.

Screens (`inventory-screen` 1–6) are not yet `LC` `ui-screen`: that is a `wdi-ux` slot, skipped at the owner's request.

## Inherited Constraints · [guarded]

Full text in `.how/_platform/ARCHITECTURE-SPINE.md`. ADs that do not bind Hub (AD-10, AD-11, AD-13–AD-15, AD-17, AD-18, AD-20–AD-22, AD-27, AD-29) are not listed.

| AD | How it lands here |
| --- | --- |
| AD-1 | PPTX download is the guarantee; the slideshow is a complementary link. |
| AD-2 | One repo; Hub lives in `api` + `spa` + `pptx-worker`. |
| AD-19 | Binds `base_type` and — until DEC-058 — bound the Predefined Field Catalog key set too; `general`'s own closed, non-editable treatment is unaffected and Hub does not own `general`. |
| AD-32 | The Predefined Field's shape (inline `{key}` token vs. whole-element binding) is authored on the Registry's canvas, not here; Hub owns only the catalog's CRUD (`10-form-layout.md`) — **superseded in part by DEC-058** for the key-is-a-code-change clause, which no longer binds Hub's CRUD surface. |
| AD-4 | Durable `DB_PATH` on the Go process. |
| AD-5 | `/api/webhook` is `WEBHOOK_SECRET` only. Session expiry at save/delete is this gate's 401 before the handler (OQ-23). As-built until cutover: `internal/gate`. |
| AD-3 | Hub form writes Service now; LC-8 writes the same Service later (CAP-11). |
| AD-6 | PUT Service (UC-5). DELETE Service (UC-7). POST sync-artifact (UC-16). GET pptx / POST preview are not mutations (OQ-20). Half of the agent paths are not yet closed (deferred-work). |
| AD-7 | Preview and PPTX do not re-order from Service fields. |
| AD-12 | Preview and PPTX consume the fat plan; they do not look up Registry. |
| AD-8 | LC-4 and announcements. |
| AD-9 | No Prisma. `services.registry_snapshot_at` is Hub; the freeze table is Registry. |
| AD-16 | Create clones in the same transaction. Sync is `POST /api/services/[id]/sync-artifact`, Admin-only. Preview stays live. |
| AD-23 | LC-6 writes; PPTX reads. |
| AD-24 | `ui_locale` in settings, not a chrome cookie. |
| AD-25 | Superseded here: the song-book half is carved out by **AD-36** (DEC-005) — `hymns` and the `song_books` registry row are administrator-owned after bootstrap, not a corpus projection. AD-25 binds nothing Hub owns; it continues to govern only the bible family, which Hub does not own. |
| AD-26 | Hymn picker / default book. |
| AD-28 | Rundown: every installed translation. |
| AD-30 | Hub APIs + LC-16 on `api`; UI on `spa`; LC-13 on `pptx-worker`. |
| AD-31 | Hub reads the live entry list (same-process, `artifact_templates` `base_type = 'song-set-entry'`), never authors it; the Service form's Song Set group repeats once per entry, not four fixed fields (FR-32, `05-model/form-fields.md`). |
| AD-34 | Hub's `song_set_inputs.background_id` is the **weekly** choice only; Hub never reads or writes a live in-service background override — that stays on the presenter/projector channel entirely outside this component. |
| AD-35 | LC-12's create/Sync clone widens from "spine only" to "spine + every spliced Announcement Set"; `announcement_items`'s old live-membership shape (superseded AD-16 clause) is gone from Hub's model. |
| AD-36 | `upsertHymns` becomes insert-only-for-absent-rows, gated by a per-book-code marker; that migration is the precondition for LC-2's save-to-book route (UC-28) to ship — see `06-flows/lyric-save-to-book.md`. **The marker gates corpus-seeding only** (whether the shipped file's hymns get bulk-inserted for that `book_code`) — it never gates an administrator's own per-row write, so authoring hymns one at a time into an admin-created book (`02-contracts/05-song-books.md`) and the save-to-book override (UC-28) both work regardless of whether the marker is set. |

## Failure Behaviour · [guarded]

Hub does not retry a failed call; the Operator (or picoclaw) must press again. Process timeout is the Go API default — [ASSUMED], never read as a number. The `route.ts` files that phrase once referred to are gone: DEC-003 retired the Next.js shape and the operator UI is a Vite SPA under `spa/` with shared modules in `src/`. The one named timeout is `POST /api/upload/from-url`: `REMOTE_IMAGE_TIMEOUT_MS = 8000` in `src/lib/remote-image.ts`.

This phase's create boundary is `/services/new` (UC-2). `POST /api/webhook` is as-built CAP-11 later; do not treat it as this phase's handover.

Every Hub-owned row in `.how/_platform/inventory-api.md` — **24 rows** after the 2026-08-22 refresh
(commit `0b24d5e`) — plus `inventory-screen.md` 1–6. Rows 10–14 (`/api/announcements*`) are retired
(DEC-004, FR-3) and now sit in that file's `## Retired` section. Save-to-book is **numbered 67**; the
separate Song Set PUT this design proposed was never built (see its row below).

| Boundary | Slow | Absent | Lying | What the user sees | What is logged |
| --- | --- | --- | --- | --- | --- |
| POST `/api/auth/login` | Browser waits until the process default | 500 `{ error: Internal Server Error }` | Wrong user/password → 401 same `Invalid username or password`; lockout → 429 + `Retry-After`; short `AUTH_SECRET` → 503 | Sign-in form: failed credentials, wait message, or host-not-ready | 500: `Login error:` (`internal/httpapi`). 503: `AUTH_SECRET is missing or shorter than 16 characters`. 401/429: not logged |
| POST `/api/auth/logout` | Browser waits | Revocation write fails → 500 `Logout failed`; cookie **kept** so the browser is still signed in | Already signed out: still 200/303 and cookie cleared | JSON `{ ok: true }` or redirect to `/login`. On 500: still on Hub, still signed in | `Logout revocation failed:` (`internal/httpapi`) |
| POST `/api/auth/change-password` | Browser waits | 500 `{ error }` | Wrong current password → 401 `Current password is incorrect`; lockout → 429 + `Retry-After`; no session → 401 from gate | Form shows that message; password hash unchanged | `Password change error:` on 500 (`internal/httpapi`) |
| GET `/api/services` | List JSON delayed | 500 `{ error: Internal Server Error }` | Search `q` is a substring filter; a corrupt row still appears in the list | Hub list spinner then rows, or a failed fetch — not a silent empty Hub pretending there are no Services | `Error listing services:` (`internal/httpapi`) |
| POST `/api/services` | Timeout; a 201 retry may already have inserted | 500 | No date / empty paste → 400, no row (OQ-21). Same date without `allowSecond` → 409 + `existingId` (OQ-8). Unparseable body **with** a date → 201 and `failedHymnNumbers` (NFR-5, OQ-22) | Form: miss named, or existing Service offered, or incomplete Service saved | `Error creating service:` on 500. 400/409: not logged |
| PUT `/api/services/[id]` | Timeout; no write if the gate already 401'd | Row gone → 404 `Service not found` (UC-7; do not recreate, OQ-23) | Stale `updated_at` → 409, no write (BR-4). Bad id → 400 | Run-Sheet: conflict alert then refresh; gone → not-found page after refresh; session expiry → 401, fields not stored | `Error updating service:` on 500. 409/404: not logged |
| DELETE `/api/services/[id]` | Timeout; a successful delete already unlinked files | 404 `Service not found` | Bad id → 400. Missing `updated_at` → 400; stale `updated_at` → 409 (AD-6). Session expiry → 401 **before** the handler; no partial write (OQ-23) | Confirm dialog then list without the row, or `Error deleting service` alert | `Error deleting service:` on 500 (`internal/httpapi`). Unlink misses: `Error unlinking service upload:` (`src/lib/services/queries.ts`) |
| GET `/api/services/[id]/pptx` | Generate waits (UC-6 / UC-18); does **not** edit the Service (OQ-20) | 404 `Service not found or not parsed` | Corrupt `parsed_data` → 500 `Corrupt parsed data`. Bad id → 400 | Browser download fails; Sabbath keeps any earlier cached file | `Error generating PPTX:` on 500. Cache write miss: `PPTX cache write/cleanup failed:` (`internal/httpapi`) |
| POST `/api/services/preview` | Plan build waits; no Service write (OQ-20) | 500 | No date / empty `raw_payload` → 400. Bad image URL → 400 | Preview pane empty or last good preview; form not saved | `Error generating preview:` (`internal/httpapi`) |
| ~~GET/POST/PUT/PATCH/DELETE `/api/announcements*`~~ | — | — | — | **Retired** (DEC-004, FR-3). See `02-contracts/03-announcements.md`. | — |
| ~~PUT `/api/services/[id]/song-sets`~~ (**never built** — the weekly inputs ride the Service mutation instead: `internal/httpapi/services.go:207` upserts `song_set_inputs` inside the create/update path, so AD-6's precondition is the Service's own `updated_at` and there is no second token. The row is kept because this design predicted a separate endpoint and the build chose otherwise) | Timeout; retry may double-apply an upsert (idempotent by `(service_id, variable_name)` PK) | 500 | Unknown `variableName` written anyway (inert row, AD-19/AD-31 posture) — no 400 for that case; same posture for a `songBookCode` naming a book no longer in `song_books` (written anyway, inert, resolved at render time per `05-model/form-fields.md`); bad song number format → 400 | Form: song/book/background stays as last saved on failure | `Error updating song set inputs:` (proposed logging site) |
| POST `/api/services/[id]/song-sets/[variableName]/save-to-book` (**as-built**, platform row 67; `internal/httpapi/server.go:41`. Its precondition held: the AD-36 bootstrap-once path landed first) | Timeout; a successful write already landed in `hymns` | 500 | Hymn moved under the Operator → 409 (SCN-4); no resolvable hymn → 400 | Editor shows the conflict or the failure; the Service's own override is unaffected either way | `Error saving lyric to song book:` (proposed logging site) |
| POST `/api/upload` | Large file waits | Disk fail → 500 `Failed to upload image` | No file / not an image / bad ext → 400 | Upload widget shows failed; no new ref | `Upload error:` (`internal/httpapi`) |
| POST `/api/upload/from-url` | Aborts at 8000 ms → 504 `That host took too long to answer.` | Unreachable / HTTP error / empty → 502 with that host message | Allowlist/SSRF/malformed/redirect/not-an-image → 400; too large → 413 | Fetch failed with that sentence; no new ref | `Image fetch refused (reason) for <url>:` (`internal/httpapi`) |
| GET `/api/uploads/[filename]` | File read waits | Missing file or unresolved name → 404 `Not Found` | Name that is not a local upload ref → 404 (resolver refuses) | Broken image in Hub / PPTX | nothing on 404 (`internal/httpapi`) |
| GET `/api/hymns` | Search waits | 500 | Malformed `limit` / `numbers` tokens ignored; empty `q` returns the first page, not 400 | Picker: no rows, or a page of the index | `Error searching hymns:` on 500 (`internal/httpapi`). Empty corpus: 200 `{ hymns: [] }` |
| GET `/api/admin/accounts` | List waits | 500 | Not Admin → 403 `Forbidden` (gate or `requireAdminSession`) | Admin page forbidden or failed load | `Error listing accounts:` on 500 (`internal/httpapi`) |
| POST `/api/admin/accounts` | Timeout | 500 | Duplicate username / bad role / empty password → 400; not Admin → 403 | Form keeps the typed values; no new account | `Error creating account:` on 500 |
| PATCH `/api/admin/accounts/[id]` | Timeout | 404 via client message | Last admin demote refused → 400; bad id → 400; not Admin → 403 | Message on the form; row unchanged | `Error updating account:` on 500 (`internal/httpapi`) |
| DELETE `/api/admin/accounts/[id]` | Timeout | 404 | Last admin delete refused → 400 | Account remains if refused; gone if 200 | `Error deleting account:` on 500 |
| GET `/api/admin/settings` | Read waits | 500 if settings helpers throw | Not Admin → 403 | Previous chrome language / transition stay on screen | helper `console.error` in `src/lib/settings.ts` if a read throws |
| PUT `/api/admin/settings` | Timeout | 500 | Unknown transition / locale → 400; `pptx_retention_days` present and not a non-negative integer → 400; not Admin → 403. Keys written: `pptx_retention_days`, `slide_transition`, `ui_locale` | Previous settings remain | `Error updating settings:` (`internal/httpapi`) |
| POST `/api/webhook` | Timeout is on picoclaw; Hub does not retry | Secret unset → 503. Agent down: Hub silent | Wrong secret → 401 (secret not logged). Bad JSON → 400. Specified: no date → no row (OQ-21); images attach or fail visibly (OQ-22) | CAP-11 later: Events get no read-back. Operator sees Hub. Not this phase's handover | `Error processing webhook:` on 500 (`internal/httpapi`). Does not log the secret |
| `/api/admin/parser-profiles*` (8 rows, `09-rundown-parser-profiles.md`) | Admin panel waits on each request | 500 on a DB failure | 404 unknown id; 409 duplicate `slug`; 400 malformed `rules_json`, deleting the builtin, or deleting the active default | Admin panel names the specific rejection; the Operator's Rundown-paste surface silently keeps using whichever profile was already active | Handler-level `log.Printf` per operation; secrets never appear in a parser rule |
| `/api/admin/form-groupings*`, `/api/admin/form-grouping-slots*`, `/api/admin/predefined-fields*`, `GET /api/worship-form-layout` (11 rows, `10-form-layout.md`) | Admin panel waits; Operator's Service form fetch waits on `GET /api/worship-form-layout` | `fetchLayout` in `CreateForm.tsx`/`EditForm.tsx` catches silently (`catch { // ignore }`) — a failed or non-OK response leaves `layoutData` unset and the form renders **no** dynamic Predefined Fields at all, with no error shown to the Operator | 404 unknown grouping/slot/field; 409 duplicate slot ref or duplicate `variable_name`; 400 invalid `widget_kind` or `variable_name` format | Admin panel names the rejection. Operator sees a form silently missing its configured fields — no error, no retry offered | Handler-level `log.Printf` per operation; the client-side fetch failure is not logged anywhere |
| `/api/sync/push`, `/api/sync/pull`, `/api/sync/status` (`11-manual-sync.md`) | No timeout enforced server-side; a slow peer just makes the Admin wait | Peer unreachable → the browser's own network error, never a WorshipDeck response | 409 `presenter_active` while a presentation is live; **cross-origin call silently fails at the browser's CORS layer before reaching any of the above** — this is the dominant failure mode today, not an edge case | Admin Sync screen shows whatever generic failure the browser surfaces for a blocked/failed fetch — not a WorshipDeck-authored message | No client-side error surfaced beyond the browser's own network console; server-side, `internal/httpapi/sync.go` logs per operation |
| `/login` | Waits on POST login | Login API 500 → form error | Wrong credentials → same 401 copy | Login form; never Hub | none on the page (client shows the API body) |
| `/` | List fetch waits on the API | Uncaught DB throw → framework error page | Corrupt `parsed_data` still listed by date | Dated list, or error page — not a silent empty Hub | none in `spa/src/pages/ServicesListPage.tsx`; API list logs as above if the client refetch fails |
| `/services/new` | Preview POST may lag on each paste | Preview 500 → empty preview pane | No date → 400, no row. Partial parse with date → save what was readable (OQ-22) | Form names the miss (UC-2). Cards: Bible Talk → Divine Worship → Sermon → Family → Youth, each Song Set entry rendering its own group (FR-32) with an inline lyric editor (UC-28). No Announcement Flyers card (DEC-004, FR-3 retired). Live Slide Preview only | `Preview error:` in `src/operator/CreateForm.tsx` |
| POST `/api/services/[id]/sync-artifact` | Clone until browser timeout | 403 Operator; 404 missing; 400 missing token | Stale `updated_at` → 409 + current token | Run-Sheet stays on the previous freeze until success; entered fields unchanged | `Error syncing artifact registry:` on 500 |
| `/services/[id]` | Detail fetch + PUT save wait | Missing row → `notFound()` | Stale save → 409 then refresh. Gone after reject → UC-7 not-found (OQ-23). Session expiry at save → 401, no partial write. Save-to-book race → 409 (SCN-4), Service-level fields still save normally | Same form cards as create. Chrome: Preview, Present, Delete Service, Download PPTX, Live Slide Preview, read-only Deck preview strip (renamed from the old announcement strip; no "Manage list" — DEC-004). Admin: Sync Artifact. No Order of Service card | `Preview error:` / save `console.error` in `EditForm.tsx`; delete `console.error` in `DeleteButton.tsx` |
| ~~`/announcements`~~ | — | — | — | **Retired** (DEC-004, FR-3). Composing announcement content moved to the Artifact Registry. | — |
| `/admin` | Admin fetch waits | Not Admin → 403 `Forbidden` from the gate | Bad settings body → 400; previous values remain | Accounts, transition, locale, retention | accounts/settings `console.error` as above |

## Robustness Analysis · [deep]

`critical` UCs only. Objects are not repeated in the SRS.

| UC | Boundary in | Control | Entity | Boundary out |
| --- | --- | --- | --- | --- |
| UC-1 | LC-8 webhook — later CAP-11 | LC-12 | Service, Hymn | JSON to picoclaw |
| UC-2 | `/services/new` + LC-2 POST — this phase | LC-12 | Service | Hub list |
| UC-5 | Run-Sheet + LC-2 PUT | LC-12 | Service | 200 or 409; 404 if gone (OQ-23) |
| UC-7 | LC-2 DELETE | LC-12 | Service → absent; local files unreferenced | list without the row |
| UC-17 | LC-8 `correct` — later CAP-11; named date, no nearest-Sabbath fallback (OQ-21) | LC-12 | Service | read-back |
| UC-28 | Service form lyric editor + LC-2 PUT (override) / LC-2 save-to-book (proposed, designed — closed by DEC-005/AD-36) | LC-12, LC-16 (resolution order) | Service (`song_set_inputs`), Hymn (`hymns.lyrics` on save-to-book only) | Deck reads the override (this Service) or the corrected book (future Services) |

`01-ux/` is not written: the owner skipped `wdi-ux`. Contracts: `02-contracts/`. Integration: picoclaw. Risky technical flows: `06-flows/webhook-intake.md`, `delete-service.md`, `lyric-save-to-book.md` (designed; the AD-25 conflict is closed by DEC-005/AD-36 — the remaining gate is build-order, not policy).

## Evidence

| Claim | Label | Read to decide | Disposition |
| --- | --- | --- | --- |
| Hub route verbs match the inventory | verified | `internal/httpapi` 2026-08-18 | — |
| GET `/api/services/[id]` | verified | `internal/httpapi` `GET /api/services/{id}` | SPA consumes plan + transition |
| Not all four Service mutation paths have 409 | [PARTIAL] | spine AD-6 *Not yet closed* | debt, not a G4 fix |
| Numeric timeout per Hub route (`maxDuration`) | [ASSUMED] | grep 2026-08-19: no `maxDuration` in `src/` | platform default. Do not invent a number |
| Named timeout on remote image fetch | verified | `src/lib/remote-image.ts` `REMOTE_IMAGE_TIMEOUT_MS = 8000` | from-url 504 |
| LC-12 parse+write | verified | `src/lib/parser.ts`, `src/lib/services/create-service.ts`, `src/lib/services/update-service.ts` | Hub POST same date is 409 unless `allowSecond`; webhook upsert is CAP-11 |
| LC-13 PPTX on-demand; does not UPDATE `services` | verified | `internal/httpapi` GET; `src/lib/pptx.ts` | OQ-20: generate is not a payload edit |
| POST preview does not write Service | verified | `internal/httpapi` | OQ-20 |
| Sync Artifact is Admin-only Hub route | verified | `internal/httpapi`; `tests/go-http-gate.test.mjs`; `tests/registry-sync-artifact.test.mjs` | UC-16 / AD-16 |
| Create clones a snapshot in the same transaction | verified | `src/lib/services/create-service.ts` → `cloneRegistryToNewService` | AD-16 |
| LC-16 `buildSlidePlan` | verified (pre-DEC-004 shape) | `src/lib/slide-plan.ts` | lyric join/chorus: `src/lib/lyrics.ts` (BR-6 as amended by DEC-004 S7 — the char-budget/continuous-prose join this row's original claim described is retired by that amendment, not by anything read new this pass) |
| Song number overlays are positional (`song1Number`..`song4Number`, slot 0..3 into `items`), not list-driven | verified | `src/lib/worship-form-fields.ts:6-9`, `internal/parse/fields.go:11-16`, `internal/httpapi/services.go:745-748`, `src/lib/parsed-fields.ts:20-23` | [MISSING] against FR-32 — this is exactly the hardcode DEC-004/G3 identified; build replaces it with `song_set_inputs`, not this SDD |
| `familyPrayerRequest` / `youthPrayerRequest` already split from legacy `familyYouth`; `themeVerse` already independent of `verseReading`; `verseReading.translation` already exists | verified | `src/lib/parsed-fields.ts` (`coerceScripture`, `normalizeParsedRundown`), `src/lib/worship-form-fields.ts` (`verseTranslation`) | Corrects DEC-004 Supplement S1's claim that `scripture_bible_version` and the scripture/theme split are new work — they are renames of as-built fields, not new fields (see `05-model/data-model.md`) |
| `song_set_inputs` exists, carrying the per-service lyric override | verified | `internal/db/schema.sql:186` (`lyric_override TEXT`); mirrored in `src/lib/db/index.ts:722`; written by `internal/httpapi/services.go:207` | **Corrected 2026-08-22.** This row read "No `song_set_inputs` table, no per-service lyric override anywhere in `internal/db/schema.sql`" and labelled it `[MISSING]`, which was true when written and false once the table shipped. Kept rather than deleted per the evidence ladder |
| A write path into `hymns` exists: save-to-book | verified | `internal/httpapi/server.go:41` → `saveSongSetToBook`; flow in `06-flows/lyric-save-to-book.md` | **Corrected 2026-08-22.** This row read "No write path into `hymns` exists today", which is how the AD-25 vs FR-34 conflict was proved real rather than misread. DEC-005/AD-36 closed the conflict and the route then shipped, so the sentence is now history and is kept as such |
| Create/edit field set | verified | `CreateForm.tsx` / `EditForm.tsx` | `.how/hub/05-model/form-fields.md` |
| Deleting a Service unlinks unreferenced local uploads | verified | `src/lib/services/queries.ts` `deleteService`; `tests/services-lib.test.mjs` | OQ-7 |
| Session expiry at PUT/DELETE refuses before the handler | verified | `internal/gate` `unauthorized` 401 JSON for `/api/` | OQ-23: no partial write |
| PUT gone → 404, page `notFound()`, EditForm does not POST create | verified | `src/lib/services/update-service.ts`; `spa/src/pages/ServiceDetailPage.tsx`; `EditForm.tsx` | OQ-23: UC-7 not-found, do not recreate |
| Hub create refuses when `parsedData.date` is missing | verified | `src/lib/services/create-service.ts` | OQ-21 on UC-2 |
| Webhook rundown with no date still inserts using `localIsoDate()` | [MISSING] specified OQ-21 refuse | `internal/httpapi` `parsedData.date \|\| localIsoDate()` | planned CAP-11 (OQ-27) — not a `BUG-` row this wave. Sentence kept |
| Telegram correction has no nearest-Sabbath lookup | verified | `internal/httpapi` `findServiceByDateOrId` / `handleCorrection` | OQ-21: document used to claim nearest Sabbath; code already rejects. Correction of the claim, not a new lookup |
| Telegram images attach or fail visibly | [MISSING] | `src/lib/images.ts` `coerceImageUrls` filters unsafe/non-string entries; webhook stores the filtered array with no per-URL failure in the read-back | planned CAP-11 (OQ-27, OQ-22) — not a `BUG-` row this wave. Sentence kept |
| Hymns empty corpus | verified | `internal/httpapi` returns 200 `{ hymns: [] }` | Was once specified as a loud miss; contract now matches as-built empty array |

---

## Slots

`01-ux/` is not written — belongs to `wdi-ux`, skipped. `02-contracts/` (00-inventory + 01–08; `03-announcements.md` retired in place, not deleted). `03-integrations/picoclaw.md`. `04-components/` LC-12, LC-13, LC-16. `05-model/data-model.md`, `form-fields.md`. `06-flows/webhook-intake.md`, `delete-service.md`, `lyric-save-to-book.md` (new; designed, gated only on the AD-36 bootstrap-once migration landing first).

## Open Items

OQ-17 · OQ-2 · OQ-4. OQ-6 answered (DEC-003). OQ-1 is parked on CAP-11. Taken and encoded: OQ-20 · OQ-21 · OQ-22 · OQ-23. Parked on this SDD: OQ-27 (CAP-11 `[MISSING]` stay; not `BUG-` this wave). OQ-33 and OQ-34 retire with `03-announcements.md` — there is no announcement PUT/PATCH left to be non-idempotent about.

**New from this pass (DEC-004 G4), routed rather than answered here:**

- **AD-25 vs. FR-34/UC-28/BR-7** — closed by **DEC-005 / AD-36** (2026-08-20) and **both halves have
  shipped** (2026-08-22): the bootstrap-once path landed first, as this item required, then the
  save-to-book route. Nothing is open here. One caution earned the hard way: AD-36's rule covers the
  `song_books` registry row as well as `hymns`, and an every-boot reconcile of that row shipped and had
  to be replaced by a numbered migration the same day. Quote the rule; do not paraphrase it.
- **Endpoint numbering** — closed. `wdi-blueprint` refreshed the platform inventories from code on
  2026-08-22 (`0b24d5e`); save-to-book is row 67 and the separate Song Set PUT was never built.
- **`default_song_book` setting's home** — not decided in this pass (`02-contracts/07-settings.md`).
- **Unlink-on-delete must widen to check Registry-side references** before the delete cascade above ships, or a shared image could be removed out from under an Announcement Set (`06-flows/delete-service.md` Guarantees).

---
type: contract
component: registry
lc: LC-11
direction: exposed
created: '2026-09-22'
updated: '2026-09-22'
---

# Contract — Media Library and Fonts

## Source of truth

`none`. `internal/httpapi/background_library.go`, `internal/httpapi/fonts.go`.

## Purpose

UC-25 (media library — this contract widens FR-31's promise, FR-38), UC-14 (fonts, FR-39). Admin-only
for every write (AD-14); the two Operator-facing reads are session-only.

## Operations

| Operation | Purpose | Realizes |
| --- | --- | --- |
| GET `/api/admin/media-library` | List every category of `background_library_images` (background + announcement/flyer), or one category via `?category=` | UC-25 |
| POST `/api/admin/media-library` | Add an image to the shared store, any category | UC-25 |
| PATCH `/api/admin/media-library/[id]` | Update an image's metadata (name, category) | UC-25 |
| POST `/api/admin/media-library/[id]/replace` | Replace the image's file in place, keeping its id | UC-25 |
| DELETE `/api/admin/media-library/[id]` | Remove an image | UC-25 |
| GET `/api/media-library` | Media assets an Operator-session caller may choose from | UC-25 |
| POST `/api/admin/fonts` | Upload a font file (`.ttf` or `.otf` only) | UC-14 |
| POST `/api/admin/artifacts/fonts` | Upload a font file (same handler, second path) | UC-14 |
| GET `/api/fonts` | List installed fonts | UC-14 |
| GET `/api/fonts/[id]` | Download one installed font file | UC-14 |

## Five lanes

| Lane | Answer |
| --- | --- |
| Authentication | `/api/admin/*` requires Admin (AD-5, AD-14). `GET /api/media-library` and `GET /api/fonts*` require any signed-in session. |
| Validation | Media: same MIME/allowlist rule as any other Registry image (AD-8); no colour or gradient value (S10, inherited from Background Library). Fonts: extension allowlist is exactly `.ttf` and `.otf` (`uploadFont`); anything else is refused. |
| Error handling | Envelope in `cross-cutting.md`. 400 non-image body, or a font upload with an unsupported extension. 404 unknown media id. |
| Rate limiting | `none`. |
| Idempotency | GET is safe. `replace` keeps the same id and any references to it — callers do not need to re-point templates at a new id after a replace. |

## Error behaviour

| Condition | Response | Caller should |
| --- | --- | --- |
| POST body is not an image reference | 400 | Send an image URL/upload reference |
| Unknown media id | 404 | Refresh the list |
| Font upload has an extension other than `.ttf`/`.otf` | 400 "Only .ttf and .otf font files are supported" | Convert or choose a different file |

## Compatibility

**`POST /api/admin/artifacts/fonts` and `POST /api/admin/fonts` are the same handler, two routes.**
Neither is more authoritative; a caller MAY use either, and a change to the handler affects both
paths identically — do not treat one as deprecated without checking both call sites in `spa/`.
Media Library and Background Library (`04-background-library.md`) are the same table under two
contracts, split by `category` — a schema change to `background_library_images` is breaking for
both documents at once, and both MUST be updated together.

## Constraints

**A font, once uploaded, cannot be removed through this API** — no delete handler exists for fonts,
unlike every other Registry-managed asset (templates, media, song books). Retiring an unwanted font
is a filesystem-level operator action outside this contract, if it is possible at all. This is
reported as a finding, not designed around: a symmetric font lifecycle (upload → delete) was never
built, and nothing in the corpus records that as a deliberate choice.

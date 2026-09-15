# SPEC-33-03 — Typed Unresolved-Font Contract and Admin Acquisition API

**Status:** open
**Blocked by:** SPEC-33-02

## What to build

Handle missing/non-embedded proprietary fonts with a cross-language typed contract and authenticated acquisition API:

1. Cross-language data contract:
   - Add optional field `fontStatus?: 'system' | 'catalog' | 'embedded' | 'uploaded' | 'unresolved'` to `TextStyle` in `internal/plan/types.go`, `internal/plan/validate_artifact.go`, `src/lib/registry/types.ts`, and `src/lib/registry/validate.ts`.
   - In `internal/pptximport`: identify custom typefaces (such as `"The Youngest"`) that are not standard system fonts and not embedded in `ppt/fonts/*.fntdata`. Set `fontStatus: "unresolved"` and emit a slide warning: `"Custom font '<family>' is not embedded in the PPTX package and will require acquisition or fallback."`
2. Fallback heuristic in `src/lib/registry/font-catalog.ts`:
   - When an uncatalogued family has script characteristics (e.g. "The Youngest" or font name containing "Script", "Hand", "Calligraphy", "Brush"), set its fallback to `cursive, sans-serif` instead of default Arial, preventing cursive title slides from breaking into awkward generic sans-serif text.
3. Authenticated Font Upload Route (`POST /api/admin/fonts`):
   - In `internal/httpapi`, implement `POST /api/admin/fonts` protected by the existing admin authentication gate.
   - Multipart file upload: accepts `.ttf` or `.otf` up to 16 MiB.
   - Validate binary font tables (validate TrueType/OpenType offset tables and parse family/face metadata).
   - Compute SHA-256 hash, store asset atomically under `data/fonts/` (or font store), and insert record into `font_faces` table with rollback on failure.
   - Return `ImportedFontFace` JSON.
4. Client Acquisition & Dynamic Hydration:
   - In `src/components/admin/ArtifactEditor.tsx`, display an "Unacquired Font" indicator on elements with `fontStatus === 'unresolved'` with an "Acquire Font" upload action.
   - On upload, client calls `registerDynamicFontFace(font)`, awaits `font.load()`, and re-renders the canvas dynamically.

## Acceptance criteria

- `POST /api/admin/fonts` accepts valid TTF/OTF uploads, rejects non-font files or unauthenticated requests, and stores valid records in `font_faces`.
- An imported slide with unacquired font "The Youngest" tags the element as `fontStatus: 'unresolved'` and surfaces a clear warning.
- Admin upload of font binary immediately updates `font_faces`, registers in browser via `FontFace`, and re-renders the canvas without full page reload.

# SPEC-39-03 — Dynamic Announcement Placeholders and Weekly Service Data Hydration

**What to build:**
Reconcile and expand dynamic announcement placeholders (`{sermon_poster}`, `{family_photo}`, `{youth_photo}`, and new `{afternoon_program}`) across Go and TypeScript catalogs, persist a structured `afternoon_program` field on the weekly service record, and hydrate these fields into announcement slide templates during deck generation and PowerPoint export with graceful missing-asset fallbacks.

**Blocked by:** 01-central-media-gallery-and-canvas-editor-integration

**Status:** open

- [ ] Reconcile and extend dynamic placeholders in `src/lib/registry/placeholder-catalog.ts` and Go `internal/plan/plan.go`:
  - Preserve canonical keys: `{sermon_poster}`, `{family_photo}`, `{youth_photo}`.
  - Add `{afternoon_program}` (text placeholder, "Afternoon program title / rundown notes").
  - Maintain 100% parity between TypeScript and Go catalog entries.
- [ ] Add `afternoon_program` to weekly worship service record:
  - Database schema: add `afternoon_program TEXT DEFAULT ''` column to `worship_services` table in `internal/db/db.go`.
  - Update `StructuredServiceFields` in `src/lib/parsed-fields.ts` and `src/lib/worship-form-fields.ts`.
  - Add Afternoon Program text input in `CreateForm.tsx` and `EditForm.tsx`.
- [ ] Weekly data hydration in `src/lib/slide-plan.ts` and `internal/plan/hydrate.go`:
  - Map `sermonGraphicUrl` -> `{sermon_poster}`, `familyPhotoUrl` -> `{family_photo}`, `youthPhotoUrl` -> `{youth_photo}`, and `afternoonProgram` -> `{afternoon_program}` in weekly catalog values for announcement slide templates.
  - Graceful fallback: empty image fields render safe blank placeholders rather than throwing runtime errors.
- [ ] PPTX Export Resolution in `src/lib/pptx-draw.ts`:
  - Embed resolved weekly graphics and afternoon program text into generated PPTX slides.
  - Catch image fetch errors gracefully and draw placeholder shapes without failing the entire deck export.
- [ ] Conformance & Smoke Tests:
  - Add tests in `tests/smoke-spec-39.test.mjs` verifying Go and TypeScript placeholder catalog parity, weekly service `afternoon_program` persistence, slide hydration against sample weekly records, and PPTX export fallback on missing images.
  - Absence guard verifying that removing dynamic placeholder hydration logic fails tests.

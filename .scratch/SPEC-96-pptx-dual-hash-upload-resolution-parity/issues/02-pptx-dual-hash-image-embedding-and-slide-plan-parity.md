# 02: PPTX Dual-Hash Image Embedding and Slide Plan Parity

**What to build:** In `src/lib/pptx-draw.ts`, `src/lib/slide-plan.ts`, `package.json`, and `tests/pptx-dual-hash-image-embed.test.mjs`:

1. **Slide Plan Acceptance Gate Verification (`src/lib/slide-plan.ts`)**:
   - Verify that `computePlanContext` acceptance gate preserves `media.sermonGraphicUrl`, `media.familyPhotoUrl`, `media.youthPhotoUrl`, and `media.announcementInserts` containing 64-hex SHA-256 upload URLs without nullification.
   - Verify that artifact slide requests for `sermon-graphic` and `family-youth` carry the respective upload references in their placeholder values.

2. **PPTX Worker Image Embedding (`src/lib/pptx-draw.ts`)**:
   - Verify that `embedPlanImages` and `resolveImageData` locate 64-hex SHA-256 local files from disk, convert them to base64 Data URIs, and insert them into the slide image registry.
   - Verify that `renderImageElement` embeds the image via `slide.addImage({ data, ... })` and never falls back to `addImageUnavailable` ("Image unavailable") when the local 64-hex file exists on disk.

3. **Deterministic Fixture & Regression Tests (`tests/pptx-dual-hash-image-embed.test.mjs`)**:
   - Use a minimal, deterministic artifact plan fixture without ambient database dependence.
   - Seed fixture files in a temporary uploads directory:
     - 32-hex legacy image (`34645da1a600f8824686c0ae7104bc1d.png`)
     - 64-hex SHA-256 image (`758572555dd73f59b7059cf8e1d841eff62ff3b505831410d6b17e7cfc4fc8a2.jpg`)
   - Generate PPTX via `generatePptxFromPlan`.
   - Inspect generated PPTX zip archive (`jszip`):
     - Assert that `ppt/media/` contains the embedded image bytes for both 32-hex and 64-hex uploads.
     - Assert that slide XML does not contain the fallback string `"Image unavailable"`.
   - Register `tests/pptx-dual-hash-image-embed.test.mjs` into `package.json` under `"test"` and `"smoke:spec-96"`.

**Blocked by:** SPEC-96-01

**Status:** open

- [ ] Verify `slide-plan.ts` `computePlanContext` preserves 64-hex upload URLs across all photo slots.
- [ ] Verify `pptx-draw.ts` embeds 64-hex SHA-256 image files from disk.
- [ ] Register test in `package.json`.
- [ ] Add regression tests in `tests/pptx-dual-hash-image-embed.test.mjs` confirming PPTX generation embeds SHA-256 images into presentation media parts without fallback box.

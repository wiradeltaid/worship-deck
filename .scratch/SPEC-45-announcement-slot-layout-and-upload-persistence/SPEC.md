# SPEC-45 — Announcement Slot Single-Row Layout and Upload Persistence Hydration

> **Status:** open
> **Release:** announcement-slot-layout-and-upload-persistence
> **Component:** hub
> **Touches:** services
> **Depends on:** SPEC-44

## Problem Statement

During hand-testing of weekly worship service creation and announcement poster uploads, operators identified two critical usability and data persistence defects:

1. **Upload Persistence Failure in Edit Mode (Hydration Drop):**
   When an operator uploads weekly announcement posters during service creation (`CreateForm.tsx`), the images are successfully posted to `/api/uploads` and stored in `services.images_payload` in the database. However, when navigating to or viewing the service in `RunSheetPage.tsx` (`/services/:id`), the page renders `<EditForm ... />` without passing `initialAnnouncementInserts={images.announcementInserts}`. As a result:
   - The form initializes `announcementInserts` to empty strings (`['', '', '', '']`).
   - The UI displays empty upload boxes, giving the user the direct impression that their uploads were not saved.
   - If the operator saves any other field from `EditForm`, the empty array is sent in the PUT payload, permanently wiping the saved posters in the database.

2. **Cramped 2-Column Grid Layout for Announcement Slots:**
   In both `CreateForm.tsx` and `EditForm.tsx`, the 4 announcement poster slots are rendered inside `<div className="grid gap-4 sm:grid-cols-2">`. On desktop viewports (>=640px), this packs two upload cards side-by-side, creating severe horizontal cramping for the file picker, image URL input, action buttons, and thumbnail preview. Operators requested that announcement slots be displayed 1 item per row (single-column layout), matching the clean vertical cadence established for song sets in SPEC-43.

## Solution

1. **Hydrate Announcement Inserts in RunSheetPage:**
   In `spa/src/pages/RunSheetPage.tsx`, extract `announcementInserts` from `svc.images_payload` (with safe array coercion) and pass it as `initialAnnouncementInserts` to `<EditForm />`. Ensure that initial hydration, form resets, and server snapshot reloads reliably retain all 4 weekly upload slots.

2. **Refactor Announcement Slots to Single-Row (1 Item per Row) Layout:**
   In both `CreateForm.tsx` and `EditForm.tsx`, replace `sm:grid-cols-2` with a single-column layout (`space-y-4` or `flex flex-col gap-4`). Each announcement slot row receives full horizontal width for its label, file picker, link input, and preview image without cramped text or truncated controls.

3. **End-to-End Regression Verification & Absence Guards:**
   Add comprehensive smoke tests and absence guards in `tests/smoke-spec-45.test.mjs` and include them in `package.json`'s `npm test` suite, verifying:
   - `RunSheetPage.tsx` explicitly passes `initialAnnouncementInserts`.
   - `sm:grid-cols-2` is eliminated from weekly announcement poster containers across both form components.
   - API round-trip preservation of `announcementInserts` across service create, read, and update cycles.

## User Stories

1. As a worship service operator, I want my uploaded weekly announcement posters to remain visible and populated when I open an existing service for editing, so that my previous uploads are never lost or overwritten (satisfies `UC-5`).
2. As a worship service operator, I want each announcement upload slot to take up its own full row instead of being squeezed into a 2-column grid, so that uploading and previewing posters is clear and comfortable (satisfies `UC-2`, `UC-5`).
3. As a system maintainer, I want automated absence guards and persistence tests to prevent future regressions where image payloads are dropped during form hydration.

## Implementation Decisions

1. **Safe Hydration Contract:**
   - In `RunSheetPage.tsx`, extract `images.announcementInserts` and pass to `EditForm`:
     ```tsx
     initialAnnouncementInserts={Array.isArray(images.announcementInserts) ? images.announcementInserts : []}
     ```
   - In `EditForm.tsx`, maintain defensive normalization ensuring exactly 4 slot strings are held in state.

2. **Single-Row Container Styling:**
   - Replace `<div className="grid gap-4 sm:grid-cols-2">` with `<div className="flex flex-col gap-4">` (or `<div className="space-y-4">`) in both `src/operator/CreateForm.tsx` and `src/operator/EditForm.tsx`.

3. **Corpus Alignment Note (Precedence over DEC-004):**
   - In accordance with the project rule that documents follow code, SPEC-43 (merged under DEC-044) superseded earlier statements in DEC-004 and legacy SRS drafts by introducing the 4 weekly announcement upload slots. This spec maintains full fidelity to the live implementation.

## Testing & Human Smoke Decisions

- **Structural Absence Guards:** Prove test failure when `sm:grid-cols-2` is reintroduced into announcement slot containers.
- **Hydration Guard:** Prove test failure when `RunSheetPage.tsx` omits `initialAnnouncementInserts`.
- **API Persistence Test:** Test create service with announcement posters, fetch service, and update service, asserting 100% data retention.
- **CI Suite Integration:** Include `tests/smoke-spec-45.test.mjs` in `package.json` `npm test` script.
- **Human Smoke Steps:** Explicitly verify on desktop (>=1024px) and laptop (768px) viewports that all 4 slots render 1-per-row without clipping or overlap.

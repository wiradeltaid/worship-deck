# SPEC-112-04 — Run-Sheet, Dynamic Form, Admin Panels, and Codebase Conventions Ratification

**Satisfies:** [UC-10, FR-25]
**Blocked by:** ["SPEC-112-03"]
**Status:** closed

## Summary
Localize Run-Sheet page header controls, offline readiness badges, Dynamic Form slots, Image Crop presets, and admin panels. Ratify the mandatory bilingual i18n convention in `.constitution/project/codebase-conventions-guide.md` as an accepted project standard.

## Auditable Component Scope
- `spa/src/pages/RunSheetPage.tsx`
- `src/components/offline/OfflineReadinessBadge.tsx` (preserving non-UI isolation in `service-snapshot.ts`)
- `src/operator/DynamicFormBody.tsx`
- `src/components/media/ImageCropDialog.tsx` & `src/lib/images/crop-image.ts`
- `src/components/Header.tsx`
- `src/components/admin/BackgroundLibraryPanel.tsx`
- `src/components/admin/FormLayoutAdminPanel.tsx`
- `.constitution/project/codebase-conventions-guide.md`

## Key Responsibilities
1. **`RunSheetPage.tsx` & `OfflineReadinessBadge.tsx`**:
   - Localize Run-Sheet header titles, presentation launch options dropdown using interpolation: `t('runsheet.resumeAction', { slide: sessionInfo.slideNumber })` ("Resume (Slide {slide})"), "Start from Beginning", and PPTX exporting status.
   - Refactor `service-snapshot.ts` to expose typed status codes without pulling React `useT()`; wire UI localization into `OfflineReadinessBadge.tsx`.
2. **`DynamicFormBody.tsx` & `ImageCropDialog.tsx`**:
   - Localize field suggestions ("Suggestion:", "Use"), song set selector placeholders ("Book", "Song number...", "Use Song-Set Default"), and announcement slot labels.
   - Localize ImageCropDialog titles, zoom/ratio labels, and aspect ratio preset descriptions in `crop-image.ts`.
3. **`Header.tsx` & Admin Panels**:
   - Localize Header mockup links and offline settings tooltip.
   - Widen localization for `BackgroundLibraryPanel.tsx` (media category filter/upload labels).
   - Localize `FormLayoutAdminPanel.tsx` tab headers, card descriptions, and toast notifications.
4. **Constitution Ratification**:
   - Update `.constitution/project/codebase-conventions-guide.md` to permanently bind WDI Coding Playbook 07 § 4:
     - Mandatory L2-guarded i18n dictionary separation for all UI chrome.
     - Strict prohibition of hardcoded user-visible text in operator and admin components.
     - Exemption definition for user-authored database content, scripture/hymn corpora, and room-facing projection trees.

## Acceptance Criteria
- Full UI navigation and editing flows dynamically render in English or Bahasa Indonesia upon locale toggle.
- `.constitution/project/codebase-conventions-guide.md` contains the ratified normative i18n standard.
- Full CI test suite (`npm test`, `go test ./...`) passes cleanly.

## Comments

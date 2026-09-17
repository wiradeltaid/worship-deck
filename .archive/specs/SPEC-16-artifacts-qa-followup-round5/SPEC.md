# SPEC-16 — Artifacts QA Follow-up Round 5 (Deck Sequence Desktop Height Containment & Song Set Top Card Edit Title Compactness)

## Problem Statement

Following the deployment and testing of SPEC-15 (`DEC-017`) on `presenter-dev.bic.my.id`, manual testing by the Administrator verified that:
- Real-time image scaling clipPath synchronization (`BUG-7`) is working as expected with zero clipping or visual jumps.
- The redundant "Apply Style" button (`BUG-28`) has been cleanly removed from the text properties toolbar without affecting real-time styling updates.
- Song set list rows no longer expand from 48px to 86px upon edit (`BUG-29`).

However, two residual issues and regressions were identified during Round 5 manual QA:

1. **Deck Sequence Desktop Height Overshoot and Window Scrollbar Regression (`BUG-11` residual)**:
   In SPEC-15-02, setting `lg:max-h-none` on the Deck Sequence container inside an unconstrained CSS grid row (`grid lg:grid-cols-[330px_minmax(0,1fr)]`) eliminated the maximum height limit on desktop. Without an explicit height constraint on the parent or aside, Deck Sequence expanded indefinitely to fit all slide cards instead of triggering internal scrolling via `overflow-y-auto`. Consequently:
   - The Deck Sequence card overshot and extended far below the bottom edge of the canvas card.
   - The card lost internal scrolling behavior.
   - The entire web page expanded vertically, inducing an unwanted long window scrollbar on desktop displays.

2. **Song Set Top Card Header Vertical Expansion on Edit (`BUG-30`)**:
   In SPEC-15-04, switching edit mode to the top form card successfully preserved fixed 48px heights for list rows. However, when an operator clicks the edit icon on a song set entry with a descriptive title (e.g. `Bible Talk Opening Song`), the top card header renders `Edit Song Set: {title}` (or localized `Edit Set Lagu: {title}`). In the 330px sidebar column alongside the `EDITING` badge, this long string wraps onto multiple lines. This causes the top card to expand vertically (from ~132px to ~160px+), shifting the configured song sets list below it downward upon entering edit mode. Furthermore, in `src/lib/i18n/catalogue-id.ts`, `admin.songSets.editTitle` is currently untranslated (still in English).

## Solution

1. **Strict Desktop Viewport Height Containment for Deck Sequence (Ticket SPEC-16-01)**:
   In `ArtifactEditor.tsx`:
   - Replace `lg:max-h-none` with `lg:max-h-[calc(100vh-270px)]` on the Deck Sequence card.
   - Mathematical offset: Canvas shell max-height is `calc(100vh-310px)` with ~190px header/toolbar above it. The left sidebar has the "New Slide" card (~130px) + gap-4 (16px). Setting Deck Sequence to `lg:max-h-[calc(100vh-270px)]` bounds its bottom edge to align with the canvas bottom boundary on 1080p desktop viewports without overshooting.
   - Retain `ul className="space-y-1.5 overflow-y-auto pr-1 flex-1 min-h-0"` so that slide overflow is strictly contained and scrolls internally, preventing window scrollbars.
   - In `tests/artifact-editor-layout.test.mjs`, **replace** the existing positive assertion for `lg:max-h-none` with the new bounded constraint `lg:max-h-[calc(100vh-270px)]` and an absence guard for `lg:max-h-none`.

2. **Compact Single-Line Header for Song Set Edit Card (Ticket SPEC-16-02)**:
   In `SongSetEntriesPanel.tsx` and i18n dictionaries (`catalogue-en.ts`, `catalogue-id.ts`):
   - Simplify the edit card header label to a clean static title: `Edit Song Set` (EN) and `Edit Set Lagu` (ID) without appending `{title}`.
   - In `catalogue-id.ts`, resolve the pre-existing translation defect (translate from `'Edit Song Set: {title}'` to `'Edit Set Lagu'`).
   - Apply `truncate min-w-0 mr-2` to the header text span and `shrink-0` to the badge to ensure the header row remains strictly on a single line under all conditions.
   - In `tests/operator-shadcn-guard.test.mjs`, assert structural containment (`truncate`, `min-w-0`, `shrink-0`, and absence of `.replace('{title}'`) via block slicing (avoiding fragile regex on multi-line template literals).

## Tickets & Dependencies

The two tickets touch disjoint files and are completely independent (no blocking relationship):
- **SPEC-16-01** (`BUG-11`): `src/components/admin/ArtifactEditor.tsx` & `tests/artifact-editor-layout.test.mjs`. `blocked_by: []`.
- **SPEC-16-02** (`BUG-30`): `src/components/admin/SongSetEntriesPanel.tsx`, `src/lib/i18n/catalogue-en.ts`, `src/lib/i18n/catalogue-id.ts`, & `tests/operator-shadcn-guard.test.mjs`. `blocked_by: []`.

## User Stories

1. As an Admin viewing the Main Spine editor on a desktop browser, I want the Deck Sequence card to stop at or before the bottom boundary of the canvas with internal scrolling for slide items, so that the web page remains free of window scrollbars.
2. As an Admin editing a song set entry with a long title, I want the top edit card to maintain a compact single-row header and stable height, so that the song set list below it does not jump or shift when entering or exiting edit mode.

## Implementation Decisions

- **Architecture Invariants**: Complies with `AD-33` (shared canvas trio across song sets) and `DEC-014` (canvas discard-unsaved-changes).
- **Affected Modules**:
  - `src/components/admin/ArtifactEditor.tsx`: viewport height clamping for Deck Sequence on desktop (`lg:max-h-[calc(100vh-270px)]`).
  - `src/components/admin/SongSetEntriesPanel.tsx`: compact header and truncate styling for edit mode top card.
  - `src/lib/i18n/catalogue-en.ts` & `src/lib/i18n/catalogue-id.ts`: updated `admin.songSets.editTitle` without `{title}` placeholder, with Indonesian translation.
  - `tests/artifact-editor-layout.test.mjs`: layout tests asserting desktop height containment and absence of unconstrained expansion (`lg:max-h-none` removed).
  - `tests/operator-shadcn-guard.test.mjs`: tests verifying compact header and zero height shift in Song Set top card.

## Out of Scope

- Introducing modal dialogs or popovers for song set editing.
- Modifying canvas zoom or rendering pipeline.

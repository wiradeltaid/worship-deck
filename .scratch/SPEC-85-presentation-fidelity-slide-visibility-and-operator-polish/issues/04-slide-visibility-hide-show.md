# 04: Slide Hide/Show Visibility Control Across Run-Sheet, Presenter, and PPTX Export

**What to build:** Implement flexible slide hide/show visibility control across all service lifecycle surfaces:
1. Stable Identity & Persistence Contract:
   - In `src/lib/slide-plan.ts`, each slide item carries a stable `slide.id` (e.g. `hymn-1-v1`, `scripture`, `sermon-title`). Extend `SlidePlanItem` with `hidden?: boolean`.
   - In `internal/httpapi/services.go` and `internal/db/schema.sql`, support persisting `hidden_slide_ids: string[]` in the service record via `PATCH /api/services/:id`.
   - When compiling slide plans or hydrating presenter snapshots, set `slide.hidden = true` for any slide whose `id` exists in `hidden_slide_ids`. Reordering or regenerating the plan preserves hidden state for surviving slide IDs; deleted IDs cleanly lapse without error.
2. Run-Sheet Surface (`RunSheetPage.tsx` / `SlidePreviewGrid`):
   - In slide thumbnail cards, display a hover toggle button (Eye / EyeOff icon) allowing the operator to toggle visibility for any slide.
   - When a slide is marked hidden:
     - Render a semi-transparent scrim overlay and a clear `Hidden` badge on the thumbnail.
     - Persist the change via `PATCH /api/services/:id` or local service state.
3. Presenter Console Surface (`PresenterOperator.tsx`) & Navigation Semantics:
   - In the bottom thumbnail filmstrip, add hover visibility toggles, plus a console toolbar button for the active slide.
   - Visually mark hidden slides in the filmstrip and All Slides grid (`SlideGridDialog`).
   - **Linear Advance Skip Rule**: Arrow navigation (Next / Previous / Space / PageDown / PageUp) strictly skips hidden slides so they are never presented during live service playback.
   - **All-Hidden Boundary Case**: If all remaining slides in a direction are hidden, navigation halts at the current boundary without crashing.
   - **Active Slide Hide Mutation**: If the operator hides the slide that is currently projected, presenter automatically transitions the active index to the next visible slide (or previous if at the end) and projects it.
   - **Deliberate Selection / Jump**: If an operator clicks a hidden slide in the All Slides grid, prompt to "Unhide & Tampilkan" (or automatically unhides before projecting), guaranteeing a slide is NEVER projected while remaining marked hidden.
4. Auditorium Projector Surface (`ProjectorClient.tsx`):
   - Synchronize active non-hidden slide index via `present-channel.ts`.
   - Projector renders only the active visible slide.
5. PPTX Export Surface (`src/lib/pptx-draw.ts` / `workers/pptx/draw.mjs`):
   - In `renderArtifactSlide` / `addSlide`:
     - If `slide.hidden` is true, mark `slide.hidden = true` in PptxGenJS (generating native PowerPoint hidden slide attribute `<p:sld show="0">`).
     - If native hiding is unsupported in the export environment, omit the hidden slide from the generated deck.
     - Verification: Test must inspect the generated PPTX package and assert that `<p:sld show="0">` is present or the slide count equals visible slide count only.
6. Write automated unit and integration tests in `tests/slide-visibility-hide-show.test.mjs` verifying:
   - Slide visibility toggle in Run-Sheet and Presenter updates `hidden` state with stable slide IDs.
   - Linear navigation strictly skips hidden slides; all-hidden boundary does not crash.
   - Hiding the active slide auto-advances to the nearest visible slide.
   - PPTX export emits `<p:sld show="0">` or excludes hidden slides.
   - Absence/injection test proving that removing the navigation skip shows hidden slides during live advance.

Satisfies `FR-14`, `FR-16`, `UC-18`, `UC-20`, and `UC-21`.

**Blocked by:** `SPEC-85-01`, `SPEC-85-03`

**Status:** open

- [ ] Read `src/lib/slide-plan.ts`, `spa/src/pages/RunSheetPage.tsx`, `src/operator/present/PresenterOperator.tsx`, and `src/lib/pptx-draw.ts`.
- [ ] In `src/lib/slide-plan.ts` and `internal/httpapi/services.go`:
      - Add `hidden?: boolean` to `SlidePlanItem` and support `hidden_slide_ids` persistence.
- [ ] In `spa/src/pages/RunSheetPage.tsx`:
      - Add hover visibility toggle and `Hidden` badge on slide preview thumbnails.
- [ ] In `src/operator/present/PresenterOperator.tsx`:
      - Add visibility toggle to filmstrip and console.
      - Update keyboard/button navigation to skip hidden slides.
      - Handle active-slide hide transition and all-hidden boundary.
- [ ] In `src/lib/pptx-draw.ts`:
      - Set `slide.hidden = true` on hidden slides during PPTX generation.
- [ ] In `tests/slide-visibility-hide-show.test.mjs`:
      - Test slide visibility persistence with stable IDs and badge rendering.
      - Test linear advance skips hidden slides.
      - Test PPTX hidden slide generation.
      - Inject defect and prove absence guard fails.
- [ ] Run test suite with `node --import ./tests/register-ts-resolve.mjs --test tests/slide-visibility-hide-show.test.mjs` and `npm run typecheck`.

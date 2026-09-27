# 04: Presenter Transport Active Slide Hide Toggle & Two-Row Header Layout

**What to build:** In `src/operator/present/PresenterOperator.tsx`, reorganize operator console controls for stage clarity and ergonomics:
1. Transport Properties Bar Integration:
   - In the transport controls bar situated directly under the Current Slide preview monitor (adjacent to `Prev ←`, `Next →`, `Auto Loop`, `Blank screen`, and `Clear scripture`):
     - Relocate the existing active slide visibility toggle (`toggle-current-slide-visibility`) into this transport bar:
       ```tsx
       <Button
         type="button"
         variant={current?.hidden ? 'destructive' : 'outline'}
         size="sm"
         data-testid="transport-slide-visibility-toggle"
         disabled={activeSlides.length === 0}
         onClick={() => void toggleSlideVisibility(index)}
         className="h-8 gap-1.5 text-xs select-none"
         title={current?.hidden ? 'Unhide current slide' : 'Hide current slide'}
       >
         {current?.hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
         <span>{current?.hidden ? 'Unhide Slide' : 'Hide Slide'}</span>
       </Button>
       ```
   - In `FilmstripFrame` thumbnails:
     - Remove the small hover button `filmstrip-visibility-toggle` to keep the bottom filmstrip clean and uncluttered.
   - In the top-right header:
     - Remove the redundant `toggle-current-slide-visibility` button.
2. Top-Right Header Restructuring (Two Semantic Rows):
   - Restructure the top-right header controls into two distinct, cleanly stacked horizontal rows aligned to the right:
     - **Row 1 (Display & Audience Controls)**:
       - `All slides` button (`setGridOpen(true)`)
       - `Open congregation screen` button (`openProjector`)
       - `Remote code` pairing button (`setRemoteDialogOpen(true)`)
     - **Row 2 (Session Safety & Workflow Controls)**:
       - `OfflineReadinessBadge`
       - `Buka Kunci / Kunci Ibadah` button (`presentation-lock-toggle`)
       - `Edit Darurat (Lokal)` button (`emergency-edit-button`)
       - `Run-Sheet` navigation link button
3. Write automated unit and regression tests in `tests/presenter-header-two-row-layout.test.mjs` verifying:
   - Transport controls bar under Current Slide contains `transport-slide-visibility-toggle`.
   - Top-right console header renders Row 1 (Display & Audience) and Row 2 (Safety & Workflow).
   - Filmstrip thumbnails do not carry hover visibility toggle buttons.
   - Redundant top-right slide visibility button is removed.
   - Absence/injection test proving that merging all top-right buttons into a single flex row fails the two-row assertion.

Satisfies `FR-14`, `FR-16`, and `UC-12`.

**Blocked by:** `SPEC-86-01`

**Status:** done

- [x] Read `src/operator/present/PresenterOperator.tsx`.
- [x] In `src/operator/present/PresenterOperator.tsx`:
      - Move active slide visibility toggle into transport controls bar under Current Slide.
      - Remove visibility toggle button from `FilmstripFrame`.
      - Reorganize top-right header into Row 1 (Audience/Display) and Row 2 (Safety/Workflow).
- [x] In `tests/presenter-header-two-row-layout.test.mjs`:
      - Test transport controls bar contains slide visibility toggle.
      - Test top-right header two-row semantic structure.
      - Test absence of filmstrip thumbnail toggle button.
      - Inject defect and prove absence guard fails.
- [x] Run test suite with `node --import ./tests/register-ts-resolve.mjs --test tests/presenter-header-two-row-layout.test.mjs` and `npm run typecheck`.

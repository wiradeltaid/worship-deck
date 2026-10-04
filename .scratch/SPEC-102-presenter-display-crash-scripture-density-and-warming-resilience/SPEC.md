# SPEC-102 — Presenter Display Menu Crash Fix, Scripture Density Sizing, and Auto-Warming Resilience

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-24` (Room-Facing Screens Never Show Operator Controls; Operator Console Ergonomics)
  - `AD-29` (Presenter-Projector Cross-Window Liveness Handshake and Sync)
  - `AD-36` (Scripture & Hymn Offline Corpus Integrity)
- **Functional Requirements**:
  - `FR-14` (Offline Readiness Indicator & Resilience)
  - `FR-16` (Two-Screen Presenter View in the Browser)
  - `FR-19` (Auditorium Projector Output and Live Synchronization)
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync)
  - `UC-13` (On-Demand Verse Lookup)
- **Components**: `presenter`
- **Touches**: `present-channel`, `scripture`, `services`

---

## Problem Statement

During live testing and pre-service rehearsal of WorshipDeck on multi-monitor systems (post-SPEC-99/100 deployment), operators identified four critical UX and operational friction points:

1. **Uncaught Base UI Menu Crash on Dropdown Trigger (Screen Blackout)**:
   - When an operator clicks the chevron trigger button (`▾`) in `PresenterDisplayControl.tsx` to inspect or select display targets, the screen abruptly goes completely black (*blank screen-hitam*).
   - **Root Cause**: In `@base-ui/react/menu`, `DropdownMenuLabel` invokes `useMenuGroupRootContext()`. Because `<DropdownMenuLabel>` was placed directly inside `<DropdownMenuContent>` without an enclosing `<DropdownMenuGroup>`, Base UI throws an uncaught exception:
     `Error: Base UI: MenuGroupContext is missing. Menu group parts must be used within <Menu.Group> or <Menu.RadioGroup>.`
     Lacking an error boundary, React unmounts the entire Presenter component tree, leaving only the dark page background.

2. **Congregation Screen Launcher Inappropriately Disabled by Presentation Lock**:
   - The primary action button of `PresenterDisplayControl` (`Open as Window` / `Open on External Screen`) is disabled upon entering the presenter view.
   - **Root Cause**: `PresenterDisplayControl` receives `presentationLock={presentationLock}`, tying audience screen opening to session safety lock. Presentation lock exists to prevent accidental slide modifications or rundowns during live worship; opening and focusing the audience projection window is an essential read/display control that must remain accessible at all times. Live close of an active window while locked, however, must remain protected to prevent accidental blackout.

3. **Excessive Vertical Void in Scripture Presentation (Under-Filled Stage)**:
   - When presenting whole-chapter pages or multi-verse perikopes with moderate density (e.g. John 4:1-5 with 5 verses or 4:6-9 with 4 verses on a whole-chapter page), text occupies only ~37% of the stage height, leaving ~60% black empty space at top and bottom.
   - **Root Cause**: SPEC-100 locked `typographyMode === 'chapter'` rigidly to a fixed `4.8cqh` font size and `lineHeight: 1.28` across all slides. While safe against micro-font collapse on dense 10-line slides, on 4–6 line slides this creates excessive letterbox void, making scriptures appear small and unassertive from auditorium distances.

4. **Silent Failure in Scripture Auto-Warming & Ineffective Retry UX**:
   - Pre-service offline status badge shows `Degraded: 1 scripture(s) failed`. Clicking `Retry` flashes briefly but changes nothing and gives no explanatory feedback.
   - **Root Causes**:
     - Service rundown fields often contain translation annotations or suffixes (e.g. `"Hebrews 1:1, 2 (NKJV)"`, `"1 Korintus 13 (TB)"`).
     - Go's `scripture.ParseRef` rejects references with trailing parenthetical translation annotations before chapter/verse parsing, returning HTTP 404.
     - Frontend `extractRequiredScriptureRefs` does not sanitize placeholders (`"TBA"`, `"-"`, `"N/A"`) or strip translation annotations before query.
     - `warmServiceSnapshot()` counts scripture failures but does not persist `failed_scripture_refs` in IndexedDB `OfflineServiceSnapshot`; reloading the page drops the failure details and reverts to a generic degraded message.
     - `OfflineReadinessBadge.tsx` does not display which reference failed, and provides no toast notification or user feedback on retry outcome.

---

## Solution Architecture & Invariants

### 1. Robust Menu Grouping & Scoped Lock Decoupling (`PresenterDisplayControl.tsx`)
- In `PresenterDisplayControl.tsx`, wrap the header `<DropdownMenuLabel>` inside `<DropdownMenuGroup>` so Base UI `MenuGroupContext` is structurally satisfied without altering shared primitives.
- In `PresenterOperator.tsx`, allow opening, focusing, and target selection via `PresenterDisplayControl` even when `presentationLock` is active.
- To prevent accidental blackout mid-service, the destructive `Tutup Layar Jemaat` (`Close Projector`) action remains guarded or requires confirmation when `presentationLock` is active.

### 2. Scripture Visual-Density Scaling & Stage Height Budget (`scripture-scaling.ts`, `ScriptureOverlayView.tsx`)
- In `src/lib/scripture-format.ts`, attach `estimatedVisualLines` (calculated via `estimateScriptureLines`) to each `ScripturePageChunk`, and carry it in `ScriptureOverlay` across PresentChannel.
- In `src/lib/scripture-scaling.ts` (`getScriptureScaling`):
  - When `typographyMode === 'chapter'`, compute adaptive base font size from `estimatedVisualLines`:
    - 1–5 visual lines: base font **`6.0cqh`** (minHeight: `32cqh`)
    - 6–7 visual lines: base font **`5.4cqh`** (minHeight: `26cqh`)
    - 8–10 visual lines: base font **`4.8cqh`** (minHeight: `20cqh`)
- In `src/components/ScriptureOverlayView.tsx`:
  - Adjust `lineHeight` for chapter mode from `1.28` to **`1.36`**, improving visual breathing room and legibility from sanctuary seating.
  - Expand the verse container height budget to `max-h-[82cqh]` in CSS, and align `computeScriptureFitScale` height cap to `stageHeight * 0.82` (ensuring consistent containment and zero clipping without artificial 0.917 clamping).

### 3. Scripture Reference Normalization, Durable Diagnostics & Retry Feedback
- In `internal/scripture/match.go` (`ParseRef`):
  - Strip trailing parenthetical translation annotations (`(NKJV)`, `(TB)`, `(KJV)`, `(ESV)`, `(BIMK)`, `(AYT)`) and bare translation code suffixes before chapter/verse parsing.
- In `src/lib/offline/service-snapshot.ts`:
  - Filter out placeholder strings (`TBA`, `TBD`, `-`, `N/A`, `None`) in `extractRequiredScriptureRefs`.
  - Add `failed_scripture_refs: string[]` to `OfflineServiceSnapshot` in IndexedDB, and carry it into `OfflineReadiness.scriptures.failedRefs`.
  - Rehydrate `failed_scripture_refs` upon snapshot load in `OfflineReadinessBadge`.
- In `src/components/offline/OfflineReadinessBadge.tsx`:
  - Show tooltip detailing specific failed references (e.g. `Degraded: Failed to cache 'Hebrews 1:1, 2'`).
  - On "Retry" click, display explicit toast feedback (`sonner`) on outcome (success or specific failed reference), eliminating the silent failure experience.

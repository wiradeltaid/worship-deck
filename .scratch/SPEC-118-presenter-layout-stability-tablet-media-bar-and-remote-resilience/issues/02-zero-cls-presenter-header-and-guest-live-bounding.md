# SPEC-118-02 — Zero-CLS Presenter Header Layout Stabilization and Guest Live Bounded Geometry

**Satisfies:** [UC-12, UC-29, FR-16, FR-25]
**Blocked by:** ["SPEC-118-01"]
**Status:** closed

## Summary
Stabilize the presenter header layout in `PresenterOperator.tsx` and enforce bounded geometry in `PresenterGuestFeedControl.tsx`. Prevent guest live activation from expanding Row 3 and pulling upper action buttons (Row 1 & Row 2) leftward or triggering staggered wrap artifacts on compact screens, while strictly preserving all existing button purposes, labels, and interaction semantics.

## Key Responsibilities
1. **Decouple Row 3 from Upper Actions Flexbox (`src/operator/present/PresenterOperator.tsx`)**:
   - Currently, Row 1, Row 2, and Row 3 are stacked inside a single `presenter-header-actions` (`flex flex-col items-end gap-2`).
   - When Row 3 expands from ~300px to ~585px upon Guest Live, the entire flexbox widens, pulling Row 1 and Row 2 leftward.
   - Restructure the header so Row 1 and Row 2 form an independent right-aligned actions cluster, while Row 3 (Guest Media Feed) occupies its own dedicated sub-bar or is layout-isolated, preventing cross-row width coupling.
2. **Strict Preservation of Control UX & Buttons**:
   - The user explicitly instructed: *"Secara tombol2 sudah tepat, uiux tombol sudah tepat jangan diganggu lagi. Ini soal tampilan yang berpindah2 gak beraturan."*
   - Preserve all existing buttons (`Request Reopen`, `All slides`, `PresenterDisplayControl`, `Remote Code`, `Offline badge`, `Lock toggle`, `Emergency edit`, `Run sheet`, and Guest Feed buttons) in label, design, testid, and function.
   - Do NOT remove, rename, or suppress buttons; this ticket is strictly confined to layout containment, dimension bounding, and CLS elimination.
3. **Bounded Geometry for Guest Feed Controls (`src/operator/present/PresenterGuestFeedControl.tsx`)**:
   - Establish consistent container sizing between `ready` and `confirmed-live` states.
   - Prevent horizontal layout explosion when switching to `confirmed-live`.
   - Ensure the live pill `[Guest Live]` and action button `[Revert to Deck (Esc)]` fit within a predictable bounded width (max-w-[420px] on desktop/tablet, w-full on mobile).
4. **Zero Cumulative Layout Shift (CLS)**:
   - Transitioning between `idle` -> `arming` -> `ready` -> `guest-pending` -> `confirmed-live` must not shift the horizontal anchor or vertical baseline of Row 1 (`All slides`, `PresenterDisplayControl`, `Remote Code`) and Row 2 (`Lock`, `Offline badge`, `Emergency edit`, `Run sheet`).

## Acceptance Criteria
- Activating Guest Live (`confirmed-live`) does NOT push Row 1 or Row 2 buttons to the left.
- On tablet viewports (e.g. iPad Mini 768px–1024px) and mobile viewports, the header actions remain anchored without erratic staircase wrapping.
- Reverting to Deck (`Esc`) smoothly restores normal presentation state without jarring jumps.
- Automated tests in `tests/presenter-guest-feed-controls.test.mjs` and `tests/presenter-header-two-row-layout.test.mjs` pass cleanly.

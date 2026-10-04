# 03: Presenter Header Row 3 Relocation for Guest Video Controls

**Satisfies:** [UC-12, FR-16]
**Blocked by:** SPEC-107-02
**Status:** closed

**What to build:** In `src/operator/present/PresenterOperator.tsx`, `src/operator/present/PresenterGuestFeedControl.tsx`, and `tests/presenter-guest-feed-controls.test.mjs`:

1. **Relocate Guest Video Controls to Dedicated Row 3 (`presenter-header-row-3`)**:
   - In `src/operator/present/PresenterOperator.tsx`:
     - Remove `PresenterGuestFeedControl` from `data-testid="presenter-header-row-1"`.
     - In `data-testid="presenter-header-actions"`, add a dedicated third tier container:
       ```tsx
       {/* Row 3 (Guest Media & Live Capture Feed Controls) */}
       {guestFeedControllerRef.current && (
         <div data-testid="presenter-header-row-3" className="flex flex-wrap items-center justify-end gap-2 w-full">
           <PresenterGuestFeedControl
             controller={guestFeedControllerRef.current}
             isProjectorResponding={liveness.verdict === 'live'}
           />
         </div>
       )}
       ```
   - Ensure Row 1 retains clean spacing for `All Slides`, `PresenterDisplayControl`, and `Remote Code` pairing button.
   - Ensure Row 2 retains clean spacing for `OfflineReadinessBadge`, `Presentation Lock`, `Emergency Edit`, and `Blank Screen`.
   - Ensure Row 3 allows the device picker dropdown, status badges (Ready, Waiting Projector, Live), and action buttons (Arm, Disarm, Switch to Guest, Revert to Deck) to expand naturally without wrapping awkwardly or squishing adjacent controls.

2. **Automated Unit & Guard Tests**:
   - In `tests/presenter-guest-feed-controls.test.mjs`:
     - Update structural scan test: verify that `PresenterGuestFeedControl` is present in `presenter-header-row-3` and absent from `presenter-header-row-1` and `presenter-header-row-2`.
     - Verify absence guards trigger if `PresenterGuestFeedControl` is placed in row 1 or row 2.

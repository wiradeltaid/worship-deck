# 02: Adaptive Blank Screen Blackout and Unblank Transition Implementation

**Satisfies:** [UC-12, FR-16, AD-23]
**Blocked by:** SPEC-108-01
**Status:** open

**What to build:** In `src/projected/ProjectorClient.tsx`:

1. **Consume Canonical Blank Transition Helper**:
   - In `src/projected/ProjectorClient.tsx`, import `getBlankTransitionStyle` from `@/lib/transitions`.
   - Update the blackout layer container:
     ```tsx
     <div
       aria-hidden="true"
       data-testid="projector-blank-layer"
       className="absolute inset-0 z-50 bg-black pointer-events-none"
       style={getBlankTransitionStyle(transition, blank)}
     />
     ```
   - Eliminate hardcoded `transition-opacity duration-300` class and hardcoded inline styles.

2. **Verify Instant Cut & Fade Blackout on Both Blank and Unblank**:
   - When `transition === 'cut'` or `'none'`, verify that `blank` state immediately toggles visibility/opacity without CSS transition lag (0ms response) for both blanking (`blank = true`) and unblanking (`blank = false`).
   - When `transition === 'fade'`, `'dissolve'`, or `'push'`, verify smooth 300ms opacity fade to black on blanking, and smooth 300ms opacity restore on unblanking without layout shifts, transform anomalies, or interference with underlying slide and overlay elements (FR-16).

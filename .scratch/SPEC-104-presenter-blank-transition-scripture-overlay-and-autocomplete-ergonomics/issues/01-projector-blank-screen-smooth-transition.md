# 01: Projector Blank Screen Smooth Transition

**Satisfies:** [UC-12, FR-16, FR-19]
**Blocked by:** none
**Status:** done

**What to build:** In `src/projected/ProjectorClient.tsx` and `tests/projected-transitions.test.mjs`:

1. **Smooth Blackout Transition Layer**:
   - In `src/projected/ProjectorClient.tsx`:
     - Replace the conditional `{blank ? <div aria-hidden="true" className="absolute inset-0 z-50 bg-black" /> : null}` with a persistent, transitioning overlay element:
       ```tsx
       <div
         aria-hidden="true"
         data-testid="projector-blank-layer"
         className={`absolute inset-0 z-50 bg-black transition-opacity duration-300 ease-in-out pointer-events-none ${
           blank ? 'opacity-100' : 'opacity-0'
         }`}
       />
       ```
     - Ensure the blackout overlay is positioned at `z-50`, above all slide layers (`z-0..10`), scripture overlay (`z-20`), guest feed containers (`z-30`), and onboarding guidance banners (`z-40`).
     - When `blank` becomes true, the overlay smoothly transitions from `opacity-0` to `opacity-100` over 300ms.
     - When `blank` becomes false, the overlay smoothly transitions from `opacity-100` to `opacity-0` over 300ms.
     - Ensure underlying slides, scripture overlays, and playback state remain unperturbed underneath the blanking layer per UC-12 and BR-6.

2. **Automated Unit & Guard Tests with Component / DOM Test Harness**:
   - In `tests/projected-transitions.test.mjs`:
     - Mount or simulate `ProjectorClient` shell and inspect `[data-testid="projector-blank-layer"]`:
       - Assert the layer is present with `transition-opacity duration-300 ease-in-out` and `pointer-events-none`.
       - Assert that when `blank` is false, `opacity-0` is present.
       - Assert that when `blank` is true, `opacity-100` is present.
       - Assert that slide index advancement while blanked leaves the blackout overlay at `opacity-100` without unmounting.

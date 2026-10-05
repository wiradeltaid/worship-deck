# 02: Seamless Crossfade Backdrop Styling and Helper Functions

**Satisfies:** [UC-12, UC-13, FR-16, FR-19, AD-23]
**Blocked by:** SPEC-109-01
**Status:** closed

**What to build:** In `src/lib/transitions.ts` and `src/components/ScriptureOverlayView.tsx`:

1. **Dedicated Phase Union & Backdrop Transition Style Helper**:
   - In `src/lib/transitions.ts`:
     - Export dedicated phase type:
       ```ts
       export type ScriptureBackdropPhase = 'hidden' | 'entering-start' | 'active' | 'exiting';
       ```
     - Export helper function:
       ```ts
       export function getScriptureBackdropStyle(
         transition: SlideTransition,
         phase: ScriptureBackdropPhase
       ): TransitionLayerStyle
       ```
     - Invariants derived directly from `SLIDE_TRANSITION_SPECS` (AD-23):
       - If `phase === 'hidden'`: returns `{ opacity: 0, visibility: 'hidden' }` (or `{ display: 'none' }` / empty when unmounted).
       - Read canonical `durationMs` and `easing` from `SLIDE_TRANSITION_SPECS[transition]`:
         - For `none` / `cut` (`durationMs === 0`): returns `{ opacity: 1, visibility: 'visible', transition: 'none' }`.
         - For `fade` / `dissolve` (`durationMs === 500ms`):
           - `entering-start`: `{ opacity: 0, visibility: 'visible' }`.
           - `active`: `{ opacity: 1, visibility: 'visible', transition: 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)' }`.
           - `exiting`: `{ opacity: 0, visibility: 'visible', transition: 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)' }`.
         - For `push` (`durationMs === 450ms`):
           - The backdrop adapts to opacity fade (preventing sliding black seams) using canonical push duration:
           - `entering-start`: `{ opacity: 0, visibility: 'visible' }`.
           - `active`: `{ opacity: 1, visibility: 'visible', transition: 'opacity 450ms cubic-bezier(0.4, 0, 0.2, 1)' }`.
           - `exiting`: `{ opacity: 0, visibility: 'visible', transition: 'opacity 450ms cubic-bezier(0.4, 0, 0.2, 1)' }`.

2. **Overlay View Background Ownership & Coordination**:
   - In `src/components/ScriptureOverlayView.tsx`:
     - Retain `bg-[#0B1220]` on the root element so standalone consumers (e.g. presenter slide previews, emergency canvas editor) retain visual fidelity without needing a separate backdrop.
     - In the projector client, mounting the persistent backdrop at `z-20` beneath the crossfading overlay layers guarantees continuous opacity: as outgoing fades $1 \to 0$ and incoming fades $0 \to 1$, the persistent `#0B1220` backdrop prevents the underlying slide from bleeding through.

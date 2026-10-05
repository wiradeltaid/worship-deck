# 01: Canonical Scripture and Blank Transition Style Definitions

**Satisfies:** [UC-12, FR-16, AD-23]
**Blocked by:** none
**Status:** open

**What to build:** In `src/lib/transitions.ts`:

1. **Type Definitions & Function Signatures**:
   - Export types `ScriptureTransitionPhase = 'entering-start' | 'active' | 'exiting'` and `ScripturePageDirection = 'next' | 'prev' | 'initial' | 'same-page'`.
   - Export helper function `getScriptureTransitionStyle(transition: SlideTransition, phase: ScriptureTransitionPhase, direction?: ScripturePageDirection): TransitionLayerStyle`.
   - Export helper function `getBlankTransitionStyle(transition: SlideTransition, blank: boolean): TransitionLayerStyle`.

2. **Transition Rules & Styling Invariants Derived from `SLIDE_TRANSITION_SPECS`**:
   - For `none` and `cut` (`durationMs === 0`):
     - Scripture returns `{}` (instantaneous, no transition property or delay).
     - Blank returns `{ opacity: blank ? 1 : 0, visibility: blank ? 'visible' : 'hidden', transition: 'none' }`.
   - For `fade` and `dissolve`:
     - Reads canonical `durationMs` (500ms) and `easing` (`cubic-bezier(0.4, 0, 0.2, 1)`):
       - `entering-start`: `{ opacity: 0 }`
       - `active`: `{ opacity: 1, transition: 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)' }`
       - `exiting`: `{ opacity: 0, transition: 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)' }`
     - Blank (Authorized A/V Blackout Policy):
       - Uses smooth 300ms fade for blanking and unblanking: `{ opacity: blank ? 1 : 0, visibility: blank ? 'visible' : 'hidden', transition: 'opacity 300ms ease-in-out, visibility 300ms ease-in-out' }`.
   - For `push`:
     - Reads canonical `durationMs` (450ms) and `easing` (`cubic-bezier(0.4, 0, 0.2, 1)`):
       - If `direction === 'next'` or `direction === 'initial'`:
         - `entering-start`: `{ transform: 'translateX(100%)' }`
         - `active`: `{ transform: 'translateX(0)', transition: 'transform 450ms cubic-bezier(0.4, 0, 0.2, 1)' }`
         - `exiting`: `{ transform: 'translateX(-100%)', transition: 'transform 450ms cubic-bezier(0.4, 0, 0.2, 1)' }`
       - If `direction === 'prev'`:
         - `entering-start`: `{ transform: 'translateX(-100%)' }`
         - `active`: `{ transform: 'translateX(0)', transition: 'transform 450ms cubic-bezier(0.4, 0, 0.2, 1)' }`
         - `exiting`: `{ transform: 'translateX(100%)', transition: 'transform 450ms cubic-bezier(0.4, 0, 0.2, 1)' }`
       - If `direction === 'same-page'`:
         - Crossfades opacity in-place:
           - `entering-start`: `{ opacity: 0 }`
           - `active`: `{ opacity: 1, transition: 'opacity 450ms cubic-bezier(0.4, 0, 0.2, 1)' }`
           - `exiting`: `{ opacity: 0, transition: 'opacity 450ms cubic-bezier(0.4, 0, 0.2, 1)' }`
     - Blank (Adaptive A/V Guard):
       - Adapts to opacity fade: returns `{ opacity: blank ? 1 : 0, visibility: blank ? 'visible' : 'hidden', transition: 'opacity 300ms ease-in-out, visibility 300ms ease-in-out' }` rather than sliding a black block across the screen.

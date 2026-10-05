# SPEC-109 — Scripture Overlay Pagination Crossfade Backdrop Continuity Parity

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-23` (Single Shared Transition Definition Across PPTX and Browser Surfaces) — Scripture and backdrop crossfades derive duration and easing directly from `SLIDE_TRANSITION_SPECS`.
  - `AD-24` (Operator Chrome State Is Browser-Local, and Room-Facing Surface Is Closed to It) — Preserved; room-facing display remains pure without leaking operator chrome.
  - `AD-29` (The Projector Reports Its Own Liveness and Nothing Else, and One Predicate Decides It) — Wire protocol and heartbeat liveness unaffected.
- **Functional Requirements**:
  - `FR-16` (Two-Screen Presenter View in the Browser) — Underlying slide remains protected and steady during scripture presentation.
  - `FR-19` (Scripture Search and Presentation) — Navigating multi-page scripture passages (prev/next) crossfades text smoothly without leaking the background slide.
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync) — Projector reload and first sync with active scripture mounts directly as active without playing entrance animations.
  - `UC-13` (Scripture Projection and Multi-Verse Presentation) — Scripture presentation remains opaque and continuous across verse and page navigation.
- **Components**: `presenter`
- **Touches**: `present-channel` (Projector client scripture overlay rendering, persistent backdrop lifecycle, and crossfade opacity continuity)

---

## Problem Statement

During live sanctuary A/V verification on dev (`https://presenter-dev.bic.my.id/present`) following SPEC-108, hand testing revealed a visual glitch during multi-page scripture pagination under `fade` and `dissolve` transitions:

1. **Crossfade Alpha Bleed / Underlying Slide Flash**:
   - When the operator is on a presentation slide (e.g. an "Opening Prayer" or worship song slide) and pushes Scripture Page 1 to screen, the scripture overlay is visible with a dark background (`#0B1220`).
   - When the operator advances to Page 2 (`next` page) in `push`, `cut`, or `none` transition modes, the transition executes cleanly without revealing the underlying slide.
   - However, in `fade` and `dissolve` transition modes, navigating between scripture pages (page 1 $\to$ page 2 or page 2 $\to$ page 1) causes the underlying "Opening Prayer" slide to flash or bleed into view briefly before settling on Page 2.

2. **Root Cause Analysis**:
   - Each scripture overlay element (`outgoingOverlay` and `activeOverlay`) currently encapsulates its own solid container background (`bg-[#0B1220]`).
   - During `fade` / `dissolve` pagination, `outgoingOverlay` transitions opacity from $1 \to 0$ over 500ms while `activeOverlay` transitions opacity from $0 \to 1$ over 500ms.
   - Because opacity is multiplicative across overlapping layers, at the midpoint ($t = 250\text{ms}$), both layers have $\approx 0.5$ opacity. Their combined alpha coverage drops to $1 - (1-0.5)^2 = 0.75$, allowing $25\%$ of the underlying slide (and bright slide elements) to shine through the dark scripture presentation.
   - In contrast, during `push`, both layers remain at `opacity: 1` throughout the horizontal slide animation, keeping the underlying slide completely occluded.

---

## Solution Architecture & Invariants

### 1. Persistent Scripture Backdrop Layer (`src/projected/ProjectorClient.tsx`)
- Introduce a dedicated scripture backdrop layer at `z-20` positioned directly beneath active and outgoing scripture overlays:
  ```tsx
  <div
    data-testid="projector-scripture-backdrop"
    className="absolute inset-0 z-20 bg-[#0B1220] pointer-events-none"
    style={getScriptureBackdropStyle(transition, backdropPhase)}
  />
  ```
- **Lifecycle & Invariants**:
  - `backdropPhase: 'hidden' | 'entering-start' | 'active' | 'exiting'`.
  - **Initial Sync / Reload (UC-12 Invariant)**: When the projector mounts or syncs with pre-existing active scripture (`isInitialSyncRef.current = true`), both overlay and backdrop mount immediately as `'active'` without playing an entrance animation.
  - **User-Triggered Entrance** (`!currentActive \to newScripture`): Backdrop enters alongside scripture overlay (fades in from 0 to 1 over canonical `durationMs`, or cuts in instantly if `durationMs === 0`).
  - **Pagination / Page Navigation** (`currentActive \to newScripture` where both exist): Backdrop **remains fully active (`opacity: 1`) without re-animating, dropping opacity, or resetting timers**. Only the scripture content crossfades over the steady backdrop, completely eliminating alpha bleed onto the underlying slide.
  - **Clear / Exit** (`clearScriptureOverlay`): Backdrop exits alongside scripture overlay (fades out from 1 to 0 over canonical `durationMs`, or cuts out instantly if `durationMs === 0`), cleanly revealing the underlying presentation slide.
  - **Timer Cleanup**: Dedicated `backdropTimerRef` integrated into all cancellation and teardown paths (rapid clicks, clear mid-transition, stale-plan handling, effect cleanup, and component unmount).

### 2. Scripture Overlay Styling & Transition Parity (`src/components/ScriptureOverlayView.tsx`, `src/lib/transitions.ts`)
- Ensure `ScriptureOverlayView` and `getScriptureBackdropStyle` cleanly layer content over the persistent backdrop:
  - Define `export type ScriptureBackdropPhase = 'hidden' | 'entering-start' | 'active' | 'exiting'` in `src/lib/transitions.ts`.
  - Provide helper `getScriptureBackdropStyle(transition, phase)` deriving `durationMs` and `easing` directly from `SLIDE_TRANSITION_SPECS`:
    - `none` / `cut`: 0ms instant visibility swap.
    - `fade` / `dissolve`: 500ms opacity transition (`opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)`).
    - `push`: 450ms opacity transition (`opacity 450ms cubic-bezier(0.4, 0, 0.2, 1)`) so the backdrop cleanly fades on entrance/exit matching push duration.
  - `ScriptureOverlayView` retains its `#0B1220` styling for standalone preview consumers, while in the projector view the persistent backdrop guarantees continuous opacity during pagination.

### 3. Automated Guard & Regression Suite (`tests/projected-transitions.test.mjs`)
- Update `tests/projected-transitions.test.mjs`:
  - Assert that `projector-scripture-backdrop` is mounted whenever scripture is active.
  - Assert that during `next` and `prev` pagination under `fade` and `dissolve`, the backdrop remains steadily active (`opacity: 1`) without entering `entering-start` or `exiting`.
  - Assert reload/initial sync mounts directly to `active` without entrance animation.
  - Assert that `none` and `cut` continue to perform instantaneous 0ms swaps.
  - Assert that `push` derives canonical 450ms timing.
  - Assert rapid pagination and clear cancellation paths leave zero stranded timers or ghost layers.
  - Include absence defect injection proof: removing backdrop causes pagination continuity assertion failure.

---

## Tickets in Scope

1. **`SPEC-109-01`**: Persistent Scripture Backdrop Layer & Lifecycle Continuity in `src/projected/ProjectorClient.tsx`.
2. **`SPEC-109-02`**: Seamless Crossfade Backdrop Styling & Helper Functions in `src/lib/transitions.ts` & `src/components/ScriptureOverlayView.tsx`.
3. **`SPEC-109-03`**: Automated Backdrop Continuity & Scripture Pagination Crossfade Regression Suite in `tests/projected-transitions.test.mjs`.

# SPEC-108 — Scripture Overlay and Blank Screen Display Transition Parity

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-23` (Single Shared Transition Definition Across PPTX and Browser Surfaces) — Scripture derives duration, property, and easing directly from `SLIDE_TRANSITION_SPECS`.
  - `AD-24` (Operator Chrome State Is Browser-Local, and Room-Facing Surface Is Closed to It) — Preserved; transition parameters remain purely visual without leaking operator chrome.
  - `AD-29` (The Projector Reports Its Own Liveness and Nothing Else, and One Predicate Decides It) — Wire protocol and heartbeat liveness unaffected.
- **Decisions**:
  - `DEC-088` & `DEC-093` (Guest Video Capture Native Binding, Header Row 3 Tiering, and Transition Parity) — Extended to cover remaining projector surfaces.
- **Functional Requirements**:
  - `FR-16` (Two-Screen Presenter View in the Browser) — Both blanking and unblanking occur without losing slide position or display state.
  - `FR-19` (Scripture Search and Presentation) — Showing, multi-page pagination, and clearing scripture conform to display transitions.
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync)
  - `UC-13` (Scripture Projection and Multi-Verse Presentation)
- **Components**: `presenter`
- **Touches**: `present-channel` (Wire protocol preserved; scripture overlay lifecycle, bidirectional push pagination, and adaptive blackout transition parity hardened)

---

## Problem Statement

During live A/V verification on dev (`https://presenter-dev.bic.my.id/present`) following SPEC-107, an audit of display transitions against the Presenter Console's **Live Transition** setting (`none`, `cut`, `fade`, `dissolve`, `push`) revealed that while slide transitions and guest video capture transitions (`SPEC-107`) faithfully conform to `SLIDE_TRANSITION_SPECS`, two major sanctuary presentation surfaces remain decoupled and hardcoded:

1. **Scripture Overlay Transitions Disconnect (`ProjectorClient.tsx`)**:
   - In `ProjectorClient.tsx`, pushing scripture to screen (`applyScriptureOverlay`), clearing scripture (`clearScriptureOverlay`), and flipping pages (multi-verse pagination crossfade) are hardcoded to Tailwind `transition-opacity duration-300 ease-in-out` with a fixed `setTimeout(..., 300)` timer.
   - When the operator configures a hard **Cut** (`cut` or `none`), scripture still fades in and out slowly over 300ms instead of popping on/off screen cleanly and instantly.
   - When the operator configures **Push**, scripture does not slide or push across the display; it merely fades opacity over 300ms.
   - In multi-page scriptures (e.g. Chapter or long verse ranges), advancing to the next page or returning to the previous page always crossfades opacity, lacking bidirectional push motion (next page pushes left, previous page pushes right).
   - Furthermore, the hardcoded 300ms violates `AD-23`'s canonical timing table where `fade`/`dissolve` uses 500ms and `push` uses 450ms.

2. **Blank Screen Transition Disconnect & A/V Ergonomics (`ProjectorClient.tsx`)**:
   - The emergency blackout blanking layer (`data-testid="projector-blank-layer"` at `z-50`) is hardcoded to `transition-opacity duration-300 ease-in-out` and inline `transition: opacity 300ms ease-in-out, visibility 300ms ease-in-out`.
   - When an operator selects `cut` or `none` for urgent live cuts or fast-paced modern worship sets, the blank screen still lags with a 300ms fade on both blanking and unblanking.
   - Conversely, sliding a literal black box across the sanctuary screen during a `push` transition creates a bizarre, unprofessional visual effect (resembling an off-kilter garage door). In professional worship presentation software (ProPresenter, EasyWorship), blackout is strictly an instantaneous cut or an opacity fade to black.

---

## Solution Architecture & Invariants

### 1. Canonical Scripture & Blank Transition Style Functions (`src/lib/transitions.ts`)
- Define canonical transition helpers in `src/lib/transitions.ts` extending `AD-23`:
  ```ts
  export type ScriptureTransitionPhase = 'entering-start' | 'active' | 'exiting';
  export type ScripturePageDirection = 'next' | 'prev' | 'initial' | 'same-page';

  export function getScriptureTransitionStyle(
    transition: SlideTransition,
    phase: ScriptureTransitionPhase,
    direction?: ScripturePageDirection
  ): TransitionLayerStyle;

  export function getBlankTransitionStyle(
    transition: SlideTransition,
    blank: boolean
  ): TransitionLayerStyle;
  ```
- **Invariants for Scripture**:
  - Derived directly from `SLIDE_TRANSITION_SPECS[transition]`:
    - `none` / `cut` (`durationMs === 0`): Instantaneous 0ms cut. No CSS transition property; enters directly as active, exits immediately.
    - `fade` / `dissolve`: Smooth opacity crossfade over canonical `durationMs` (500ms) with canonical `EASING` (`cubic-bezier(0.4, 0, 0.2, 1)`).
    - `push` (`durationMs = 450ms`, canonical `EASING`):
      - **Entrance** (`entering-start` $\to$ `active`): Slides in from right (`translateX(100%)` $\to$ `translateX(0)`).
      - **Exit** (`exiting`): Slides out to left (`translateX(0)` $\to$ `translateX(-100%)`).
      - **Pagination**:
        - `next` (page $N \to N+1$): Incoming starts at `translateX(100%)` $\to$ `translateX(0)`; Outgoing starts at `translateX(0)` $\to$ `translateX(-100%)`.
        - `prev` (page $N \to N-1$): Incoming starts at `translateX(-100%)` $\to$ `translateX(0)`; Outgoing starts at `translateX(0)` $\to$ `translateX(100%)`.
        - `same-page`: When content changes while on the same page index, crossfades opacity in-place over canonical duration, avoiding unwanted horizontal displacement.
- **Invariants for Blank Screen (Authorized A/V Blackout Policy)**:
  - If `transition === 'none'` or `transition === 'cut'`: Instant cut to black on blanking, instant restore on unblanking (`durationMs = 0`, immediate visibility and opacity swap without animation lag).
  - If `transition === 'fade'`, `'dissolve'`, or `'push'`: Smooth opacity fade to black over 300ms on blanking, and smooth opacity restore over 300ms on unblanking (`transition: opacity 300ms ease-in-out, visibility 300ms ease-in-out`). Push transitions adapt to opacity fade to prevent sliding black slabs over sacred slides. Underlying slide position, scripture overlay state, and video streams remain completely unperturbed (FR-16).

### 2. Projector Client Scripture State Machine Refactoring (`ProjectorClient.tsx`)
- Enhance `applyScriptureOverlay` and `clearScriptureOverlay`:
  - Detect pagination direction and idempotency:
    - Compare incoming `msg.scripture` against `activeOverlayRef.current`:
      - If identical reference, text, and page: Idempotent no-op (do not trigger re-render or re-animation).
      - If `!activeOverlayRef.current`: direction is `'initial'`.
      - If `incoming.currentPage === active.currentPage`: direction is `'same-page'`.
      - If `incoming.currentPage > active.currentPage`: direction is `'next'`.
      - If `incoming.currentPage < active.currentPage`: direction is `'prev'`.
  - Read dynamic duration `const durationMs = SLIDE_TRANSITION_SPECS[transition]?.browser.durationMs ?? 0`.
  - If `durationMs === 0`: mount/unmount synchronously without timers.
  - If animated: schedule two-phase animation (`entering-start` with 20ms rAF/setTimeout $\to$ `active`) and exit timer for `outgoingOverlay` matching canonical `durationMs`.
  - Cleanly cancel all timers upon rapid click interruptions (`applyScriptureOverlay` / `clearScriptureOverlay` re-invocations).

### 3. Automated Guard & Regression Suite
- Update `tests/projected-transitions.test.mjs`:
  - Replace legacy assertions that checked for static `duration-300` Tailwind classes.
  - Assert `none`/`cut`:
    - Verify Scripture overlay mounts with opacity 1 and 0ms duration immediately.
    - Verify Blank layer cuts to black and unblanks with 0ms duration.
  - Assert `fade`/`dissolve`:
    - Verify opacity 0 to 1 entrance, 1 to 0 exit, and crossfade between pages over canonical 500ms.
  - Assert `push`:
    - Verify `translateX(100%)` on next page and `translateX(-100%)` on previous page over canonical 450ms.
    - Verify `same-page` updates crossfade without horizontal translation.
    - Verify Blank screen adapts to opacity fade instead of transform translate.
  - Verify rapid interruption cancellation (re-sync, quick paging) leaves zero ghost text or stranded timers.

---

## Tickets in Scope

1. **`SPEC-108-01`**: Canonical Scripture and Blank Transition Style Definitions in `src/lib/transitions.ts`.
2. **`SPEC-108-02`**: Adaptive Blank Screen Blackout and Unblank Transition Implementation in `src/projected/ProjectorClient.tsx`.
3. **`SPEC-108-03`**: Bidirectional Scripture Overlay Push, Page Navigation, and Exit Transition Parity in `src/projected/ProjectorClient.tsx`.
4. **`SPEC-108-04`**: Automated Motion, Bidirectional Navigation, and Interruption Guard Suite in `tests/projected-transitions.test.mjs`.

# SPEC-104 — Presenter Projector Blank Transition, Scripture Overlay Animation, and Autocomplete Ergonomics

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-24` (`.how/_platform/ARCHITECTURE-SPINE.md:206`: Operator Chrome State Is Browser-Local, and Room-Facing Surface Is Closed to It)
  - `AD-29` (`.how/_platform/ARCHITECTURE-SPINE.md:256`: Projector Reports Own Liveness and Nothing Else, One Predicate Decides It)
- **Functional Requirements**:
  - `FR-16` (`.control/registry/requirements-operator-turn.yaml`: Two-Screen Presenter View in the Browser)
  - `FR-19` (`.control/registry/requirements-operator-turn.yaml`: Auditorium Projector Output and Live Synchronization)
- **Use Cases**:
  - `UC-12` (`.what/presenter/04-usecases/UC-12-two-screen-presenter.md`: Two-Screen Presenter: Operator Console Controls and Projector Sync)
  - `UC-13` (`.what/presenter/04-usecases/UC-13-on-demand-verse.md`: On-Demand Verse Lookup)
- **Components**: `presenter`
- **Touches**: `present-channel`, `scripture`

---

## Problem Statement

During live testing and rehearsal of WorshipDeck dev (`https://presenter-dev.bic.my.id`), operators reported three usability, visual presentation, and ergonomics defects:

1. **Abrupt Blackout on Blank Screen (Missing Transition)**:
   - When the operator clicks "Blank Screen" in the presenter interface, the congregation projector screen immediately snaps to pitch black with a hard cut instead of smoothly fading to blank. Similarly, unblanking snaps back immediately.
   - **Root Cause**: In `src/projected/ProjectorClient.tsx`, blanking is rendered as a conditional unstyled cut (`{blank ? <div aria-hidden="true" className="absolute inset-0 z-50 bg-black" /> : null}`). The blackout element is abruptly mounted and unmounted without CSS opacity transition or timing parameters.

2. **Abrupt Scripture Overlay Entrance & Exit (Missing Transition)**:
   - When the operator pushes an on-demand scripture verse to the congregation screen or clears the active scripture, the DOM immediately swaps between `SlideView` and `ScriptureOverlayView` without visual transition.
   - **Root Cause**: `ProjectorClient.tsx` delegates slide transitions exclusively to `useSlideTransition` (which only animates on slide `index` changes via `goTo`). When `msg.type === 'scripture'` arrives, `setOverlay(...)` is called and React immediately mounts `ScriptureOverlayView` in place of `SlideView` inside the incoming slide container. When `msg.type === 'clear-scripture'` arrives, `setOverlay(null)` immediately removes it. There is no transition layer, entrance animation, or exit animation for scripture overlays.

3. **Scripture Autocomplete Lacks Keyboard Selection and Persists When Specifying Chapter/Verse**:
   - In the scripture reference input box, typing a prefix like `mat` opens a dropdown list of book suggestions, but operators cannot navigate the list using `ArrowDown` or `ArrowUp` keys or select a highlighted item with `Enter`.
   - When the operator has already entered a complete book name followed by a chapter number (e.g. `Matthew 4`), the autocomplete dropdown still appears and displays book suggestions (such as `Matthew`), distracting the operator and obscuring input. If clicked, it overwrites the chapter number with just the book name.
   - **Root Cause**:
     - `src/components/ScriptureRefAutocomplete.tsx` does not implement keydown handling for `ArrowDown`, `ArrowUp`, `Enter`, or `Escape`. The input's `onKeyDown` prop is forwarded directly to the parent form or presentation shortcuts.
     - `looksComplete(ref)` in `ScriptureRefAutocomplete.tsx` only returns true when a colon followed by a digit is present (`/:\s*\d/.test(ref)`). It fails to recognize that once a book name and chapter number are present (e.g. `Matthew 4`), the book selection phase is complete.
     - In `internal/scripture/match.go`, `SuggestBooks` strips trailing numbers when length >= 2 (`strings.Join(fields[:len(fields)-1], " ")`), so querying with `Matthew 4` strips `4`, matches `matthew`, and returns `Matthew` as a suggested book.

---

## Solution Architecture & Invariants

### 1. Projector Smooth Blackout Overlay Transition
- In `src/projected/ProjectorClient.tsx`:
  - Replace the conditional mounting `{blank ? <div ... /> : null}` with a persistent, non-blocking blackout overlay layer:
    ```tsx
    <div
      aria-hidden="true"
      data-testid="projector-blank-layer"
      className={`absolute inset-0 z-50 bg-black transition-opacity duration-300 ease-in-out pointer-events-none ${
        blank ? 'opacity-100' : 'opacity-0'
      }`}
    />
    ```
  - When `blank` is toggled true, the blackout layer smoothly fades in to full opacity over 300ms.
  - When `blank` is toggled false, the blackout layer smoothly fades out to zero opacity over 300ms.
  - Preserves underlying slide and overlay mounting and state (UC-12, BR-6, OQ-25), ensuring no slide repositioning or DOM unmounting occurs during blackout.

### 2. Scripture Overlay Lifecycle and Animated Transitions
- In `src/projected/ProjectorClient.tsx`:
  - **Decoupled Layer Architecture**: Keep the underlying `<SlideView>` continuously mounted in the slide container (`z-0..10`). Render the scripture overlay in a dedicated container positioned above the slide view at `z-20`.
  - **Layer Precedence Invariant**:
    - `Slides` (`z-0..10`) < `Scripture Overlay` (`z-20`) < `Guest Video` (`z-30`) < `Fullscreen Guidance Hint` (`z-40`) < `Emergency Blackout Overlay` (`z-50`).
    - When guest video is active (`isGuestIntent && guestStream`), it renders above scripture overlay (`z-30`). Blackout overlay (`z-50`) covers all layers.
  - **Scripture Animation Lifecycle State Machine**:
    - Maintain `activeOverlay: ScriptureOverlay | null`, `exitingOverlay: ScriptureOverlay | null`, and `overlayPhase: 'hidden' | 'entering' | 'active' | 'exiting'`.
    - **Arrival (`msg.type === 'scripture'`)**:
      - If no active overlay: Set `activeOverlay = msg`, set `overlayPhase = 'entering'`, and next frame promote to `'active'` with CSS `transition-opacity duration-300 ease-in-out` (`opacity-0` -> `opacity-100`).
      - If already active (replacement verse): Replace reference/text with a 300ms crossfade between the outgoing verse and incoming verse.
    - **Clear (`msg.type === 'clear-scripture'`)**:
      - Retain the current overlay in `exitingOverlay`, transition `opacity-100` -> `opacity-0` over 300ms (`overlayPhase = 'exiting'`), then unmount (`exitingOverlay = null, overlayPhase = 'hidden'`).
      - Smoothly reveals the underlying slide that was continuously rendered underneath.
    - **Rapid Sequences & Cancellation**:
      - A rapid `clear -> push` or `push -> clear` sequence cancels active exit/enter timers and sets the new target state cleanly without ghosting.
    - **Mount-time Sync**:
      - If `sync` message on mount arrives with an active scripture overlay, mount immediately at `opacity-100` without an awkward delayed animation.
  - In `PresenterOperator.tsx`:
    - Operator preview (`data-testid="presenter-current-slide-frame"`) retains immediate live feedback with the emerald badge `Scripture live`, reflecting the operator's command without delaying the console.

### 3. Scripture Autocomplete Keyboard Navigation & Context Suppression Boundaries
- In `src/components/ScriptureRefAutocomplete.tsx`:
  - **Compositional Keyboard Navigation**:
    - Introduce `activeIndex` state (`-1` initially).
    - Consume navigation keys only when the dropdown is relevant (`showList && hits.length > 0`):
      - `ArrowDown`: prevent default, increment `activeIndex` clamped to `[0, hits.length - 1]`.
      - `ArrowUp`: prevent default, decrement `activeIndex` clamped to `[-1, hits.length - 1]`.
      - `Enter`: if `activeIndex >= 0 && activeIndex < hits.length`, prevent default, select `hits[activeIndex].name + ' '`, close dropdown, reset `activeIndex = -1`. If `activeIndex === -1`, allow `Enter` to pass through to parent `onKeyDown` (preserving form submit / lookup).
      - `Escape`: if dropdown is visible, prevent default, close dropdown (`setOpen(false)`), reset `activeIndex = -1`. If dropdown is closed, pass through to parent.
    - If `hits.length === 0` or dropdown is closed, pass all keys through to parent `onKeyDown` so text editing and presenter navigation remain unaffected.
  - **Accessibility Contract**:
    - `<Input>`: `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded={showList}`, `aria-controls="scripture-autocomplete-list"`, `aria-activedescendant={activeIndex >= 0 ? `scripture-opt-${activeIndex}` : undefined}`.
    - Portal container: `role="listbox"`, `id="scripture-autocomplete-list"`.
    - Suggestion buttons: `role="option"`, `id={`scripture-opt-${index}`}`, `aria-selected={index === activeIndex}`, highlighted with `bg-accent text-accent-foreground`.
    - Mouse hover (`onMouseEnter`) syncs `activeIndex` to the hovered item.
  - **Shared Boundary Predicate (`shouldSuggestBooks`)**:
    - Parse tokens by splitting on whitespace: `tokens = query.trim().split(/\s+/)`.
    - If `looksComplete(query)` (e.g. contains colon `:\s*\d`) -> `false`.
    - If query has a leading number (e.g. `1`, `2`, `3`):
      - `1`, `1 C`, `1 Cor`, `1 Corinthians` -> `true` (suggestions OPEN).
      - `1 Corinthians 13`, `1 Cor 13`, `1 Corinthians 13:4` -> `false` (suggestions CLOSED).
    - If query has standard book name (no leading number):
      - `mat`, `Matthew`, `Matthew ` -> `true` (suggestions OPEN).
      - `Matthew 4`, `Mat 4`, `Matthew 0`, `Matthew 4:1` -> `false` (suggestions CLOSED).
  - **Go Backend Defense (`SuggestBooks`)**:
    - In `internal/scripture/match.go`: If `q` contains a complete recognized book followed by digits (or if `ParseRef(q)` succeeds, or if book is recognized and extra tokens are numeric), return `nil`.

---

## Ticket Breakdown & Execution Sequence

1. **SPEC-104-01**: Projector Blank Screen Smooth Transition (`touches: [present-channel]`, `blocked_by: []`)
2. **SPEC-104-02**: Scripture Push and Clear Projector Transitions (`touches: [present-channel, scripture]`, `blocked_by: ["SPEC-104-01"]`)
3. **SPEC-104-03**: Scripture Autocomplete Keyboard Navigation and Chapter/Verse Context Suppression (`touches: [scripture]`, `blocked_by: ["SPEC-104-02"]`)

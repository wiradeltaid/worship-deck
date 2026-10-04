# 02: Scripture Push and Clear Projector Transitions

**Satisfies:** [UC-12, UC-13, FR-19]
**Blocked by:** ["SPEC-104-01"]
**Status:** open

**What to build:** In `src/projected/ProjectorClient.tsx` and `tests/projected-transitions.test.mjs`:

1. **Decoupled Scripture Overlay Layer with Entrance & Exit Transitions**:
   - In `src/projected/ProjectorClient.tsx`:
     - Maintain the underlying `<SlideView>` continuously mounted in the slide container (`z-0..10`).
     - Render `ScriptureOverlayView` in a dedicated container positioned above the slide view at `z-20` (below guest video at `z-30` and blackout layer at `z-50`).
     - **Animation State Machine**:
       - Maintain `activeOverlay: ScriptureOverlay | null`, `exitingOverlay: ScriptureOverlay | null`, and phase management.
       - On scripture arrival (`msg.type === 'scripture'`):
         - If no overlay is showing: mount with `opacity-0` and animate to `opacity-100` over 300ms (`transition-opacity duration-300 ease-in-out`).
         - If overlay is already active (replacement reference/verse): crossfade over 300ms between outgoing and incoming content.
       - On clear (`msg.type === 'clear-scripture'`):
         - Retain the current overlay as `exitingOverlay`, transition `opacity-100` -> `opacity-0` over 300ms, then unmount (`exitingOverlay = null`).
         - Smoothly reveals the underlying slide that was continuously rendered underneath.
       - On rapid sequences (`clear -> push` or `push -> clear`):
         - Cancel pending exit/enter timeouts and transition cleanly to the latest target state without ghost elements.
       - On mount-time `sync`:
         - If `sync` payload includes active scripture overlay on mount, mount immediately at `opacity-100` without delayed animation.
     - Ensure the overlay respects blanking: blackout overlay at `z-50` covers both slide and scripture overlay per BR-6.

2. **Automated Unit & Guard Tests with Component / DOM Test Harness**:
   - In `tests/projected-transitions.test.mjs`:
     - Test that receiving a `scripture` message mounts the scripture overlay with entrance opacity transition (`opacity-0` -> `opacity-100`).
     - Test that receiving `clear-scripture` initiates an exit opacity transition (`opacity-100` -> `opacity-0`) and retains the overlay element during the 300ms exit phase before unmounting.
     - Test that the underlying slide view remains mounted and intact during an active scripture overlay.
     - Test that blanking at `z-50` covers an active scripture overlay without clearing it.

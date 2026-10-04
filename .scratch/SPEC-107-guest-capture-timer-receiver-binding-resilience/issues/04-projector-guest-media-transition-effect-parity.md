# 04: Projector Guest Video Media Canonical AD-23 Transition Parity

**Satisfies:** [UC-12, FR-16, AD-23, AD-29]
**Blocked by:** SPEC-107-03
**Status:** open

**What to build:** In `src/projected/ProjectorClient.tsx` and `tests/projected-transitions.test.mjs`:

1. **Phase-Driven Mount Lifecycle & Retained Media Reference**:
   - In `src/projected/ProjectorClient.tsx`:
     - Maintain `guestPhase: 'hidden' | 'entering-start' | 'active' | 'exiting'`.
     - Maintain `retainedGuestStream: MediaStream | null`:
       - When `isGuestIntent && guestStream` becomes true, store stream in `retainedGuestStream` and transition into entrance sequence.
       - Do NOT directly tie the JSX mount predicate to `isGuestIntent && guestStream`. Instead, mount `<div data-testid="projector-guest-video-container">` whenever `guestPhase !== 'hidden'` and `retainedGuestStream !== null`.
       - When exiting completes, clear `retainedGuestStream = null` and set `guestPhase = 'hidden'`.

2. **Canonical AD-23 Transition Conformance (`SLIDE_TRANSITION_SPECS`)**:
   - Consume `SLIDE_TRANSITION_SPECS[transition]` from `src/lib/transitions.ts`:
     - For `none` and `cut` (`durationMs === 0`): Instantaneous swap. Enter `'active'` immediately upon switch; enter `'hidden'` immediately upon revert with zero delay.
     - For `fade` and `dissolve` (`property: 'opacity'`, `durationMs: 300`):
       - Entrance: Set phase `'entering-start'` (`opacity-0`), next tick trigger `'active'` (`opacity-100`) with `transition-opacity duration-300 ease-in-out`.
       - Exit: Set phase `'exiting'` (`opacity-0`), start 300ms timer. Upon completion, clear `retainedGuestStream` and set `'hidden'`.
     - For `push` (`property: 'transform'`, `durationMs: 300`):
       - Entrance: Set phase `'entering-start'` (`transform: translateX(100%)`), next tick trigger `'active'` (`transform: translateX(0)`) with `transition-transform duration-300`.
       - Exit: Set phase `'exiting'` (`transform: translateX(-100%)`), start 300ms timer. Upon completion, clear `retainedGuestStream` and set `'hidden'`.

3. **Interruption, Stream Replacement, and Cleanup Resilience**:
   - If `switch()` is re-triggered while an exit transition is running (operator panicked then immediately re-armed/switched), cancel the exit timer, restore `guestPhase` to `'active'`, and retain the incoming stream without flickering.
   - If `guestStream` is lost (e.g. HDMI unplugged) or component unmounts, cancel all running entrance/exit timers, immediately clear `retainedGuestStream`, and unmount the layer cleanly.

4. **Automated Unit & Transition Tests**:
   - In `tests/projected-transitions.test.mjs`:
     - Test canonical `fade` and `dissolve`: verify opacity transition from 0 to 100 on switch, and 100 to 0 on revert over 300ms before unmounting.
     - Test canonical `push`: verify transform transition (`translateX`) on switch and revert over 300ms before unmounting.
     - Test `none` and `cut`: verify instant 0ms cut on switch and revert.
     - Test exit interruption: trigger revert followed immediately by switch before 300ms timer fires; verify exit timer is cancelled and layer remains active.
     - Test unmount & stream loss cleanup: verify timers are cleared on unmount and stream removal without leaving hanging timers.

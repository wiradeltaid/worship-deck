# 03: Multi-Screen Window Placement & Fullscreen Orchestration

**What to build:** In `src/operator/present/PresenterOperator.tsx`, `src/projected/ProjectorClient.tsx`, and `tests/congregation-screen-placement.test.mjs`:

1. **Multi-Screen Placement Features in `openProjector`**:
   - In `PresenterOperator.tsx`:
     - Integrate `resolveLaunchTarget` from `<src/lib/display-target.ts>` into the `openProjector` workflow.
     - When launching to an external display, construct window features dynamically from resolved target metrics:
       ```ts
       const features = target.targetScreen
         ? `popup=1,left=${target.targetScreen.availLeft},top=${target.targetScreen.availTop},width=${target.targetScreen.availWidth},height=${target.targetScreen.availHeight}`
         : PROJECTOR_FEATURES;
       ```
     - For fullscreen mode on target screen:
       - Append `?fullscreen=1` to `projectorUrl` when `target.mode === 'fullscreen'`.
     - Window Retargeting & Relocation:
       - If user requests relocation to a new screen, cleanly close the existing window handle (`existing.close()`), clear `projectorRef.current`, and execute `window.open` with the new target coordinates.
       - If window is already on the desired target and alive, call `opened.focus()` rather than spawning duplicate windows.
       - If verdict is `lost`, re-navigate `opened.location.href = projectorUrl`.

2. **ProjectorClient Fullscreen Orchestration & Fallback Contract**:
   - In `ProjectorClient.tsx`:
     - Distinguish physical placement at display bounds from confirmed OS fullscreen mode:
       - The window opens borderless at maximum available screen bounds.
     - When `?fullscreen=1` is present on mount and `!document.fullscreenElement`:
       - Attempt programmatic fullscreen:
         ```ts
         document.documentElement.requestFullscreen().catch(() => {
           // Browser user gesture required: fall back to floating onboarding cue
         });
         ```
       - If programmatic fullscreen is refused by browser activation policies: the transient, floating bilingual F11 guidance badge (SPEC-94-02) is shown with active focus, allowing the operator to enter fullscreen via a single click on the badge or pressing F11.
     - Invariant (`AD-24`, `UC-12`): The room-facing congregation screen remains 100% free of operator chrome and control UI.

3. **Display Topology Disconnection vs. Liveness Independence**:
   - In `PresenterOperator.tsx`:
     - Maintain strict separation between display topology and AD-29 liveness:
       - AD-29 liveness is driven strictly by projector heartbeat acknowledgements and the window handle.
       - If an external display is disconnected (detected via `screenschange` or target query): show an operator-only advisory notice:
         `"Layar eksternal terputus. [ Buka sebagai Jendela ] [ Pilih Layar ]"`
       - Do not broadcast fake heartbeat loss or room-facing errors over PresentChannel.

4. **Integration Test Suite (`tests/congregation-screen-placement.test.mjs`)**:
   - Assert `openProjector` builds coordinates based on resolved external display available metrics.
   - Assert `openProjector` passes `fullscreen=1` parameter when fullscreen mode is active.
   - Assert `ProjectorClient.tsx` handles `fullscreen=1` with graceful fallback to F11 guidance when programmatic fullscreen is denied.
   - Assert window relocation closes old handle before opening new target.
   - Assert topology disconnect notices do not mutate AD-29 liveness state.

**Blocked by:** `SPEC-99-02`

**Status:** closed

- [x] Connect `openProjector` to multi-screen window placement coordinate calculations.
- [x] Implement `?fullscreen=1` query handling and fallback in `ProjectorClient.tsx`.
- [x] Implement clean window relocation flow on target switch.
- [x] Add topology disconnect advisory notice preserving AD-29 liveness independence.
- [x] Add integration test suite in `tests/congregation-screen-placement.test.mjs`.

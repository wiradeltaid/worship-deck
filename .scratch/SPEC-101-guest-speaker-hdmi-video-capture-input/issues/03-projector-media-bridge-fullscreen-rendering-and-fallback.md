# 03: Projector Media Bridge, Fullscreen Video Rendering, and Fail-Safe Fallback

**What to build:** In `src/projected/ProjectorClient.tsx` and `<src/projected/ProjectorMediaBridge.ts>`:

1. **Same-Origin Opener Media Bridge (`<src/projected/ProjectorMediaBridge.ts>`)**:
   - Helper to safely acquire a consumer stream from `window.opener.__worshipDeckCaptureBroker.acquireProjectorConsumer(guestSessionId)`.
   - Handles popup refresh / remount: when `ProjectorClient` mounts while `projection.kind === 'guest'`, requests fresh cloned stream with non-leaking `release()` callback.
   - Operational boundary: if `window.opener` is closed, unavailable, or cross-origin, fails closed, emits `projector-media-status: unavailable`, and cleanly renders the active slide deck.
   - Update fallback button in `PresenterOperator.tsx`: replace `target="_blank" rel="noreferrer"` with a programmatic `window.open` trigger to preserve `window.opener`.

2. **Projector View Video Surface (`src/projected/ProjectorClient.tsx`)**:
   - Conditional rendering layer:
     - When `projection.kind === 'guest'`: renders `<video ref={videoRef} autoPlay playsInline muted />`.
     - Styling:
       ```css
       position: absolute;
       inset: 0;
       width: 100%;
       height: 100%;
       object-fit: contain;
       background: #000;
       z-index: 30;
       ```
     - Handles aspect ratio gracefully (4:3, 16:10, 16:9) via letterboxing/pillarboxing with pure black bars.
   - Compliance with `AD-24`:
     - Surface displays ZERO operator controls, ZERO error toasts, and ZERO device labels.
   - Compliance with Blanking:
     - Operator blank screen command (`B`) continues to display the full black overlay at `z-50` on top of the live video stream (`z-30`).

3. **Narrow AD-29 Telemetry & Fail-Safe Fallback**:
   - Sends `projector-media-status` message (`attached` | `unavailable`) over `present-channel`.
   - Listens to `videoTrack.onended` and `video.onerror`.
   - If the capture device is unplugged or the pipeline crashes, immediately reverts to rendering the current slide deck and emits `projector-media-status: unavailable`. (Note: upstream HDMI disconnect/freeze does not terminate tracks; operator manual panic button / Escape is the primary fallback for content freeze).
   - Properly invokes `release()` on consumer stream on unmount, `pagehide`, or switch back to `'deck'`.

4. **Automated Unit Tests in `tests/projector-guest-media-bridge.test.mjs`**:
   - Attaches stream when `projection.kind === 'guest'`.
   - Aspect ratio styling: verifies `object-fit: contain`, black background, and `z-30`.
   - Blank screen overlay: verifies blank state at `z-50` occludes the video element.
   - Fail-safe fallback: simulating `track.onended` immediately returns projector view to slide presentation and emits `projector-media-status`.
   - Opener failure boundary: missing or cross-origin opener cleanly renders deck without crashing.
   - Teardown: verifies consumer track is stopped and released when unmounted or on `pagehide`.

**Satisfies:** [UC-12, FR-16, FR-19]

**Blocked by:** SPEC-101-02

**Status:** open

- [ ] Implement `<src/projected/ProjectorMediaBridge.ts>` same-origin stream acquisition with fail-closed opener handling.
- [ ] Render contained fullscreen `<video>` surface at `z-30` in `src/projected/ProjectorClient.tsx` when `projection.kind === 'guest'`.
- [ ] Implement automatic fallback on pipeline error / `track.onended` and telemetry reporting (`projector-media-status`).
- [ ] Replace `noreferrer` fallback link in `PresenterOperator.tsx` with programmatic opener-preserving launch.
- [ ] Verify blank screen overlay occlusion at `z-50` (`AD-24`).
- [ ] Add comprehensive automated tests in `tests/projector-guest-media-bridge.test.mjs`.

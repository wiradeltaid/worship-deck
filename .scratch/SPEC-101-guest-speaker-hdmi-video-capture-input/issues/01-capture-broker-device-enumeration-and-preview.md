# 01: CaptureBroker Hardware Lifecycle, Device Enumeration, and Stream Fan-Out

**What to build:** In `<src/lib/capture-broker.ts>`:

1. **Environment Verification & Device Enumeration**:
   - Guard against insecure contexts: if `typeof window !== 'undefined' && (!window.isSecureContext || !navigator.mediaDevices)`, reject capture initialization gracefully with a typed code `INSECURE_CONTEXT` so the UI can instruct the operator to run on `localhost` or `https://`.
   - Implement `enumerateCaptureDevices()`:
     - Calls `navigator.mediaDevices.enumerateDevices()`.
     - Filters devices with `kind === 'videoinput'`.
     - Maps to `CaptureDeviceInfo { deviceId: string, label: string, isDefault?: boolean }`.
     - Handles empty labels prior to user permission gracefully with localized fallback names (e.g. `Video Input 1`).

2. **Single CaptureBroker Singleton**:
   - Manages the lifecycle of a single master `MediaStream` owned exclusively by the Operator window.
   - Hardware-level audio exclusion:
     ```ts
     const stream = await navigator.mediaDevices.getUserMedia({
       video: {
         deviceId: deviceId ? { exact: deviceId } : undefined,
         width: { ideal: 1920 },
         height: { ideal: 1080 },
         frameRate: { ideal: 60 },
       },
       audio: false, // Mandatory: audio is strictly excluded at browser API level
     });
     ```
   - Observable readiness rule:
     - Tracks readiness via `video.onloadeddata` / `video.oncanplay` within a 5-second timeout window.
     - Resolves actual track capabilities via `track.getSettings()` (recording `actualWidth`, `actualHeight`, `actualFrameRate`).
   - Consumer stream fan-out & registration:
     - Exposes `acquireProjectorConsumer(guestSessionId): { stream: MediaStream, release: () => void }`.
     - Uses `this.masterVideoTrack.clone()`.
     - Tracks all active consumer streams in an internal registry (`Set<MediaStream>`).
     - `release()` stops consumer tracks and cleanly removes them from the registry.
   - Comprehensive teardown:
     - Method `.disarm()` stops master tracks AND iterates over all registered consumer tracks calling `track.stop()`.
     - Clears all internal references, emits state change to subscribers, and releases OS hardware locks.

3. **Global Bridge Exposure**:
   - Attaches a safe, typed bridge on `window.__worshipDeckCaptureBroker` exposing `acquireProjectorConsumer(guestSessionId)` so same-origin child popups (`ProjectorPage.tsx`) can request consumer streams with non-leaking release handles.

4. **Automated Unit Tests in `tests/capture-broker-device-enumeration.test.mjs`**:
   - Device enumeration filters strictly `videoinput` devices.
   - Insecure context throws `INSECURE_CONTEXT` error.
   - `getUserMedia` options verified: `audio: false` is strictly asserted.
   - Readiness timeout: transitioning to error if no frames arrive within timeout.
   - Cloned track lifecycle: stopping a consumer track via `release()` does not stop the master track.
   - Teardown(`.disarm()`): stops master track and all registered consumer tracks.

**Blocked by:** none

**Status:** open

- [ ] Implement `enumerateCaptureDevices` and secure context check in `<src/lib/capture-broker.ts>`.
- [ ] Implement `CaptureBroker` singleton with `audio: false`, frame readiness detection, and consumer clone tracking (`acquireProjectorConsumer` / `release`).
- [ ] Expose same-origin opener bridge on `window.__worshipDeckCaptureBroker`.
- [ ] Add comprehensive automated tests in `tests/capture-broker-device-enumeration.test.mjs`.

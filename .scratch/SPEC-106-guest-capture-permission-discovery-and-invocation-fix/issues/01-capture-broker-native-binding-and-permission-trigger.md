# 01: Capture Broker Defensive Native Binding and Explicit Permission Trigger

**Satisfies:** [UC-12, FR-16]
**Blocked by:** none
**Status:** closed

**What to build:** In `src/lib/capture-broker.ts`, `src/operator/present/presenter-guest-feed-controller.ts`, `tests/capture-broker-device-enumeration.test.mjs`, and `tests/presenter-guest-feed-controls.test.mjs`:

1. **Defensive Web API Receiver Binding**:
   - In `src/lib/capture-broker.ts`:
     - In the constructor, normalize and bind native `mediaDevices` methods to their parent object with safe feature detection:
       ```ts
       const mediaDevices =
         env.mediaDevices ??
         (typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined);

       this.env = {
         ...
         mediaDevices: mediaDevices
           ? {
               enumerateDevices:
                 typeof mediaDevices.enumerateDevices === 'function'
                   ? mediaDevices.enumerateDevices.bind(mediaDevices)
                   : () => Promise.reject(new CaptureBrokerError('MEDIA_API_UNAVAILABLE')),
               getUserMedia:
                 typeof mediaDevices.getUserMedia === 'function'
                   ? mediaDevices.getUserMedia.bind(mediaDevices)
                   : () => Promise.reject(new CaptureBrokerError('MEDIA_API_UNAVAILABLE')),
               addEventListener:
                 typeof mediaDevices.addEventListener === 'function'
                   ? mediaDevices.addEventListener.bind(mediaDevices)
                   : undefined,
               removeEventListener:
                 typeof mediaDevices.removeEventListener === 'function'
                   ? mediaDevices.removeEventListener.bind(mediaDevices)
                   : undefined,
             }
           : undefined,
       };
       ```
     - Ensure `this === mediaDevices` is guaranteed across all calls to `getUserMedia` and `enumerateDevices`, eliminating `TypeError: Illegal invocation` under all execution and bundling conditions.

2. **Explicit Permission Request Method with Guaranteed Teardown**:
   - In `src/lib/capture-broker.ts`:
     - Expose `requestPermission(): Promise<CaptureDeviceOption[]>`.
     - Request temporary probe stream via `this.env.mediaDevices!.getUserMedia({ video: true, audio: false })`.
     - **Guaranteed Cleanup**: Use a `try / finally` pattern ensuring that probe stream tracks are stopped immediately upon acquisition (`finally { this.stopStreamTracks(probeStream); }`), preventing dangling camera indicators.
     - On successful probe and enumeration: clear any previous error state (`this.error = null`) and notify subscribers.
     - **Failure Contract**: Catch `NotAllowedError` or other rejections via `this.mapError(err)`, setting `this.error` to `PERMISSION_DENIED` with clear instructions to check Site Settings, and re-throw the mapped error.
   - In `src/operator/present/presenter-guest-feed-controller.ts`:
     - Expose `requestPermission(): Promise<CaptureDeviceOption[]>` that calls `this.broker.requestPermission()`.
     - In `controller.requestPermission()`, catch errors to project into `this.errorMessage` without leaving unhandled rejections for fire-and-forget callers.

3. **Automated Unit & Receiver Tests**:
   - In `tests/capture-broker-device-enumeration.test.mjs`:
     - Add a mock `mediaDevices` test where `getUserMedia` and `enumerateDevices` explicitly assert `this === mediaDevices` (throwing `TypeError: Illegal invocation` if unbound), and verify that `CaptureBroker` calls them with receiver context intact.
     - Add test verifying that `requestPermission()` invokes `getUserMedia({ video: true, audio: false })`, stops all probe stream tracks even if enumeration throws, and updates device enumeration.
     - Add test verifying that permission denial maps cleanly to `PERMISSION_DENIED` without unhandled rejections.

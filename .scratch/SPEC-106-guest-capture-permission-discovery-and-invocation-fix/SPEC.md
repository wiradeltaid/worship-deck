# SPEC-106 — Guest Video Capture Permission Discovery, Web API Receiver Binding, and Dropdown Click Resilience

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-24` (Room-Facing Screens Never Show Operator Controls; Operator Console Ergonomics)
  - `AD-29` (Presenter-Projector Cross-Window Liveness Handshake and Sync — Wire Protocol Preserved)
- **Functional Requirements**:
  - `FR-16` (Two-Screen Presenter View in the Browser)
  - `FR-25` (Operator Interface Localization & Dual-Language Parity)
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync)
- **Components**: `presenter`
- **Touches**: `present-channel` (Wire protocol preserved; local capture broker and operator console UI hardened)

---

## Problem Statement

During live testing and rehearsal of WorshipDeck dev (`https://presenter-dev.bic.my.id/present`), operators reported three usability, browser permission lifecycle, and invocation defects with the guest video capture interface:

1. **Camera Permission Chicken-and-Egg Deadlock (Device List Empty)**:
   - When opening WorshipDeck on a browser profile that has not yet granted camera permissions to `https://presenter-dev.bic.my.id`, the guest feed device dropdown shows `"No video capture device"`, even when hardware capture cards (e.g. `ezcap Game Link RAW`, `UGREEN Camera 4K`) and virtual cameras are connected and visible in OBS Studio.
   - **Root Cause**: Modern Chromium browsers (Chrome/Edge) hide the "Camera" toggle in Site Settings and redact device labels/IDs to empty strings (`""`) until the origin explicitly calls `navigator.mediaDevices.getUserMedia()`. In SPEC-103-01, selecting a device was decoupled from calling `getUserMedia()`, and the **Arm** button was disabled if `!selectedDeviceId`. Consequently, `getUserMedia()` is never called, the browser never displays the "Allow camera access" permission prompt, and the device list remains empty indefinitely.

2. **Web API Receiver Loss During Capture (`TypeError: Illegal invocation`)**:
   - Once camera permissions are granted and an operator selects a capture card (e.g. `ezcap Game Link RAW`) and clicks **Arm**, the UI transitions to error displaying `Illegal invocation`.
   - **Root Cause**: In Chromium/V8, native browser Web APIs such as `navigator.mediaDevices.getUserMedia` and `navigator.mediaDevices.enumerateDevices` enforce strict C++ receiver checks requiring `this === navigator.mediaDevices`. If the method is invoked unbound or destructured across module wrappers or minified bundles, V8 throws a native `TypeError: Illegal invocation`, which `mapError()` catches and surfaces as `CAPTURE_FAILED`.

3. **Dropdown Item Click Race Condition (Device Selection Unresponsive)**:
   - Operators report that items in the device dropdown "sometimes cannot be clicked" or require repeated clicking to register.
   - **Root Cause**: `PresenterGuestFeedControl.tsx` re-enumerates devices when the dropdown opens (`onOpenChange(true)`), and `CaptureBroker` listens to background `devicechange` events. Because enumeration is asynchronous, background completions replace `snapshot.devices` mid-interaction while the Base UI / shadcn popup is open. This DOM reconciliation race can unmount or swap the `<DropdownMenuRadioItem>` element precisely while a pointer event is in flight, dropping the click event before `onValueChange` fires.

---

## Solution Architecture & Invariants

### 1. Defensive Web API Receiver Binding & Guaranteed Probe Teardown
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
    Guarantees `this === mediaDevices` across all call sites, permanently preventing `TypeError: Illegal invocation`.
  - Expose `requestPermission(): Promise<CaptureDeviceOption[]>` on `CaptureBroker`:
    - Calls `this.env.mediaDevices!.getUserMedia({ video: true, audio: false })` via an explicit user gesture.
    - **Guaranteed Cleanup**: Wraps in `try / finally` ensuring that `this.stopStreamTracks(stream)` is executed immediately upon acquisition of the probe stream, even if enumeration subsequently throws.
    - Invokes `this.enumerateDevices()`, clears previous stale error state on success, and returns the discovered devices.
    - **Failure Contract**: If user denies permission (`NotAllowedError`), maps cleanly to `CaptureBrokerError('PERMISSION_DENIED', 'Camera permission was denied. Please allow camera access in your browser Site Settings.')` and projects this error into `this.error` and `controller.errorMessage`.
- In `src/operator/present/presenter-guest-feed-controller.ts`:
  - Expose `requestPermission(): Promise<CaptureDeviceOption[]>` that delegates to `broker.requestPermission()`.
  - Handles rejections gracefully so fire-and-forget calls do not result in unhandled promise rejections.

### 2. Controlled Dropdown Snapshot, Async Invalidation, and Explicit Device Selection
- In `src/operator/present/PresenterGuestFeedControl.tsx`:
  - **Controlled Dropdown State with Invalidation**:
    - Manage `deviceMenuOpen: boolean` and `deviceMenuDevices: CaptureDeviceOption[]` with request generation tracking (`deviceMenuRequestId`).
    - When `open === false`: increment `deviceMenuRequestId.current` to cancel any pending async resolution, and set `deviceMenuOpen = false`.
    - When `open === true`: increment `deviceMenuRequestId.current`, request `controller.enumerateDevices()`, and update `deviceMenuDevices` only if generation still matches.
    - **Freeze Interaction Snapshot**: During the entire time the menu is open, render the radio items from `deviceMenuDevices` (the frozen snapshot) rather than live mutating `snapshot.devices`. Background `devicechange` events update `snapshot.devices` for triggers but do not tear down or re-render open popup DOM nodes mid-click.
    - On `onValueChange(val)`: select device via `controller.selectDevice(val)` and immediately close menu (`setDeviceMenuOpen(false)`).
  - **No Implicit Auto-Selection (Preserve Operator Intent)**:
    - Discovery of devices MUST NOT auto-select or auto-arm any device. The operator retains explicit control over selecting their intended hardware source (e.g. HDMI capture card vs. webcam). If a previously selected device remains in the discovered list, its selection is preserved; otherwise `selectedDeviceId` remains unset until the operator explicitly clicks an option.
  - **Permission Discovery CTA & Localization (FR-25)**:
    - When `devices.length === 0` (or devices have empty ID), render an actionable button:
      `<Button onClick={() => void controller.requestPermission()}>{t('presenter.guestFeed.enableAccess')}</Button>`.
    - Provide complete localization in `src/lib/i18n/operator.tsx` in both English and Indonesian:
      - EN: `enableAccess: 'Enable Camera Access'`, `permissionDenied: 'Camera permission denied. Allow access in browser settings.'`
      - ID: `enableAccess: 'Izinkan Akses Kamera'`, `permissionDenied: 'Izin kamera ditolak. Berikan izin di setelan browser.'`
  - **Diagnostic Error Logging**:
    - Add `console.error('Guest capture arm failed:', err)` in `arm()` so native hardware/driver errors are logged with stack traces in DevTools.

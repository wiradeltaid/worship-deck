# 01: Capture Broker Device Enumeration, Base UI Menu Group Fix, and Row 1 Placement

**Satisfies:** [UC-12, FR-16]
**Blocked by:** none
**Status:** closed

**What to build:** In `src/lib/capture-broker.ts`, `src/operator/present/presenter-guest-feed-controller.ts`, `src/operator/present/PresenterGuestFeedControl.tsx`, `src/operator/present/PresenterOperator.tsx`, and `tests/presenter-guest-feed-controls.test.mjs`:

1. **Resolve Base UI MenuGroupContext Crash**:
   - In `src/operator/present/PresenterGuestFeedControl.tsx`:
     - Wrap `<DropdownMenuLabel>` inside `<DropdownMenuGroup>` so Base UI `MenuGroupContext` is structurally satisfied when the dropdown menu opens.

2. **Safe & Idempotent Capture Device Discovery**:
   - In `src/operator/present/presenter-guest-feed-controller.ts`:
     - Expose `enumerateDevices(): Promise<CaptureDeviceOption[]>`. Constructor must NOT execute unhandled async I/O.
     - Catch any rejection from `broker.enumerateDevices()` gracefully (e.g. insecure context or unsupported API), projecting the error message without throwing unhandled exceptions or incorrectly arming state.
     - Expose `selectDevice(deviceId: string): void` that invokes `this.broker.selectDevice(deviceId)`.
   - In `src/operator/present/PresenterGuestFeedControl.tsx`:
     - On mount, trigger `void controller.enumerateDevices()`.
     - In `<DropdownMenu onOpenChange={...}>`, re-trigger `controller.enumerateDevices()` when opening (`open === true`) to discover newly plugged devices.
     - Change `<DropdownMenuRadioGroup onValueChange={...}>` to call `controller.selectDevice(value)` rather than `controller.arm(value)`.
     - Ensure the primary **Arm** button is the sole trigger for calling `controller.arm()`.

3. **Presenter Header Row 1 Placement**:
   - In `src/operator/present/PresenterOperator.tsx`:
     - Move `<PresenterGuestFeedControl />` from `presenter-header-row-2` to `presenter-header-row-1`, adjacent to `All slides`, `PresenterDisplayControl`, and `Remote Code`.

4. **Automated Unit & Guard Tests**:
   - In `tests/presenter-guest-feed-controls.test.mjs`:
     - Test that `<DropdownMenuLabel>` is enclosed in `<DropdownMenuGroup>`.
     - Test that device enumeration is invoked on mount and dropdown open without throwing unhandled rejections on error.
     - Test that selecting a device updates `selectedDeviceId` via `selectDevice()` and does NOT invoke `getUserMedia()`.
     - Test that only explicit Arm invokes `getUserMedia()`.
     - Test that `PresenterGuestFeedControl` is located in Header Row 1.

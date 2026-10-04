# 02: Presenter Guest Feed Controlled Dropdown Snapshot and Permission CTA

**Satisfies:** [UC-12, FR-16, FR-25]
**Blocked by:** SPEC-106-01
**Status:** closed

**What to build:** In `src/operator/present/PresenterGuestFeedControl.tsx`, `src/lib/i18n/operator.tsx`, and `tests/presenter-guest-feed-controls.test.mjs`:

1. **Controlled Dropdown Snapshot to Eliminate Click-Race Re-renders**:
   - In `src/operator/present/PresenterGuestFeedControl.tsx`:
     - Introduce controlled state with request invalidation:
       ```tsx
       const [deviceMenuOpen, setDeviceMenuOpen] = useState(false);
       const [deviceMenuDevices, setDeviceMenuDevices] = useState<CaptureDeviceOption[]>([]);
       const deviceMenuRequestId = useRef(0);
       ```
     - Implement `handleDeviceMenuOpenChange(open: boolean)`:
       - On `open === false`: increment `deviceMenuRequestId.current` (invalidating any pending async enumeration) and set `deviceMenuOpen = false`.
       - On `open === true`: increment `requestId = ++deviceMenuRequestId.current`, call `controller.enumerateDevices()`, update `deviceMenuDevices` if `requestId === deviceMenuRequestId.current`, and set `deviceMenuOpen = true`.
     - Render `<DropdownMenu open={deviceMenuOpen} onOpenChange={handleDeviceMenuOpenChange}>`.
     - Render radio items strictly from `deviceMenuDevices` (the frozen snapshot during that open session) rather than live mutating `snapshot.devices`, preventing DOM node swapping mid-pointer-press.
     - In `onValueChange`: call `controller.selectDevice(val)` and immediately close the dropdown (`setDeviceMenuOpen(false)`).
     - **No Auto-Select Invariant**: Do NOT auto-select or auto-arm any discovered device upon permission grant. The operator retains explicit control over selecting their intended hardware source.

2. **Explicit Permission Request CTA with Mandatory Localization (FR-25)**:
   - In `src/operator/present/PresenterGuestFeedControl.tsx`:
     - When `devices.length === 0` (or devices have empty ID), render an actionable button:
       `<Button onClick={() => void controller.requestPermission()}>{t('presenter.guestFeed.enableAccess')}</Button>`.
     - Provide dual-language keys in `src/lib/i18n/operator.tsx` with guaranteed 1:1 parity:
       - `presenter.guestFeed.enableAccess`: `"Enable Camera Access"` (EN) / `"Izinkan Akses Kamera"` (ID)
       - `presenter.guestFeed.permissionDenied`: `"Camera permission denied. Allow access in browser settings."` (EN) / `"Izin kamera ditolak. Berikan izin di setelan browser."` (ID)

3. **Diagnostic Logging on Arm Error**:
   - In `presenter-guest-feed-controller.ts`:
     - In `arm()`, log `console.error('Guest capture arm failed:', err)` to ensure stack traces are visible in DevTools for hardware-level issues without altering user-facing error mapping.

4. **Automated Unit & Guard Tests**:
   - In `tests/presenter-guest-feed-controls.test.mjs`:
     - Prove the defect first (absence guard): verify that background device updates during open menu do not corrupt or disrupt pending selection.
     - Test that the dropdown operates in controlled mode and invalidates stale requests when closed or unmounted.
     - Test that selecting a device updates selected device and closes dropdown.
     - Test that the "Enable Camera Access" button calls `controller.requestPermission()`.
     - Test that i18n keys for camera permission exist and match across English and Indonesian.

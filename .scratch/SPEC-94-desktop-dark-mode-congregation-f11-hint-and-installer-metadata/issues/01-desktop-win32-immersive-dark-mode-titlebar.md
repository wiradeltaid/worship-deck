# 01: Desktop Win32 Immersive Dark Mode Title Bar Integration

**What to build:** In `internal/desktop/window_windows.go`, `package.json`, and `tests/desktop-dark-mode-titlebar.test.mjs`:

1. **DWM DLL & Immersive Dark Mode Constants (`internal/desktop/window_windows.go`)**:
   - Declare `dwmapi.dll`:
     ```go
     dwmapi = windows.NewLazySystemDLL("dwmapi.dll")
     procDwmSetWindowAttribute = dwmapi.NewProc("DwmSetWindowAttribute")
     ```
   - Define DWM window attribute constants:
     ```go
     const (
         DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1 = 19
         DWMWA_USE_IMMERSIVE_DARK_MODE            = 20
     )
     ```

2. **Deterministic Windows System Theme Detection (`internal/desktop/window_windows.go`)**:
   - Implement `IsWindowsSystemDarkMode() bool`:
     - Open registry key `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize` using `golang.org/x/sys/windows/registry`.
     - Read integer value `AppsUseLightTheme`.
     - If key does not exist or reading errors: default deterministically to `false` (light mode).
     - If `AppsUseLightTheme == 0`, return `true` (dark mode active); if `1` or any other value, return `false`.

3. **Window Non-Client Title Bar Theming on Launch (`internal/desktop/window_windows.go`)**:
   - Scope: Launch-time theme detection only; dynamic runtime observation of subsequent Windows theme toggles while the application is running is explicitly out of scope.
   - Implement `SetWindowImmersiveDarkMode(hwnd uintptr, darkMode bool) error`:
     - If `hwnd == 0`, return `nil`.
     - Prepare `val := int32(0)` (or `1` when `darkMode` is true).
     - First try calling `DwmSetWindowAttribute` with `DWMWA_USE_IMMERSIVE_DARK_MODE` (attribute 20).
     - If call returns non-zero, retry with `DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1` (attribute 19).
   - In `RunDesktopWindow`, after obtaining `hwnd := uintptr(w.Window())`:
     - Query `isDark := IsWindowsSystemDarkMode()`.
     - Invoke `SetWindowImmersiveDarkMode(hwnd, isDark)`.

4. **Automated Verification Suite (`tests/desktop-dark-mode-titlebar.test.mjs`)**:
   - Assert `internal/desktop/window_windows.go` declares:
     - `dwmapi = windows.NewLazySystemDLL("dwmapi.dll")`
     - `procDwmSetWindowAttribute = dwmapi.NewProc("DwmSetWindowAttribute")`
     - `DWMWA_USE_IMMERSIVE_DARK_MODE = 20`
     - `DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1 = 19`
     - `AppsUseLightTheme` registry lookup with deterministic false fallback.
     - Integration call in `RunDesktopWindow`.
   - Provide defect injection proofs ensuring omissions trigger test failure.

Bounded operational desktop deliverable.

**Blocked by:** none

**Status:** done

- [x] In `internal/desktop/window_windows.go`:
      - Declare `dwmapi.dll` and dynamic procedure `DwmSetWindowAttribute`.
      - Implement `IsWindowsSystemDarkMode` and `SetWindowImmersiveDarkMode`.
      - Invoke theming upon creating the native WebView2 window.
- [x] In `package.json`:
      - Register `tests/desktop-dark-mode-titlebar.test.mjs`.
- [x] In `tests/desktop-dark-mode-titlebar.test.mjs`:
      - Implement contract assertions, static AST/regex verifications, and defect injection proofs.

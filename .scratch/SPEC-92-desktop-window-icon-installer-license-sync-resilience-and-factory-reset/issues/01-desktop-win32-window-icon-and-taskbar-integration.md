# 01: Desktop Win32 Window Icon Stamping and Taskbar Integration

**What to build:** In `internal/desktop/window_windows.go` and `tests/desktop-window-icon.test.mjs`:

1. **Win32 Window Icon Binding (`internal/desktop/window_windows.go`)**:
   - In `RunDesktopWindow`, after creating `w = webview2.NewWithOptions(...)`, access the underlying window handle (`HWND`) via `w.Window()`.
   - Declare user32 procedures:
     - `procSendMessageW = user32.NewProc("SendMessageW")`
     - `procLoadIconW = user32.NewProc("LoadIconW")`
     - `procGetModuleHandleW = kernel32.NewProc("GetModuleHandleW")`
   - Define constants:
     - `WM_SETICON = 0x0080`
     - `ICON_SMALL = 0` (title bar icon)
     - `ICON_BIG = 1` (taskbar and Alt+Tab icon)
   - Load icon resource ID 1 (`uintptr(1)`) from the executable's module instance using `procLoadIconW.Call(hInst, 1)`.
   - Dispatch `WM_SETICON` for both `ICON_SMALL` and `ICON_BIG` to the window HWND:
     - `procSendMessageW.Call(hwnd, WM_SETICON, uintptr(ICON_SMALL), hIcon)`
     - `procSendMessageW.Call(hwnd, WM_SETICON, uintptr(ICON_BIG), hIcon)`
   - Gracefully handle cases where `hIcon` cannot be loaded without crashing the window.

2. **Automated Static & Contract Guard (`tests/desktop-window-icon.test.mjs`)**:
   - Assert `internal/desktop/window_windows.go` declares `WM_SETICON`, `ICON_SMALL`, `ICON_BIG`, and calls `procSendMessageW` or equivalent Win32 icon API.
   - Proof of guard via defect injection: verify that stripping `WM_SETICON` triggers test failure.
   - Include documented runtime verification procedure in test comments.

Satisfies `FR-20`, `UC-14`.

**Blocked by:** none

**Status:** closed

- [x] In `internal/desktop/window_windows.go`:
      - Add `WM_SETICON`, `ICON_SMALL`, `ICON_BIG` Win32 procedures and constants.
      - Bind embedded resource icon 1 to the WebView2 window HWND.
- [x] In `package.json`:
      - Register `tests/desktop-window-icon.test.mjs`.
- [x] In `tests/desktop-window-icon.test.mjs`:
      - Implement static structure and defect injection proofs for Win32 window icon integration.

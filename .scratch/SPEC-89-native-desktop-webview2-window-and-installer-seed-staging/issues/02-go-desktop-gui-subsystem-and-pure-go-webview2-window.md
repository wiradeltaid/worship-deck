# 02: Go Desktop GUI Subsystem (-H=windowsgui), Diagnostic Logging, and Pure-Go WebView2 Window

**What to build:** In `scripts/build-desktop.mjs`, `cmd/api/main.go`, and `internal/desktop/`:

1. **Windows GUI Subsystem Compilation (`scripts/build-desktop.mjs`)**:
   - Update Go compilation flags for desktop packaging:
     ```javascript
     go build -trimpath -ldflags="-s -w -H=windowsgui" -o <exePath> ./cmd/api
     ```
   - Suppresses the black command prompt terminal window on Windows when executing `worship-deck.exe`.

2. **Persistent Diagnostic Logging in Desktop Mode (`cmd/api/main.go`)**:
   - In desktop mode, initialize multi-writer logging to write to `%LOCALAPPDATA%\WorshipDeck\desktop.log` so startup errors, server bind errors, and WebView2 diagnostics are never lost when running without a console.

3. **Pure-Go Edge WebView2 Native Window (`internal/desktop/window_windows.go`, `internal/desktop/window_other.go`)**:
   - Integrate `github.com/jchv/go-webview2` (pure Go Windows COM binding, MIT license, zero CGO, `CGO_ENABLED=0` verified):
     - `internal/desktop/window_windows.go`:
       - Define `RunDesktopWindow(serverURL string, title string, width int, height int, onExit func()) error`.
       - Lock OS thread (`runtime.LockOSThread()`) for COM initialization and Win32 message loop.
       - Create native Win32 window embedding Edge WebView2 pointing to `serverURL`.
       - Title: "WorshipDeck".
       - Default size: 1440x900 (resizable, min client width: 1024, min client height: 768).
       - Center window on monitor work area (DPI-aware).
     - `internal/desktop/window_other.go`:
       - Stub for non-Windows platforms (macOS/Linux): fallback to calling `OpenBrowser(serverURL)` and waiting for process termination.

4. **Desktop Mode Entry Point Integration (`cmd/api/main.go`)**:
   - When `--desktop` (or `DESKTOP=1`) is active:
     - After HTTP server starts and binds to loopback port, invoke `desktop.RunDesktopWindow(serverURL, ...)`.
     - Block on the window message loop on the main OS thread.
     - When window closes, trigger graceful shutdown of the HTTP server.

Satisfies `FR-21`, `UC-15`, and `AD-30`.

**Blocked by:** SPEC-89-01

**Status:** closed

- [x] In `scripts/build-desktop.mjs`:
      - Add `-H=windowsgui` to `ldflags` in desktop Go build step.
- [x] In `cmd/api/main.go`:
      - Initialize persistent desktop file logger at `%LOCALAPPDATA%\WorshipDeck\desktop.log`.
- [x] In `internal/desktop/window_windows.go` and `internal/desktop/window_other.go`:
      - Implement `RunDesktopWindow` embedding Microsoft Edge WebView2 using pure-Go COM binding with thread locking.
- [x] Verify `go test ./internal/desktop/...` and compilation with `GOOS=windows CGO_ENABLED=0` succeed.

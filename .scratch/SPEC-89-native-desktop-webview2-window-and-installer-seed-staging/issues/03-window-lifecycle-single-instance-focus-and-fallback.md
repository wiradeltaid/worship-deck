# 03: Coordinated Graceful Shutdown, Single-Instance Focus Restoration, and Fallback Guards

**What to build:** In `internal/desktop/` and `cmd/api/main.go`, implement coordinated graceful shutdown, single-instance focus handling, and runtime fallbacks:

1. **Coordinated Graceful Shutdown Ownership (`cmd/api/main.go`)**:
   - Replace bare `http.Serve` and raw `os.Exit(0)` signal handler with coordinated `http.Server`:
     - Single root cancellation context `ctx, cancel := context.WithCancel(context.Background())`.
     - Window close event, OS interrupt signal (Ctrl+C / SIGTERM), or fatal server error invokes `cancel()`.
     - Execute graceful `srv.Shutdown(ctx)` with bounded timeout (5s).
     - Run all deferred resource cleanups: flush and close database handle, remove `%LOCALAPPDATA%\WorshipDeck\runtime.json`, release the single-instance mutex, and return cleanly from `main`.

2. **Single-Instance Focus Restoration (`internal/desktop/mutex_windows.go`, `internal/desktop/window_windows.go`)**:
   - When a second instance is launched while an instance is already running (`alreadyRunning == true`):
     - Find the existing top-level window by title ("WorshipDeck").
     - Call `ShowWindow(hwnd, SW_RESTORE)`.
     - Attempt `SetForegroundWindow(hwnd)`.
     - If Windows foreground-lock policy denies foreground transition: call `FlashWindow(hwnd, TRUE)` so the application taskbar icon alerts the user.
     - Exit the second instance immediately without launching another server or window.

3. **WebView2 Availability Fallback & Fallback Lifecycle**:
   - If WebView2 runtime is missing or fails to initialize (e.g. `New()` returns error):
     - Log diagnostic error to `%LOCALAPPDATA%\WorshipDeck\desktop.log`.
     - Fallback to `desktop.OpenBrowser(serverURL)`.
     - In fallback mode, the server remains running until interrupted by OS signal or explicit shutdown, cleanly cleaning up resources on exit.

Satisfies `FR-21` and `UC-15`.

**Blocked by:** SPEC-89-02

**Status:** open

- [ ] In `cmd/api/main.go`:
      - Implement coordinated graceful shutdown via `srv.Shutdown` on single context cancellation.
- [ ] In `internal/desktop/window_windows.go`:
      - Implement window close handler triggering server context cancellation.
      - Implement single-instance focus and taskbar flash fallback.
      - Implement fallback to `OpenBrowser` on WebView2 initialization failure.
- [ ] Verify `go test ./internal/desktop/...` and `go test ./cmd/api/...` pass cleanly.

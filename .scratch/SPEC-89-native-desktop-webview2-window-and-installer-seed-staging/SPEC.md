# SPEC-89 — Native Desktop WebView2 Window and Installer Default Seed Staging

## Requirement Traceability & Scope
- **PRD**: `offline-deck`
- **Architectural Decisions**:
  - `AD-30` (Three-Tier Architecture — Go HTTP API + Vite React SPA + Node.js PPTX worker)
  - `AD-33` (Free-Canvas Song-Set Layout Trio Seeding — Title, Verse, Reff roles)
- **Use Cases**:
  - `UC-14` (I change a slide's layout — satisfies `FR-20`, `AD-33`)
  - `UC-15` (I reorder slides and deletions stay deleted — satisfies `FR-21`)
- **Functional Requirements**:
  - `FR-20` (Admin changes a slide's layout through the Artifact Registry — including the shared Title/Verse/Reff trio)
  - `FR-21` (Admin changes slide order and membership in the Artifact Registry; offline structure survival across restarts and redeploy)
- **Components**: `registry`, `hub`
- **Touches**: `artifacts`, `settings`

---

## Problem Statement

WorshipDeck provides a standalone Windows desktop distribution (`dist-installer/WorshipDeck-<version>-x64-setup.exe` compiled via Inno Setup). However, manual execution of the desktop binary (`worship-deck.exe`) and inspection of runtime logs reveals two distinct architectural defects affecting desktop distribution and operational integrity:

1. **Installer Staging Misses Shipped Default Seeds (Missing Song-Set Layout Trio):**
   - On starting the installed executable `worship-deck.exe`, the Go runtime emits:
     ```text
     [registry] song-set layout seeds unavailable; skipping: open C:\Users\kodes\AppData\Local\Programs\WorshipDeck\data\default-song-set-layouts.json: The system cannot find the file specified.
     ```
   - **Root Cause**: In `scripts/build-desktop.mjs`, `stageCorporaAndNotices(targetDir)` stages hymn corpora (`data/song-book/sdah.json`), Bible translation corpora (`data/en/bible-translation/kjv.json`), and bundled fonts, but fails to copy the default seed configuration files:
     - `data/default-song-set-layouts.json`
     - `data/default-registry.json`
     - `data/asset-map.json`
   - When Inno Setup packages `dist-desktop/data/*` into `{app}\data\`, these seed files are absent. On a fresh database installation, `EnsureSongSetLayoutSeeds` in `internal/db/song_set_layout_seed.go` skips seeding the default `title`, `verse`, and `reff` layout trio. Furthermore:
     - If the executable is launched from a working directory other than `{app}` (e.g. double-clicked directly or executed from user profile), `cmd/api/main.go` currently resolves `root` via `os.Getwd()`, breaking immutable asset lookups. Root resolution must resolve relative to `os.Executable()` in desktop mode.
     - `EnsureSongSetLayoutSeeds` currently logs a skip warning and returns `nil` when seed files are missing, allowing fresh installations to succeed in a degraded, unseeded state. It also fails to self-repair if individual roles from the trio are absent.
     - On VPS deployments (`deploy-dev.ps1`), while `data/` is staged, deployment verification must explicitly validate that `EnsureSongSetLayoutSeeds` has populated the trio layout in `/var/lib/presenter-dev/data.db`.

2. **Unwanted Console Terminal Window and Missing Native Desktop Window Wrapper:**
   - Go compiles `worship-deck.exe` with default console subsystem settings (`-H=console`). When launched from Windows shortcuts or Explorer, Windows forcibly spawns a black command prompt (`cmd.exe`) window.
   - When `--desktop` is invoked, `cmd/api/main.go` currently executes `desktop.OpenBrowser(serverURL)` using `rundll32 url.dll,FileProtocolHandler`, opening WorshipDeck as a regular tab in the user's default browser (with navigation bars, bookmarks, and multiple tabs).
   - This architecture suffers from severe UX flaws:
     - If the user closes the browser tab, the Go HTTP server continues running invisibly or in the console.
     - If the user closes the command prompt window, `cmd/api/main.go` calls `os.Exit(0)` in its signal handler without executing deferred database or listener closures, risking SQLite WAL corruption.
     - Users expect a unified, self-contained desktop application window without embedding heavy Chromium/Electron bundles (preserving zero bloat on Windows 10/11 where Microsoft Edge WebView2 is already pre-installed).

---

## Architecture & Detailed Solution

### 1. Complete Default Seed & Corpora Staging (`scripts/build-desktop.mjs`, `internal/db/`)
- Expand `stageCorporaAndNotices(targetDir)`:
  - Copy root seed JSON files from `repoRoot/data` to `targetDir/data`:
    - `default-song-set-layouts.json` (required by `EnsureSongSetLayoutSeeds`)
    - `default-registry.json` (required by `bootstrapRegistry`)
    - `asset-map.json` (required for asset reference maps)
  - Ensure `installer/worship-deck.iss` packages `{app}\data\*` cleanly and preserves all seed files.
- Executable-Relative Root Resolution (`cmd/api/main.go`):
  - In desktop mode, if `REPO_ROOT` is not explicitly set in the environment, check whether `data/` exists adjacent to `os.Executable()`. If present, adopt `filepath.Dir(exePath)` as `root`. This guarantees immutable asset lookup succeeds regardless of CWD.
- Robust Song-Set Layout Trio Seeding (`internal/db/song_set_layout_seed.go`):
  - In `EnsureSongSetLayoutSeeds`:
    - If `seeds` cannot be loaded on a fresh database (`count == 0`), fail closed and report the missing seed file error rather than silently skipping.
    - If `count > 0`, self-repair missing trio roles: check for presence of each canonical role (`title`, `verse`, `reff`), inserting any missing role from `seeds[role]` with seed hash recorded.
- VPS Deployment Verification:
  - Verify that `applications/presenter.bic.my.id/scripts/deploy-dev.ps1` preserves `data/default-song-set-layouts.json` and verify via test that the trio exists in the SQLite database after bootstrap.

### 2. Windows GUI Subsystem Compilation (`-H=windowsgui`) & Diagnostic Logging
- In `scripts/build-desktop.mjs`:
  - Update Go compilation flags:
    ```javascript
    go build -trimpath -ldflags="-s -w -H=windowsgui" -o <exePath> ./cmd/api
    ```
  - This eliminates the black Command Prompt terminal on Windows entirely.
- Desktop Diagnostic Logging:
  - In desktop mode, initialize logging to write to `%LOCALAPPDATA%\WorshipDeck\desktop.log` (in addition to standard outputs when attached) so startup errors, server bind errors, and WebView2 diagnostics are fully capturable.

### 3. Native Microsoft Edge WebView2 Window Wrapper (Pure Go, Zero CGO, Zero Chrome Embedding)
- Implement pure-Go WebView2 integration using `github.com/jchv/go-webview2` (Windows COM APIs, CGO-free, compatible with `CGO_ENABLED=0`):
  - In `internal/desktop/window_windows.go` (and `window_other.go` stub):
    - Function: `RunDesktopWindow(url string, options WindowOptions) error`.
    - Window Properties:
      - Title: "WorshipDeck"
      - Default Dimensions: 1440x900 (min client size: 1024x768).
      - Center window within monitor work area (DPI-aware).
    - Thread Affinity & Message Loop:
      - Lock the OS thread (`runtime.LockOSThread()`) for COM initialization (`ole32.dll`) and Win32 message loop dispatch.
    - Lifecycle & Coordinated Graceful Shutdown:
      - Window Close Event: When the user clicks the window close button (`X` or Alt+F4), the window destruction triggers context cancellation for the HTTP server.
      - Go HTTP server shuts down via `srv.Shutdown(ctx)` with bounded timeout (5s), flushes and closes database handle, releases single-instance mutex, removes runtime info from `%LOCALAPPDATA%\WorshipDeck`, and returns cleanly from `main`.
    - Single-Instance Mutex Focus:
      - If a second instance is launched (`alreadyRunning == true`), locate the existing window (`FindWindow`), restore it (`ShowWindow(SW_RESTORE)`), bring it to foreground (`SetForegroundWindow`), or flash taskbar (`FlashWindow`) if foreground lock policy applies, then exit immediately.
    - Fallback:
      - If WebView2 runtime is missing or fails to initialize, log diagnostic error to `desktop.log` and fallback gracefully to `desktop.OpenBrowser(url)`. On non-Windows platforms (macOS/Linux), open the default browser as currently implemented.

---

## Ticket Breakdown

- **SPEC-89-01**: Desktop Staging, Executable Root Resolution, and Song-Set Layout Trio Self-Repair Seeding (`scripts/build-desktop.mjs`, `tests/installer-corpora-staging.test.mjs`, `internal/db/song_set_layout_seed.go`, `cmd/api/main.go`)
- **SPEC-89-02**: Go Desktop GUI Subsystem (`-H=windowsgui`), Diagnostic Logging, and Pure-Go WebView2 Window (`cmd/api/main.go`, `internal/desktop/window_windows.go`, `internal/desktop/window_other.go`, `scripts/build-desktop.mjs`)
- **SPEC-89-03**: Coordinated Graceful Shutdown, Single-Instance Focus Restoration, and Fallback Guards (`internal/desktop/runtime.go`, `internal/desktop/mutex_windows.go`, `internal/desktop/browser.go`)
- **SPEC-89-04**: Desktop Packaging, Window Lifecycle, and Seeder End-to-End Contract Tests (`tests/desktop-webview2-contract.test.mjs`, `internal/desktop/desktop_test.go`)

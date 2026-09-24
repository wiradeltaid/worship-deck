# 02: [WSD-H-02] Desktop mode for installed app and WorshipDeck data folder

**What to build:** In `cmd/api/main.go`, `internal/desktop/datadir.go`, `internal/desktop/mutex.go`, and `installer/worship-deck.iss`:
1. Ensure every way the installer executes the application enters desktop mode:
   - Configure installer Start menu shortcuts, desktop icons, and post-installation `[Run]` entries to pass `--desktop`.
   - Update desktop mode detection logic so that server binaries on Linux/Windows never inadvertently enter desktop mode by name alone, while desktop executions reliably engage desktop single-instance mutex and loopback protection.
2. Update data directory paths and mutex names to the canonical `WorshipDeck` branding:
   - Windows: `%LOCALAPPDATA%\WorshipDeck\`
   - macOS: `~/Library/Application Support/WorshipDeck`
   - Linux: `$XDG_DATA_HOME/worship-deck`
   - Single-instance mutex: `Local\WorshipDeck.SingleInstance`
   - Cleanly deprecate references to `WorshipPresenter` and `worship-presenter` in `cmd/`, `internal/`, and `scripts/`.
3. Absence guard:
   - Add `tests/desktop-mode-guard.test.mjs` verifying zero occurrences of `WorshipPresenter` or `worship-presenter` across `cmd/`, `internal/`, `scripts/`, and `installer/` (preserving only documented legacy mutex compatibility if required).
   - In `internal/desktop/desktop_test.go`: assert `ResolveDataDir("", true)` on Windows ends with `WorshipDeck`.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `cmd/api/main.go`, `internal/desktop/datadir.go`, and `installer/worship-deck.iss`.
- [x] In `installer/worship-deck.iss`: update `[Icons]` and `[Run]` to pass `--desktop`.
- [x] In `internal/desktop/datadir.go`: update directory resolution to `WorshipDeck` / `worship-deck`.
- [x] In `internal/desktop/mutex.go`: update mutex name to `Local\WorshipDeck.SingleInstance`.
- [x] Update `internal/desktop/desktop_test.go` to assert new path resolution. Verify red first, then green.
- [x] Add `tests/desktop-mode-guard.test.mjs` asserting absence of `WorshipPresenter`. Verify red first, then green.
- [x] Add `tests/desktop-mode-guard.test.mjs` to `package.json` `scripts.test`.
- [x] Verify `go test ./internal/desktop/...` and `npm test` pass cleanly.

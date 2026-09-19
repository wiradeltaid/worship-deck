# 01: Desktop Launcher Mutex and Data Directory Resolution

**What to build:**
Implement the standalone desktop runtime launcher and environment resolution in the Go API server:
1. Support `--data-dir` flag and `DATA_DIR` environment variable to isolate mutable SQLite databases, uploads, and logs into `%LocalAppData%\WorshipPresenter\` on Windows, leaving `{app}` in `Program Files` strictly read-only.
2. Acquire a Windows Named Mutex (`Global\WorshipPresenter.SingleInstance`) on startup. If an existing instance is already running, notify the running instance via loopback ping or open the active URL in the default browser, then gracefully exit the second process.
3. Bind the HTTP server strictly to `127.0.0.1` (never `0.0.0.0`) to guarantee zero Windows Defender Firewall alert prompts.
4. Implement ephemeral/fallback port selection (attempt configured port `3000`, scanning fallback range `3000-3010` if occupied) and launch the default system browser to `http://127.0.0.1:<port>/`.

**Blocked by:** none

**Status:** closed

- [x] Add CLI flag `--data-dir` and env var `DATA_DIR` parsing in `cmd/api/main.go`, defaulting to `%LocalAppData%\WorshipPresenter` on Windows when running as installed binary.
- [x] Implement single-instance Windows Named Mutex check in `cmd/api` using `golang.org/x/sys/windows`.
- [x] Implement fallback port listener scanning range `3000-3010` when port 3000 is occupied, logging chosen address.
- [x] Implement automatic browser opener on first startup launching the resolved loopback URL.
- [x] Add unit and integration tests verifying loopback binding, data directory fallback, and mutex behavior.
- [x] Human verification check: Start the executable twice in succession; verify that the second invocation exits cleanly without error while focusing the browser on the primary instance.

---
artifact: .control/decisions/DEC-067-daily-autopilot-mandate-worship-deck-first-release-0-1-0-and-go-live.md
---

# Autopilot Ledger — DEC-067

## Resume

- Iteration: 4
- Run branch: autopilot/DEC-067
- Stopped at: Ticket WSD-H-04 completed and verified — first admin created on a setup screen
- Blocked: —
- Parked: —
- Next: Execute frontier tickets for SPEC-73 starting with WSD-H-05

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-067 for WorshipDeck first release 0.1.0 and go-live work (SPEC-73) | waiting for interactive manual dispatch | low | .control/decisions/DEC-067-daily-autopilot-mandate-worship-deck-first-release-0-1-0-and-go-live.md |
| I-1 (WSD-H-01) | installer/worship-deck.iss, release.yml, build-desktop.mjs | Output versioned installer `WorshipDeck-{#MyAppVersion}-x64-setup.exe` and single checksum file `SHA256SUMS` without .txt extension, enforce in release verification suite and absence guard tests with real-file defect injection, verified by Terra peer review | keeping legacy WorshipDeckSetup.exe and SHA256SUMS.txt naming | medium | installer/worship-deck.iss, .github/workflows/release.yml, scripts/build-desktop.mjs, SECURITY.md, package.json, tests/installer-version-sync.test.mjs, tests/release-artifact-names.test.mjs, .scratch/SPEC-73-worship-deck-first-release-0-1-0-and-go-live/issues/01-wsd-h-01-release-artifact-names.md |
| I-2 (WSD-H-02) | cmd/api/main.go, installer/worship-deck.iss, internal/desktop/datadir.go, mutex.go | Pass --desktop from installer shortcuts and Run command, switch desktop data folder to %LOCALAPPDATA%\WorshipDeck and mutex to Local\WorshipDeck.SingleInstance, validate loopback URL on secondary instance focus, and enforce complete absence of legacy names across cmd/, internal/, scripts/, and installer/ with defect injection proofs | leaving legacy names in Go codebase and unparameterized desktop shortcuts | medium | cmd/api/main.go, installer/worship-deck.iss, internal/desktop/datadir.go, internal/desktop/mutex.go, internal/desktop/runtime.go, internal/desktop/desktop_test.go, package.json, tests/desktop-mode-guard.test.mjs, .scratch/SPEC-73-worship-deck-first-release-0-1-0-and-go-live/issues/02-wsd-h-02-desktop-mode-worshipdeck-data-folder.md |
| I-3 (WSD-H-03) | internal/auth/session.go, cmd/api/main.go, .env.example | Auto-generate cryptographically random 32-byte secret in <dataDir>/auth-secret.dat (0600) on first desktop launch under single-instance mutex protection, refuse silent overwrite of existing/short secrets, reject insecure placeholders (change-me*, your-secret-here*, secret, password) without leaking secret values in errors/logs, and preserve 503 response in server mode when unset, verified by Terra peer review | manual secret entry in desktop or allowing default insecure secrets | medium | internal/auth/session.go, cmd/api/main.go, .env.example, internal/auth/session_test.go, cmd/api/auth_secret_test.go, .scratch/SPEC-73-worship-deck-first-release-0-1-0-and-go-live/issues/03-wsd-h-03-automatic-auth-secret-refuse-example-secrets.md |
| I-4 (WSD-H-04) | internal/auth/accounts.go, internal/httpapi/auth.go, gate.go, LoginPage.tsx | Implement atomic loopback first-admin setup (POST /api/setup/admin, GET /api/setup/status) restricted to desktop mode and loopback, render setup screen on LoginPage when 0 accounts exist with password confirmation, and enforce session gate exemption with absence guard tests | requiring manual SQL/bootstrap password for desktop operators | medium | internal/auth/accounts.go, internal/gate/gate.go, internal/httpapi/server.go, internal/httpapi/auth.go, cmd/api/main.go, spa/src/pages/LoginPage.tsx, src/lib/i18n/keys.ts, catalogue-en.ts, catalogue-id.ts, internal/httpapi/setup_test.go, tests/first-admin-setup.test.mjs, .scratch/SPEC-73-worship-deck-first-release-0-1-0-and-go-live/issues/04-wsd-h-04-first-admin-setup-screen.md |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --baseline` green, Go test suite passed (exit 0), `npm test` passed (exit 0).
- WSD-H-01 verification: PASS — `node --test tests/release-artifact-names.test.mjs` (4/4 passed), `node --test tests/installer-version-sync.test.mjs` (6/6 passed), `validate.py` green.
- WSD-H-02 verification: PASS — `go test ./cmd/... ./internal/desktop/...` (passed), `node --test tests/desktop-mode-guard.test.mjs` (8/8 passed), `validate.py` green.
- WSD-H-03 verification: PASS — `go test -v ./internal/auth/...` (passed), `go test -v ./cmd/api/...` (passed), `validate.py` green.
- WSD-H-04 verification: PASS — `go test -v ./internal/httpapi -run TestSetup` (passed), `go test -v ./internal/gate/...` (passed), `node --test tests/first-admin-setup.test.mjs` (3/3 passed), `validate.py` green.

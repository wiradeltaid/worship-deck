---
artifact: .control/decisions/DEC-067-daily-autopilot-mandate-worship-deck-first-release-0-1-0-and-go-live.md
---

# Autopilot Ledger — DEC-067

## Resume

- Iteration: 2
- Run branch: autopilot/DEC-067
- Stopped at: Ticket WSD-H-02 completed and verified — desktop mode for installed app and WorshipDeck data folder
- Blocked: —
- Parked: —
- Next: Execute frontier tickets for SPEC-73 starting with WSD-H-03

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-067 for WorshipDeck first release 0.1.0 and go-live work (SPEC-73) | waiting for interactive manual dispatch | low | .control/decisions/DEC-067-daily-autopilot-mandate-worship-deck-first-release-0-1-0-and-go-live.md |
| I-1 (WSD-H-01) | installer/worship-deck.iss, release.yml, build-desktop.mjs | Output versioned installer `WorshipDeck-{#MyAppVersion}-x64-setup.exe` and single checksum file `SHA256SUMS` without .txt extension, enforce in release verification suite and absence guard tests with real-file defect injection, verified by Terra peer review | keeping legacy WorshipDeckSetup.exe and SHA256SUMS.txt naming | medium | installer/worship-deck.iss, .github/workflows/release.yml, scripts/build-desktop.mjs, SECURITY.md, package.json, tests/installer-version-sync.test.mjs, tests/release-artifact-names.test.mjs, .scratch/SPEC-73-worship-deck-first-release-0-1-0-and-go-live/issues/01-wsd-h-01-release-artifact-names.md |
| I-2 (WSD-H-02) | cmd/api/main.go, installer/worship-deck.iss, internal/desktop/datadir.go, mutex.go | Pass --desktop from installer shortcuts and Run command, switch desktop data folder to %LOCALAPPDATA%\WorshipDeck and mutex to Local\WorshipDeck.SingleInstance, validate loopback URL on secondary instance focus, and enforce complete absence of legacy names across cmd/, internal/, scripts/, and installer/ with defect injection proofs | leaving legacy names in Go codebase and unparameterized desktop shortcuts | medium | cmd/api/main.go, installer/worship-deck.iss, internal/desktop/datadir.go, internal/desktop/mutex.go, internal/desktop/runtime.go, internal/desktop/desktop_test.go, package.json, tests/desktop-mode-guard.test.mjs, .scratch/SPEC-73-worship-deck-first-release-0-1-0-and-go-live/issues/02-wsd-h-02-desktop-mode-worshipdeck-data-folder.md |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --baseline` green, Go test suite passed (exit 0), `npm test` passed (exit 0).
- WSD-H-01 verification: PASS — `node --test tests/release-artifact-names.test.mjs` (4/4 passed), `node --test tests/installer-version-sync.test.mjs` (6/6 passed), `validate.py` green.
- WSD-H-02 verification: PASS — `go test ./cmd/... ./internal/desktop/...` (passed), `node --test tests/desktop-mode-guard.test.mjs` (8/8 passed), `validate.py` green.

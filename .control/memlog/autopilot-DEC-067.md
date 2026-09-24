---
artifact: .control/decisions/DEC-067-daily-autopilot-mandate-worship-deck-first-release-0-1-0-and-go-live.md
---

# Autopilot Ledger — DEC-067

## Resume

- Iteration: 1
- Run branch: autopilot/DEC-067
- Stopped at: Ticket WSD-H-01 completed and verified — release artifact naming and single checksum file
- Blocked: —
- Parked: —
- Next: Execute frontier tickets for SPEC-73 starting with WSD-H-02

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-067 for WorshipDeck first release 0.1.0 and go-live work (SPEC-73) | waiting for interactive manual dispatch | low | .control/decisions/DEC-067-daily-autopilot-mandate-worship-deck-first-release-0-1-0-and-go-live.md |
| I-1 (WSD-H-01) | installer/worship-deck.iss, release.yml, build-desktop.mjs | Output versioned installer `WorshipDeck-{#MyAppVersion}-x64-setup.exe` and single checksum file `SHA256SUMS` without .txt extension, enforce in release verification suite and absence guard tests with real-file defect injection, verified by Terra peer review | keeping legacy WorshipDeckSetup.exe and SHA256SUMS.txt naming | medium | installer/worship-deck.iss, .github/workflows/release.yml, scripts/build-desktop.mjs, SECURITY.md, package.json, tests/installer-version-sync.test.mjs, tests/release-artifact-names.test.mjs, .scratch/SPEC-73-worship-deck-first-release-0-1-0-and-go-live/issues/01-wsd-h-01-release-artifact-names.md |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --baseline` green, Go test suite passed (exit 0), `npm test` passed (exit 0).
- WSD-H-01 verification: PASS — `node --test tests/release-artifact-names.test.mjs` (4/4 passed), `node --test tests/installer-version-sync.test.mjs` (6/6 passed), `validate.py` green.

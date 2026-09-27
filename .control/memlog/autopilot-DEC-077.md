---
artifact: .control/decisions/DEC-077-daily-autopilot-mandate-desktop-pe-metadata-about-modal-and-full-fidelity-sync.md
---

# Autopilot Ledger — DEC-077

## Resume

- State: In-progress
- Run branch: autopilot/DEC-077 (Draft PR #126 open)
- Stopped at: SPEC-90 completed and verified; advancing to SPEC-91
- Blocked: —
- Parked: —
- Next: SPEC-91-01 (Full-Fidelity Bidirectional Cloud Sync Protocol & Stable Global IDs)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-077 for Desktop PE Metadata, About Modal, and Full-Fidelity Cloud Sync (SPEC-90, SPEC-91) | waiting for interactive manual dispatch | low | .control/decisions/DEC-077-daily-autopilot-mandate-desktop-pe-metadata-about-modal-and-full-fidelity-sync.md |
| I-1 (SPEC-90-01..03) | installer/, scripts/build-desktop.mjs, spa/, src/, internal/desktop/, tests/ | Implement deterministic PE VERSIONINFO compilation via windres, Inno Setup VersionInfo directives, PRIVACY.md staging, Per-Monitor V2 DPI awareness, bilingual About Modal, and bounded zero-telemetry absence guard | missing binary publisher metadata or runtime About dialog | low | installer/, scripts/build-desktop.mjs, spa/, src/, internal/desktop/, tests/ |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --check --baseline` green, Go test suite passed (exit 0), `npm test` passed (exit 0; 1575 pass, 0 fail, 3 skipped), working tree clean.
- SPEC-90 verification: PASS — `npm run smoke:spec-90` (13/13 passed), `npm run typecheck` (0 errors), `npm run lint` (0 errors), `public-repo-guard` (5/5 passed), `go test ./internal/desktop` (14/14 passed), `npm run spa:build` (0 errors), Terra peer review findings resolved (P1 PRIVACY.md staged and installed, P1 fail-closed syso purge & post-build PE inspection, P2 DPI awareness diagnostics & unit test).

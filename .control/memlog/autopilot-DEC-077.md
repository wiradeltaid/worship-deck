---
artifact: .control/decisions/DEC-077-daily-autopilot-mandate-desktop-pe-metadata-about-modal-and-full-fidelity-sync.md
---

# Autopilot Ledger — DEC-077

## Resume

- State: Applied — All SPEC-90 (01..03) and SPEC-91 (01..03) tickets implemented, verified, peer-reviewed, and ready for maintainer merge
- Run branch: autopilot/DEC-077 (PR #126)
- Stopped at: Done — all FRs in mandate scope completed and verified
- Blocked: —
- Parked: —
- Next: Maintainer review and merge PR #126 into main

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-077 for Desktop PE Metadata, About Modal, and Full-Fidelity Cloud Sync (SPEC-90, SPEC-91) | waiting for interactive manual dispatch | low | .control/decisions/DEC-077-daily-autopilot-mandate-desktop-pe-metadata-about-modal-and-full-fidelity-sync.md |
| I-1 (SPEC-90-01..03) | installer/, scripts/build-desktop.mjs, spa/, src/, internal/desktop/, tests/ | Implement deterministic PE VERSIONINFO compilation via windres, Inno Setup VersionInfo directives, PRIVACY.md staging, Per-Monitor V2 DPI awareness, bilingual About Modal, and bounded zero-telemetry absence guard | missing binary publisher metadata or runtime About dialog | low | installer/, scripts/build-desktop.mjs, spa/, src/, internal/desktop/, tests/ |
| I-2 (SPEC-91-01..03) | internal/db/, internal/httpapi/, src/lib/sync/, spa/, tests/ | Implement full-fidelity cloud sync schema migration, stable global IDs, Parent-First insertion ordering, tombstone anti-resurrection guard, pull asset hydration with SHA-256 integrity verification, and state preservation across conflicts | broken asset links on pull or dropped presentation entities | low | internal/db/, internal/httpapi/, src/lib/sync/, spa/, tests/ |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --check --baseline` green, Go test suite passed (exit 0), `npm test` passed (exit 0; 1575 pass, 0 fail, 3 skipped), working tree clean.
- SPEC-90 verification: PASS — `npm run smoke:spec-90` (13/13 passed), `npm run typecheck` (0 errors), `npm run lint` (0 errors), `public-repo-guard` (5/5 passed), `go test ./internal/desktop` (14/14 passed), `npm run spa:build` (0 errors), Terra peer review findings resolved (P1 PRIVACY.md staged and installed, P1 fail-closed syso purge & post-build PE inspection, P2 DPI awareness diagnostics & unit test).
- SPEC-91 verification: PASS — `npm run smoke:spec-91` (10/10 passed), `npm run typecheck` (0 errors), `npm run lint` (0 errors), `public-repo-guard` (5/5 passed), `go test ./...` (11/11 packages passed), `npm run spa:build` (0 errors), Terra peer review findings resolved (P1 fail-closed asset hydration & push verification, P1 tombstone anti-resurrection guard & full entity deletion coverage, P1 conflict resolution state preservation, P2 migration error propagation & parent-first 409 enforcement).

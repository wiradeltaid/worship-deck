---
artifact: .control/decisions/DEC-083-daily-autopilot-mandate-readme-restructure-and-go-live-closure.md
---

# Autopilot Ledger — DEC-083

## Resume

- State: Applied — All SPEC-73 tickets (01..16) implemented, verified, peer-reviewed, and ready for maintainer merge
- Run branch: autopilot/DEC-083 (Draft PR #135 open)
- Stopped at: Done — all FRs and specs in mandate scope completed and verified
- Blocked: —
- Parked: —
- Next: Maintainer review and merge PR into main

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-083 for README Restructure Post v0.1.0 Publication and Go-Live Closure (SPEC-73) | waiting for interactive manual dispatch | low | .control/decisions/DEC-083-daily-autopilot-mandate-readme-restructure-and-go-live-closure.md |
| I-1 (SPEC-73-16) | README.md, README.*.md, docs/*, package.json, tests/readme-structure.test.mjs, tests/readme-claims-guard.test.mjs | Restructure README to place Installation before Features, compress all 10 READMEs under 100 lines with direct v0.1.0 release links, migrate deep sections to docs/, and enforce via structural guard with defect injection | leaving README un-condensed or inconsistent across translations | low | README.md, README.*.md, docs/customization.md, docs/corpora.md, docs/deployment.md, docs/history.md, package.json, tests/readme-structure.test.mjs, tests/readme-claims-guard.test.mjs |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --check` green, Go test suite passed (exit 0), `npm test` passed (exit 0; 1643 pass, 0 fail, 3 skipped), working tree clean.
- SPEC-73-16 verification: PASS — `npm run smoke:spec-73` (10/10 passed), `go test ./cmd/... ./internal/...` (all passed), `npm test` (exit 0; 1647 pass, 0 fail, 3 skipped), `public-repo-guard` (5/5 passed), `lint` and `typecheck` passed (exit 0), Terra peer review findings resolved (migration pages added to claims guard, structural checks expanded for SHA256SUMS/releases/SmartScreen/docs, line count normalized for trailing newlines).

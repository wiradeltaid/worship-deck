---
artifact: .control/decisions/DEC-084-daily-autopilot-mandate-onedrive-connector-and-dual-hash-parity.md
---

# Autopilot Ledger — DEC-084

## Resume

- State: Iteration — SPEC-95 complete and verified, ready to begin SPEC-96 execution
- Run branch: autopilot/DEC-084
- Stopped at: SPEC-95 closed
- Blocked: —
- Parked: —
- Next: Begin SPEC-96 Ticket 01 (Dual-hash upload resolution parity and asset safety)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-084 for OneDrive Cloud Connector, PPTX Sync Prompt, and Dual-Hash Parity (SPEC-95, SPEC-96) | waiting for interactive manual dispatch | low | .control/decisions/DEC-084-daily-autopilot-mandate-onedrive-connector-and-dual-hash-parity.md |
| I-1 (SPEC-95) | Go API, SQLite schema, React SPA, i18n, onedrive-connector.test.mjs | Deliver Microsoft OneDrive Cloud Connector with PKCE OAuth, per-user SQLite storage, Graph proxy folder picker, and single-blob PPTX export pipeline | direct cloud export or multi-tenant complexity | low | internal/httpapi/onedrive*.go, spa/src/pages/RunSheetPage.tsx, spa/src/components/*, tests/onedrive-connector.test.mjs |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --check` green, Go test suite passed (exit 0), `npm test` passed (exit 0; 1647 pass, 0 fail, 3 skipped), working tree clean.
- SPEC-95 verification: PASS — `npm run smoke:spec-95` (8/8 pass), `go test ./internal/httpapi -run TestOneDrive` (7/7 pass), full Go test suite passed (exit 0), full `npm test` suite passed (1655 pass, 0 fail, 3 skipped), public repo guard passed (5/5 pass), typecheck and spa build passed (exit 0), Terra peer review findings resolved (large chunk response validation, payload bounding, HTTP client timeouts).

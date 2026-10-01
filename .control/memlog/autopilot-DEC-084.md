---
artifact: .control/decisions/DEC-084-daily-autopilot-mandate-onedrive-connector-and-dual-hash-parity.md
---

# Autopilot Ledger — DEC-084

## Resume

- State: Applied — All SPEC-95 and SPEC-96 tickets implemented, verified, peer-reviewed, and ready for maintainer merge
- Run branch: autopilot/DEC-084 (PR #136)
- Stopped at: Done — all FRs and specs in mandate scope completed and verified
- Blocked: —
- Parked: —
- Next: Maintainer review and merge PR into main

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-084 for OneDrive Cloud Connector, PPTX Sync Prompt, and Dual-Hash Parity (SPEC-95, SPEC-96) | waiting for interactive manual dispatch | low | .control/decisions/DEC-084-daily-autopilot-mandate-onedrive-connector-and-dual-hash-parity.md |
| I-1 (SPEC-95) | Go API, SQLite schema, React SPA, i18n, onedrive-connector.test.mjs | Deliver Microsoft OneDrive Cloud Connector with PKCE OAuth, per-user SQLite storage, Graph proxy folder picker, and single-blob PPTX export pipeline | direct cloud export or multi-tenant complexity | low | internal/httpapi/onedrive*.go, spa/src/pages/RunSheetPage.tsx, spa/src/components/*, tests/onedrive-connector.test.mjs |
| I-2 (SPEC-96) | src/lib/uploads.ts, src/lib/images.ts, src/lib/slide-plan.ts, tests/upload-dual-hash-resolution.test.mjs, tests/pptx-dual-hash-image-embed.test.mjs | Align discrete dual-hash pattern (32 or 64 hex) across Node resolver, slide planning, PPTX worker, and orphaned upload deletion | leaving 64-hex SHA-256 uploads unresolvable in PPTX worker | low | src/lib/uploads.ts, src/lib/images.ts, src/lib/slide-plan.ts, src/components/ImageUploadField.tsx, tests/upload-dual-hash-resolution.test.mjs, tests/pptx-dual-hash-image-embed.test.mjs |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --check` green, Go test suite passed (exit 0), `npm test` passed (exit 0; 1647 pass, 0 fail, 3 skipped), working tree clean.
- SPEC-95 verification: PASS — `npm run smoke:spec-95` (8/8 pass), `go test ./internal/httpapi -run TestOneDrive` (7/7 pass), full Go test suite passed (exit 0), full `npm test` suite passed (1655 pass, 0 fail, 3 skipped), public repo guard passed (5/5 pass), typecheck and spa build passed (exit 0), Terra peer review findings resolved (large chunk response validation, payload bounding, HTTP client timeouts).
- SPEC-96 verification: PASS — `npm run smoke:spec-96` (13/13 pass), full Go test suite passed (exit 0), full `npm test` suite passed (1668 pass, 0 fail, 3 skipped), public repo guard passed (5/5 pass), typecheck and spa build passed (exit 0), Terra peer review findings resolved (behavioral orphan unlinking test, computePlanContext photo propagation test, and comment cleanup).

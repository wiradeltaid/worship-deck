---
artifact: .control/decisions/DEC-079-daily-autopilot-mandate-desktop-icon-license-sync-resilience-and-factory-reset.md
---

# Autopilot Ledger — DEC-079

## Resume

- State: Applied — All SPEC-92 tickets (01..04) implemented, verified, peer-reviewed, and ready for maintainer merge
- Run branch: autopilot/DEC-079
- Stopped at: Done — all FRs in mandate scope completed and verified
- Blocked: —
- Parked: —
- Next: Maintainer review and merge PR into main

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-079 for Desktop Window Icon, Installer License, Sync Resilience, and Factory Reset (SPEC-92) | waiting for interactive manual dispatch | low | .control/decisions/DEC-079-daily-autopilot-mandate-desktop-icon-license-sync-resilience-and-factory-reset.md |
| I-1 (SPEC-92-01) | internal/desktop/window_windows.go, tests/desktop-window-icon.test.mjs, package.json | Implement Win32 WM_SETICON window title bar (ICON_SMALL) and taskbar (ICON_BIG) stamping with embedded resource ID 1 and strict defect-injection guards | generic executable window and taskbar icon | low | internal/desktop/window_windows.go, tests/desktop-window-icon.test.mjs, package.json |
| I-2 (SPEC-92-02) | installer/worship-deck.iss, tests/installer-license-and-uninstall.test.mjs, package.json | Implement LicenseFile directive pointing to staged LICENSE and interactive uninstall data wipe confirmation dialog with MB_DEFBUTTON2 and DelTree | silent uninstallation leaving orphaned databases or missing open-source license page | low | installer/worship-deck.iss, tests/installer-license-and-uninstall.test.mjs, package.json |
| I-3 (SPEC-92-03) | src/lib/sync/client.ts, spa/src/pages/AdminSyncPage.tsx, tests/sync-asset-resilience.test.mjs, package.json | Narrow asset extraction strictly to explicit /api/uploads/<hash>.<ext> URIs, exclude layout seed_hash and entity digests, implement narrow remote-download 404 resilience and behavioral simulation test | crashing cloud sync pulls on metadata digests or masking local hydration failures | low | src/lib/sync/client.ts, spa/src/pages/AdminSyncPage.tsx, tests/sync-asset-resilience.test.mjs, package.json |
| I-4 (SPEC-92-04) | internal/db/factory_reset.go, internal/httpapi/admin_reset.go, internal/httpapi/server.go, spa/src/pages/AdminSyncPage.tsx, src/lib/i18n/, tests/factory-reset.test.mjs, package.json | Implement POST /api/admin/reset-factory under DEC-078 with 401/403 gates, dynamic data wipe, seedHub canonical restoration, uploads purge, and bilingual admin UI | manual file deletion or surviving corrupted/modified seeds | low | internal/db/factory_reset.go, internal/httpapi/admin_reset.go, internal/httpapi/server.go, spa/src/pages/AdminSyncPage.tsx, src/lib/i18n/, tests/factory-reset.test.mjs, package.json |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --check --baseline` green, Go test suite passed (exit 0), `npm test` passed (exit 0; 1,598 pass, 0 fail, 3 skipped), working tree clean, remote connection verified.
- SPEC-92-01 verification: PASS — `npm run smoke:spec-92` (2/2 passed), `go test ./internal/desktop/...` (passed), `npm run typecheck` (0 errors), `npm run lint` (0 errors), `public-repo-guard` (5/5 passed), Terra peer review findings resolved (P2 strengthened SendMessageW WM_SETICON ICON_SMALL/ICON_BIG contract scan with real-file defect injection, P3 corrected desktop binary smoke command to dist-desktop\worship-deck.exe).
- SPEC-92-02 verification: PASS — `npm run smoke:spec-92` (4/4 passed), `npm run typecheck` (0 errors), `npm run lint` (0 errors), `public-repo-guard` (5/5 passed), Terra peer review findings resolved (Blocker verified standard Inno 4-arg DelTree and added MB_DEFBUTTON2 safe default, High/Med section-isolated [Setup] and IDYES-nested DelTree contract scanning with real-file defect injection).
- SPEC-92-03 verification: PASS — `npm run smoke:spec-92` (8/8 passed), `npm run smoke:spec-91` (10/10 passed), `npm run typecheck` (0 errors), `npm run lint` (0 errors), `npm run spa:build` (0 errors), `public-repo-guard` (5/5 passed), Terra peer review findings resolved (P2 mandatory extension in regex rejecting bare and 65-char hashes, P2 download-only 404 catch preserving local upload failure semantics, P2 behavioral execution simulation test covering 404/401/checksum/local error branches).
- SPEC-92-04 verification: PASS — `npm run smoke:spec-92` (12/12 passed), `go test ./cmd/... ./internal/...` (all passed), `npm run typecheck` (0 errors), `npm run lint` (0 errors), `npm run spa:build` (0 errors), `tests/i18n.test.mjs` (13/13 passed), `public-repo-guard` (5/5 passed), Terra peer review findings resolved (High clean wipe of all hymns/books/verses to guarantee canonical seed restoration, Med non-silent uploads cleanup error reporting and generic server error hiding internal sqlite details, Low unconditional 403 operator test and canonical hymn title assertion).

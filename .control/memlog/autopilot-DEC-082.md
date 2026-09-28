---
artifact: .control/decisions/DEC-082-daily-autopilot-mandate-desktop-dark-mode-congregation-f11-and-installer-metadata.md
---

# Autopilot Ledger — DEC-082

## Resume

- State: In-progress — Implementing SPEC-94 tickets (01..03)
- Run branch: autopilot/DEC-082 (Draft PR #129 open)
- Stopped at: SPEC-94-02 implemented and verified
- Blocked: —
- Parked: —
- Next: SPEC-94-03 implementation and verification in active worktree

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-082 for Desktop Dark Mode Title Bar, Congregation F11 Guidance, and Installer Metadata (SPEC-94) | waiting for interactive manual dispatch | low | .control/decisions/DEC-082-daily-autopilot-mandate-desktop-dark-mode-congregation-f11-and-installer-metadata.md |
| I-1 (SPEC-94-01) | internal/desktop/window_windows.go, internal/desktop/window_other.go, package.json, tests/desktop-dark-mode-titlebar.test.mjs | Implement Win32 immersive dark mode title bar integration with DWMWA_USE_IMMERSIVE_DARK_MODE (20) and fallback (19), registry AppsUseLightTheme detection with false fallback, and full fallback error return | leaving desktop title bar white in dark mode or suppressing fallback failures | low | internal/desktop/window_windows.go, internal/desktop/window_other.go, package.json, tests/desktop-dark-mode-titlebar.test.mjs |
| I-2 (SPEC-94-02) | src/projected/ProjectorClient.tsx, package.json, tests/congregation-fullscreen-guidance.test.mjs | Implement self-contained bilingual F11 fullscreen guidance overlay on congregation screen with 5s timeout, dual dismissal (F11 keydown without preventDefault and fullscreenchange), below-blanking z-40 positioning, and comprehensive defect injection tests | persistent operator chrome or leaving congregation operators without fullscreen guidance | low | src/projected/ProjectorClient.tsx, package.json, tests/congregation-fullscreen-guidance.test.mjs |

## Smoke Test Results

- Preflight verification: PASS — `validate.py --check --baseline` green, Go test suite passed (exit 0), `npm test` passed (exit 0; 1635 pass, 0 fail, 3 skipped), working tree clean.
- SPEC-94-01 verification: PASS — `npm run smoke:spec-94` (2/2 passed), `go test ./cmd/... ./internal/...` (all passed), `public-repo-guard` (5/5 passed), Terra peer review findings resolved and approved (HRESULT error return on dual fallback failure).
- SPEC-94-02 verification: PASS — `npm run smoke:spec-94` (4/4 passed), `npm run typecheck && npm run spa:build && npm run lint` passed (exit 0), `public-repo-guard` (5/5 passed), Terra peer review findings resolved and approved (expanded defect injection for timeout, preventDefault prohibition, blanking guard, and pointer hierarchy).

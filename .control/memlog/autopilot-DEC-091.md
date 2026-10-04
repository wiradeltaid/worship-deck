---
artifact: .control/decisions/DEC-091-daily-autopilot-mandate-presenter-overlays-and-session-recovery.md
---

# Autopilot Ledger — DEC-091

## Resume

- Iteration: I-1 (final)
- Run branch: autopilot/DEC-091
- Stopped at: Complete — All FR/Tickets/Specs in scope (SPEC-104 & SPEC-105) delivered, verified, and mandate applied
- Blocked: —
- Parked: —
- Next: Owner review and merge of PR

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-091 for Presenter Blank Transition, Scripture Overlay, and Session Recovery (SPEC-104 & SPEC-105) | waiting for interactive manual dispatch | low | .control/decisions/DEC-091-daily-autopilot-mandate-presenter-overlays-and-session-recovery.md |
| I-1 | SPEC-104-01 | Render persistent blackout layer at z-50 with 300ms opacity transition and pointer-events-none | abrupt conditional mounting and unmounting | hard visual cuts on auditorium projector and potential click blocking | src/projected/ProjectorClient.tsx, tests/projected-transitions.test.mjs |
| I-1 | SPEC-104-02 | Decouple scripture overlay into dedicated z-20 layer with entrance, exit, crossfade, and mount-time sync transitions | conditionally replacing SlideView inside incoming slide container | abrupt content swaps, flickering underlying slides, and missing fade animations | src/projected/ProjectorClient.tsx, tests/projected-transitions.test.mjs |
| I-1 | SPEC-104-03 | Implement combobox ARIA semantics, ArrowDown/Up/Enter/Escape navigation, shouldSuggestBooks boundary defense, and Go SuggestBooks chapter suppression | unconditional suggestions and un-intercepted keyboard events | distracting autocomplete dropdowns when typing chapters and inability to select books with keyboard | src/components/ScriptureRefAutocomplete.tsx, src/lib/scripture-autocomplete.ts, internal/scripture/match.go, internal/scripture/match_test.go, tests/scripture-controls-ergonomics.test.mjs |
| I-1 | SPEC-105-01 | Create PresenterSavedSessionV1 schema and helpers with 8h expiry, clock skew tolerance, index clamping, and fail-closed peek | unvalidated localStorage reads and raw truthiness checks | corrupted session state restoring into presenter and inaccurate active session status | src/lib/presenter-session.ts, tests/presenter-session-recovery.test.mjs |
| I-1 | SPEC-105-02 | Synchronously hydrate PresenterOperator state and refs from loadPresenterSession, persist user actions, and guard multi-tab authority | unhydrated state emitting index: 0 sync on reload and multi-tab write collisions | sanctuary projector resetting to slide 1 mid-service on operator reload and stale tab overwrites | src/operator/present/PresenterOperator.tsx, tests/presenter-reload-recovery.test.mjs |
| I-1 | SPEC-105-03 | Render adaptive Split Button in RunSheet with human 1-based slide indexing, session clearance on start-over, and focus listener | unconditional static Present link and risky mid-service resets | operator inadvertently resetting live presentation when navigating from run-sheet | spa/src/pages/RunSheetPage.tsx, tests/run-sheet-smart-resume.test.mjs |

## Smoke Test Results

- Preflight verification: PASS (Go test suite green, TypeScript typecheck green, public-repo-guard green, SPA build green, full Node test suite green)
- SPEC-104-01: PASS (ProjectorClient persistent blackout transition and pointer-events-none verified, tests/projected-transitions.test.mjs green)
- SPEC-104-02: PASS (ProjectorClient decoupled scripture overlay at z-20 with smooth entrance/exit/crossfade state machine verified, tests/projected-transitions.test.mjs green)
- SPEC-104: PASS (npm run smoke:spec-104, 14 tests green across tests/projected-transitions.test.mjs and tests/scripture-controls-ergonomics.test.mjs)
- SPEC-105-01: PASS (PresenterSavedSessionV1 schema, sanitization, expiry, and fail-closed peek verified, tests/presenter-session-recovery.test.mjs green)
- SPEC-105-02: PASS (PresenterOperator pre-sync hydration, index: 0 prevention, continuous persistence, and multi-tab authority verified, tests/presenter-reload-recovery.test.mjs green)
- SPEC-105: PASS (npm run smoke:spec-105, 15 tests green across tests/presenter-session-recovery.test.mjs, tests/presenter-reload-recovery.test.mjs, and tests/run-sheet-smart-resume.test.mjs)

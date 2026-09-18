---
artifact: .control/decisions/DEC-044-daily-autopilot-mandate-continuous-engineering-routine.md
---

# Autopilot Ledger — DEC-044

## Resume

- Iteration: 4
- Run branch: autopilot/DEC-044 (Draft PR #81: https://github.com/wiradeltaid/worship-presenter-web/pull/81)
- Stopped at: Done (SPEC-43-04 closed and verified green across all test suites)
- Blocked: —
- Parked: —
- Next: I-5 (SPEC-43-05)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-044 for continuous engineering routine (SPEC-43) | waiting for interactive dispatch | low | .control/decisions/DEC-044-daily-autopilot-mandate-continuous-engineering-routine.md |
| I-0 (start) | memlog | Open Draft PR #81 for autopilot DEC-044 iteration 0 | holding unpushed branch | low | .control/memlog/autopilot-DEC-044.md |
| I-1 (SPEC-43-01) | internal/httpapi & remote-client | Format remote pairing codes strictly as 6-digit zero-padded numbers (%06d), add request serialization queue, and support server pairing revocation via disconnect() | %0604d bug and uncoordinated asynchronous network races | high | internal/httpapi/remote.go, internal/httpapi/remote_test.go, src/lib/presenter-remote-client.ts |
| I-1 (peer-review) | peer-review & presenter | Enforce stopEpoch lifecycle boundaries in start(), disable dialog buttons during in-flight actions, and verify in-flight fetch cancellation via AbortSignal (Terra review) | start() after stop() deadlock, race conditions on rapid button clicks, or un-aborted in-flight requests | high | src/lib/presenter-remote-client.ts, src/operator/present/PresenterOperator.tsx, tests/smoke-spec-43.test.mjs |
| I-1 (SPEC-43-01) | PresenterOperator & smoke | Standardize Run-Sheet button to variant="outline", provide dedicated Remote Pairing dialog with 6-digit code, status, mobile URL, and verify with smoke tests and absence guards | unstyled inline remote code and ghost variant Run-Sheet button | medium | src/operator/present/PresenterOperator.tsx, tests/smoke-spec-43.test.mjs, package.json |
| I-2 (SPEC-43-02) | PresenterOperator & layout | Relax root container height clamping to min-h-dvh flex-col overflow-y-auto, establish Slides and Run-Sheet min-height floors, and preserve tuned stage formula | unscrollable cramped 768px laptop viewport clipping controls and previews | high | src/operator/present/PresenterOperator.tsx, tests/smoke-spec-43.test.mjs |
| I-2 (peer-review) | smoke & tests | Implement structural panel containment scanner and 8-form defect injection proof table covering all floor, overflow, and desktop/mobile caps (Terra review) | brittle class string replacement or un-injected guard branches | high | tests/smoke-spec-43.test.mjs |
| I-3 (SPEC-43-03) | ScriptureOverlayView & presenter | Implement dynamic scripture typography scaling (<60 chars: 8.5cqh/38cqh min-height ~45% screen presence), mirror on Current stage with status badge, and synchronize state across projector reloads via sync message | blind operator stage requiring physical neck-craning and tiny short verses | high | src/components/ScriptureOverlayView.tsx, src/lib/scripture-scaling.ts, src/lib/present-channel.ts, src/operator/present/PresenterOperator.tsx, src/projected/ProjectorClient.tsx |
| I-3 (peer-review) | smoke & tests | Add sync reload parity tests and exact-boundary scaling defect proofs (59/60, 119/120, 199/200 chars) with structural Current stage mirroring guards (Terra review) | disconnected projector reload losing live scripture or undetected layout shifts | high | tests/smoke-spec-43.test.mjs |
| I-4 (SPEC-43-04) | EditForm & CreateForm | Redesign song set inputs from cramped 2-column grid cards into orderly 1-row-per-song layout with bounded elements (Title, Book, Hymn, Background, Lyrics toggle) and flex-wrap responsiveness | cramped 2-column cards causing visual noise and desktop overflow | high | src/operator/EditForm.tsx, src/operator/CreateForm.tsx, tests/smoke-spec-43.test.mjs |
| I-4 (peer-review) | smoke & tests | Add real-file disk defect injection tests across EditForm.tsx and CreateForm.tsx covering outer grid, row slot, and inner sm:grid-cols-2 elimination with try/finally restoration (Terra review) | in-memory only string mutations bypassing real target file verification | high | tests/smoke-spec-43.test.mjs |

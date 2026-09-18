---
artifact: .control/decisions/DEC-044-daily-autopilot-mandate-continuous-engineering-routine.md
---

# Autopilot Ledger — DEC-044

## Resume

- Iteration: 1
- Run branch: autopilot/DEC-044 (Draft PR #81: https://github.com/wiradeltaid/worship-presenter-web/pull/81)
- Stopped at: Done (SPEC-43-01 closed and verified green across all test suites)
- Blocked: —
- Parked: —
- Next: I-2 (SPEC-43-02)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-044 for continuous engineering routine (SPEC-43) | waiting for interactive dispatch | low | .control/decisions/DEC-044-daily-autopilot-mandate-continuous-engineering-routine.md |
| I-0 (start) | memlog | Open Draft PR #81 for autopilot DEC-044 iteration 0 | holding unpushed branch | low | .control/memlog/autopilot-DEC-044.md |
| I-1 (SPEC-43-01) | internal/httpapi & remote-client | Format remote pairing codes strictly as 6-digit zero-padded numbers (%06d), add request serialization queue, and support server pairing revocation via disconnect() | %0604d bug and uncoordinated asynchronous network races | high | internal/httpapi/remote.go, internal/httpapi/remote_test.go, src/lib/presenter-remote-client.ts |
| I-1 (peer-review) | peer-review & presenter | Enforce stopEpoch lifecycle boundaries in start(), disable dialog buttons during in-flight actions, and verify in-flight fetch cancellation via AbortSignal (Terra review) | start() after stop() deadlock, race conditions on rapid button clicks, or un-aborted in-flight requests | high | src/lib/presenter-remote-client.ts, src/operator/present/PresenterOperator.tsx, tests/smoke-spec-43.test.mjs |
| I-1 (SPEC-43-01) | PresenterOperator & smoke | Standardize Run-Sheet button to variant="outline", provide dedicated Remote Pairing dialog with 6-digit code, status, mobile URL, and verify with smoke tests and absence guards | unstyled inline remote code and ghost variant Run-Sheet button | medium | src/operator/present/PresenterOperator.tsx, tests/smoke-spec-43.test.mjs, package.json |

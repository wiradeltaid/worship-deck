---
artifact: .control/decisions/DEC-089-daily-autopilot-mandate-guest-speaker-hdmi-and-presenter-resilience.md
---

# Autopilot Ledger — DEC-089

## Resume

- Iteration: I-1
- Run branch: autopilot/DEC-089 (PR #141)
- Stopped at: Done — All FR/Tickets/Specs in scope (SPEC-101, SPEC-102) completed
- Blocked: —
- Parked: —
- Next: Final local suite verification, cloud run trigger, and owner PR merge

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-089 for Guest Speaker HDMI Video Capture Input (SPEC-101) and Presenter Display Crash, Scripture Density & Warming Resilience (SPEC-102) | waiting for interactive manual dispatch | low | .control/decisions/DEC-089-daily-autopilot-mandate-guest-speaker-hdmi-and-presenter-resilience.md |
| I-1 | SPEC-101-01 | Build CaptureBroker with single projector clone slot and 5s preview readiness deadline | multi-consumer unbounded Set | driver contention and clone leak | src/lib/capture-broker.ts |
| I-1 | SPEC-101-02 | Wire guest feed controller with single projection ref across all four sync producers, 5s attach deadline, and Escape panic | fragmented projection state and manual sync overrides | desynchronization on reconnect or emergency edits | src/operator/present/presenter-guest-feed-controller.ts |
| I-1 | SPEC-101-03 | Build ProjectorGuestMediaBridge with opener consumer clone acquisition, 3s playback deadline, 1s re-emission, and contained video layer | direct getUserMedia in projector | device contention and double prompt | src/projected/projector-guest-media-bridge.ts |
| I-1 | SPEC-102-01 | Wrap DropdownMenuLabel in DropdownMenuGroup and decouple presentationLock from display launcher | raw label in content and lock-coupled launcher | Base UI unmount crash and locked-out screen launcher | src/operator/present/PresenterDisplayControl.tsx |
| I-1 | SPEC-102-02 | Scale scripture chapter typography adaptively by estimatedVisualLines and expand container height to 82cqh | rigid 4.8cqh font across all chapter slides | excessive vertical void on 4-6 line slides | src/lib/scripture-scaling.ts |
| I-1 | SPEC-102-03 | Strip translation suffixes strictly in ParseRef and persist failed_scripture_refs durably | accepting arbitrary suffixes or silent failure | 404 unhandled cache misses and no diagnostic feedback | internal/scripture/match.go |

## Smoke Test Results

- Preflight verification: PASS (Go test suite green, Node full test suite 1749 pass, 0 fail, 3 skipped)
- SPEC-101: PASS (npm run smoke:spec-101, 12 tests green)
- SPEC-102: PASS (tests/presenter-congregation-display-control.test.mjs 9 pass, tests/scripture-continuation-presentation.test.mjs 12 pass, tests/scripture-offline-resilience.test.mjs 14 pass)



# Issue 07 — First-Save-Wins Conflict Detection

**Status:** done

## Summary
Satisfies UC-23 (FR-28). First-save-wins refuses second concurrent save with 409 Conflict, alerting the operator when a service was edited elsewhere.

## Tests
- `tests/acceptance-fr16-fr19-fr28.test.mjs`
- `tests/services-lib.test.mjs`

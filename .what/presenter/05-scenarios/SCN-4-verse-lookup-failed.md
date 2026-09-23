---
type: scn
id: SCN-4
component: presenter
attaches_to: UC-13
created: 2026-08-18
updated: 2026-09-23
---

# SCN-4 — Verse lookup fails closed

## Where it branches

UC-13 step 1 (empty reference) and step 2 (unclear, missing, translation not installed — timeout is
OQ-60, not yet part of this branch's guarantee).

## Condition

The reference is empty, matches more than one book, matches none, or the requested translation is not
installed — all four fail closed today, confirmed against `internal/httpapi/scripture.go` and
`src/operator/present/PresenterOperator.tsx`'s `pushScripture`.

**A lookup that does not return before timeout is not yet part of this same guarantee.**
`pushScripture` has no `AbortController` or any timeout, and the server has no request-level deadline
either — a hung or slow lookup leaves the push button disabled indefinitely with no error ever shown,
unlike the four cases above. This is tracked as **OQ-60** (`.control/questions/assumptions.md`), not
resolved here.

Empty is a fail-closed miss here. It is not a silent success and not a no-op on UC-13.

## Flow

1. The system does not pick a guess.
2. No new overlay verse is sent. If an overlay is already showing, it stays; a failed lookup does not clear it.
3. The Deck slide at the original position remains; the Service payload does not change.
4. For the four closed cases, the Operator sees that lookup failed, then corrects the typing, chooses
   another translation, or retries. For a hung lookup (OQ-60), nothing tells the Operator it failed —
   the push control simply stays disabled.

## Outcome

The Congregation does not see a wrong verse mid-worship.

## Why it is not in the UC

Fail-closed failure plus translation choice would fatten the eight main steps.

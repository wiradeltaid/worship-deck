---
title: 'The remote screen on the phone'
type: 'feature'
created: '2026-08-22'
status: 'done'
baseline_revision: 'c1a1e8a'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '.how/presenter/02-contracts/03-remote-control.md'
  - '.what/presenter/SRS-presenter.md'
  - '.constitution/project/codebase-conventions-guide.md'
warnings:
  - 'No UX artifact exists. wdi-ux was skipped on this project by owner choice, so the brief is the owner sentence quoted below, not a design document. Do not invent a new interaction language.'
deferred: []
---

<intent-contract>

## Intent

**Problem:** The relay and the presenting client exist. There is nothing to hold in a hand.

**Approach:** A phone route that signs in, claims a pairing with the code shown on the laptop, mirrors
the presenting client's state, and sends the six existing intents. The owner's brief in full:
*"presenter viewnya sama aja, tapi mengontrol komputer utama."* The same presenter view, controlling the
main computer.

## Boundaries & Constraints

**Always:** shadcn primitives from `src/components/ui/`. Every new string registered in `keys.ts`,
`catalogue-en.ts` and `catalogue-id.ts` together. Placeholders substituted at the call site with
`.replace()` — this project's `t` takes exactly one argument.

**Never:** `return null` while loading — that is the page-flash defect the owner reported.
`router.refresh()` or `navigate(0)` — they remount the route and blank the page. Any display of the
projector's liveness: that is AD-29's predicate and this screen is not one of its inputs.

**Block If:** The screen needs a seventh intent. That is a change to `src/lib/present-channel.ts` under
AD-10 and is not this wave's.

</intent-contract>

## Acceptance

`tests/remote-screen.test.mjs` is a **source guard, not a behaviour test** — this project has no DOM and nothing that renders a React
component in a test, and pretending otherwise would make this story pass on a test that cannot fail. What
the guard asserts:

1. Only shadcn primitives from `src/components/ui/` are imported for interactive controls;
   `tests/operator-shadcn-guard.test.mjs` covers the same ground and must stay green.
2. Every string the new route renders resolves through `t` and every key exists in all three i18n files.
   `tests/i18n.test.mjs` and `tests/translator-guard.test.mjs` must stay green — the second fails on a
   second argument to `t`.
3. No `router.refresh()`, no `navigate(0)`, no `return null` on a loading branch.
4. The module sends only the six existing intent types, asserted against the `PresentMessage` union
   rather than a hand-copied list, so a seventh cannot appear without failing here.
5. Nothing in the module reads or renders projector liveness.

Prove guards 3, 4 and 5 by injecting each violation in turn and watching this test fail, then
reverting — one injection per claim, because a guard that catches one shape covers neither other.

**The real acceptance is a human smoke test, and it is named here rather than left implied:** on dev,
an Operator opens the presenting laptop, opens the phone route, pairs with the displayed code, and from
the phone advances a slide, blanks and unblanks, changes the background, and puts a verse up — watching
the room screen follow each one. Then locks the phone and confirms the laptop keeps driving. That is
FR-35's proof of done and no automated test in this repository can stand in for it.

## Reuse rather than invent

The controls live in `src/operator/present/PresenterOperator.tsx`. The three a person reaches for while
walking are **advance**, **blank**, and the **verse box**; give those the room and put the rest behind a
sheet or a scroll. One-handed means the primary controls sit within a thumb's reach at the bottom, not
in a top toolbar.

## Verification

`npm test`, `npm run typecheck`, `npm run spa:build`. Report failures with their output.

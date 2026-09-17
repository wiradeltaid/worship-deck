# SPEC-23-07 — Tests, Injection Proofs and Documentation

**Status:** closed

## Component & Scope

- **Component**: `registry`
- **Satisfies**: `UC-14`, `UC-6`
- **Files**: `tests/smoke-spec-23.test.mjs`, `tests/artifact-render-model.test.mjs`,
  `.how/registry/06-flows/canvas-authoring-controls.md`
- **Blocked by**: SPEC-23-06

## Context

SPEC-22 shipped a green suite over a defect that was still live. Every one of its fixtures constructed
`wrapLines` inline, so no test could notice that no stored element has the field. That is the failure mode
this ticket exists to prevent from recurring: a guard that asserts the shape of a fixture rather than the
state of the system.

## Implementation Requirements

Numbered steps are the work; MUST / MUST NOT marks a constraint the finished code has to satisfy.

1. **Tests land with their own ticket, not here.** Each of SPEC-23-01 … SPEC-23-06 lands the T-23-NN
   rows named in its own `Tests:` line, following the incremental pattern SPEC-19 and SPEC-20 used.
   This ticket owns only what cannot exist until the others are done: T-23-15 (stored-state
   invariant), T-23-16 (end-to-end line integrity), the injection proofs, and the documentation.
   If an earlier ticket shipped without its tests, that is a defect in that ticket — fix it there.
2. **Stored-state assertion (T-23-15).** Assert against the shipped registry
   (`WPW_USE_SHIPPED_REGISTRY=1`, the existing convention), not an inline fixture, so the class of miss
   described above is caught. Assert the invariant, not the literal.

   Scope it correctly, or it fails on day one for the wrong reason: SPEC-23-05 heals elements through
   the editor, so a shipped element may legitimately carry no measurement yet. The invariant is
   therefore **conditional**: every stored text element that carries `longestWordPx` satisfies
   `w >= longestWordPx * WRAP_SLACK_RATIO`. Add a second assertion for the other half — every stored
   element without a measurement produces byte-identical run-level XML to the pre-SPEC-23 build — so
   the unmeasured population is covered by a guard rather than by an exemption.

   **And assert the guard is not vacuous.** A conditional invariant over a population that is empty
   passes forever and proves nothing — that is precisely how SPEC-22 stayed green. T-23-15 MUST fail
   when no element in the asserted corpus carries a measurement at all. If the shipped seed carries
   none because measurements are written through the editor into the database, then the seed must
   gain at least one measured element as a committed fixture, or the guard must read the corpus that
   actually has them. Do not resolve this by weakening the assertion.
3. **Injection proofs.** Per AGENTS.md, every new absence-guard MUST be seen failing with the defect
   injected, once per form the guard claims to cover. Record each injection and its observed failure in
   `TEST-PLAN.md §4`. A guard narrowed to silence a false positive MUST be re-proven.
4. Run the full suite so it continues past the first failure. This repo's runner is `node --test`,
   which already does that: do not pass a bail flag, and do not run the guards one file at a time.
   (AGENTS.md's `--no-fail-fast` is cargo's flag and does not apply here.)
5. Update `.how/registry/06-flows/canvas-authoring-controls.md`: the slack invariant and why it exists, the
   two enforcement points, the font-readiness gate, and the fact that PPTX carries a font name rather than
   a binary. Documents follow the code — write what the code now does.
6. Do not weaken or delete a SPEC-21 or SPEC-22 guard to make a SPEC-23 guard pass. If two guards genuinely
   conflict, stop and raise it rather than choosing one.

## Acceptance Criteria

- [x] T-23-01 … T-23-18 present and passing.
- [x] T-23-15 fails when the asserted corpus contains no measured element.
- [x] At least one guard reads stored registry state, not an inline fixture.
- [x] Each injection proof recorded with the command run and the failure observed.
- [x] Every SPEC-21 and SPEC-22 test passes unmodified.
- [x] `canvas-authoring-controls.md` matches the shipped behaviour.
- [x] `npm test` green, public-repo guard included.

## Comments

- All automated tests T-23-01 through T-23-19 implemented and verified passing in `tests/smoke-spec-23.test.mjs`.
- Verified non-vacuous stored-state assertion T-23-15 over `data/default-registry.json`.
- Verified end-to-end contiguous run preservation for `international` in T-23-16.
- Recorded all 17 injection proofs in `TEST-PLAN.md §4`.
- Updated documentation in `.how/registry/06-flows/canvas-authoring-controls.md` covering metric slack invariant, dual enforcement points, font readiness gate, OOXML paragraph breaks, and PPTX font substitutions.
- Full suite `npm test` confirmed green.


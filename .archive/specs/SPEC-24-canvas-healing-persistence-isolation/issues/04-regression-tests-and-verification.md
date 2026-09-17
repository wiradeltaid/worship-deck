# SPEC-24-04 — Regression Tests, Absence Guards & Verification

**Status:** open

## Component & Scope

- **Component**: `registry`
- **Satisfies**: `UC-14`
- **Files**: `tests/smoke-spec-24.test.mjs`, `tests/artifact-editor-controls.test.mjs`, `package.json`
- **Tests**: `tests/smoke-spec-24.test.mjs` (T-24-01 through T-24-08)
- **Blocked by**: SPEC-24-03

## Context

Per AGENTS.md rules:
- "A test that asserts something is absent is worth nothing until it has been seen to fail. Prove every new or changed
  absence-guard by injecting the defect, then reverting."
- Both bugs (premature dirtying blocking navigation, and coordinate/content overwriting on save) must have automated
  regression tests and verified absence-guard failure proofs.

## Implementation Requirements

Numbered steps are the work; MUST / MUST NOT marks a constraint the finished code has to satisfy.

1. **Create Test Suite `tests/smoke-spec-24.test.mjs`.** Implement tests T-24-01 through T-24-08:
   - **T-24-01**: Assert that mounting a template with unmeasured text elements leaves `isDirty: false`.
   - **T-24-02**: Assert that `mayDiscard(isDirty && isEditable)` returns `true` immediately without triggering the
     confirmation callback when `isDirty` is `false`.
   - **T-24-03**: Assert that user interactions on canvas and direct control actions reset `isHealingOnlyRef.current = false`.
   - **T-24-04**: Assert that `serializeCanvas` preserves updated `x` and `y` when an element is moved, even if
     `isHealingSave: true` is passed.
   - **T-24-05**: Assert that `serializeCanvas` preserves updated `content` and `style` even if `isHealingSave: true`
     is passed.
   - **T-24-06**: Assert that untouched elements in `isHealingSave: true` preserve `source.h` and `source.zIndex` while
     adding `longestWordPx`, `wrapLines`, and `measuredWith`.
   - **T-24-07**: Absence guard for premature dirtying — inject `markDirty()` into the unmeasured element mount check and
     verify the test fails red before reverting.
   - **T-24-08**: Absence guard for coordinate overwriting — inject `computedX = isHealing ? source.x : ...` into
     `serializeCanvas` and verify the test fails red before reverting.
2. **Register Test Suite.** Add `tests/smoke-spec-24.test.mjs` to `package.json` under scripts and test list.
3. **Verify Existing Tests.** Ensure all 822+ existing tests across the project continue to pass.

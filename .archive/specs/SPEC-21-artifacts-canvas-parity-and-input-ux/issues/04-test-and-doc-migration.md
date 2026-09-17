# SPEC-21-04 — Test & Documentation Migration

**Status:** closed

## Component & Scope
- **Component**: `registry` (Test Suites & Documentation)
- **Satisfies**: `UC-14` (Template Authoring Controls)
- **Files**:
  - `tests/smoke-spec-21.test.mjs` (New test suite)
  - `tests/smoke-spec-20.test.mjs` (Update T-20-09)
  - `tests/smoke-spec-19.test.mjs`
  - `tests/artifact-editor-controls.test.mjs`
  - `.how/registry/06-flows/canvas-authoring-controls.md`
- **Tests**:
  - Full test suite: `npm test`

## Context & Requirements
SPEC-21 changes controlled input behavior, removes slide-boundary clamping from `serializeCanvas`, and updates line-height defaults. Existing test suites that assert the former behaviors must be migrated to prevent regressions while ensuring all 774+ tests pass green.

## Implementation Requirements

1. **New Automated Smoke Suite (`tests/smoke-spec-21.test.mjs`)**:
   - `T-21-01`: `commitFontSizeFromDraft` and `parseFontSizeDraft` pure helper functions (unit tests).
   - `T-21-02`: Source assertion: `ArtifactEditor.tsx` does not call `syncSelection` inside font size `onChange`.
   - `T-21-03`: `serializeCanvas` preserves off-canvas width (`x = 70%, w = 50%` -> `w = 50%`).
   - `T-21-04`: `serializeCanvas` preserves off-canvas height (`y = 85%, h = 30%` -> `h = 30%`).
   - `T-21-05`: Regression guard: height auto-sync still expands `h` when text grows.
   - `T-21-06`: Regression guard: intentional width narrowing via handles persists.
   - `T-21-07`: Source assertion: `splitByGrapheme: true` is absent from `ArtifactEditor.tsx`.
   - `T-21-08`: Source assertion: `getFontStack` is used in `elementToFabricObject`.
   - `T-21-09`: Source assertion: `TEXT_LINE_HEIGHT = 1.2` is aligned across editor and serializer; `1.16` default is eliminated.
   - `T-21-10`: Explicit line-height persistence (`lineHeight: 1.5` preserved).
   - `T-21-11`: Documentation scan: `.how/registry/06-flows/canvas-authoring-controls.md` documents off-canvas geometry allowance.

2. **Update `tests/smoke-spec-20.test.mjs`**:
   - In `T-20-09`, update the boundary clamping assertion from `assert.ok(serializedBottom[0].h <= 15.01)` to assert off-canvas preservation (`assert.equal(serializedBottom[0].h, 30)`).

3. **Update `tests/artifact-editor-controls.test.mjs`**:
   - Update any font size test expecting immediate canvas update on `onChange` to test commit on `onBlur` or Enter.
   - Update line height tests from `1.16` to `1.2`.

4. **Update `tests/smoke-spec-19.test.mjs`**:
   - Ensure documentation scan at line 269-271 accommodates the retired overflow badge and off-canvas wording.

## Acceptance Criteria
- [ ] `tests/smoke-spec-21.test.mjs` passes all T-21-01 to T-21-11 assertions.
- [ ] `tests/smoke-spec-20.test.mjs` passes cleanly with off-canvas preservation assertion.
- [ ] Full suite (`npm test`) passes 100% green.
- [ ] Public repository guard tests pass cleanly.

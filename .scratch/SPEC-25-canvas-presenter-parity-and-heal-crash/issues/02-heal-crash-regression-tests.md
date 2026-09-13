# SPEC-25-02 — Regression Tests & Absence Guard for the Heal Crash and Corruption

**Status:** open

## Component & Scope

- **Component**: `registry`
- **Satisfies**: `UC-14`
- **Files**: `tests/smoke-spec-25.test.mjs`, `package.json`
- **Tests**: `tests/smoke-spec-25.test.mjs`
- **Blocked by**: `SPEC-25-01`

## Context

SPEC-25-01 fixes `healTemplate()` by extracting and reusing `elementToFabricObject()`'s full construction, so
every element kind gets a real Fabric instance with full style fidelity. That fix needs a regression test that
actually exercises the code path that crashed and corrupted data — which no existing test does.
`tests/smoke-spec-23.test.mjs` calls `healTemplate(legacyTemplate, {})`: an empty object for `fabric`, and
Node's `test` runner has no `document` global, so `healTemplate()`'s environment branch always takes its
"Node/test-harness" fallback for the canvas itself (a hand-rolled object whose `add()` is a bare
`Array.push`, never invoking Fabric's `_onObjectAdded`/`_set`). Every existing healing test — for shapes,
images, and text alike — has always run through this forgiving fallback; the real `fabric` construction path
this bug lived in has never been exercised.

**Two constraints on how this must be tested, found during independent review — read before writing the test:**

- `import('fabric')` (the browser bundle, `dist/index.min.mjs`) references `window` and throws outside a
  browser; the Node-safe entry is `fabric/node` (`dist/index.node.mjs`), and its `StaticCanvas` works without
  a DOM. Use `fabric/node`, not bare `fabric`, in this test.
- Even via `fabric/node`, constructing a real `fabric.Textbox(...)` throws (`Cannot set properties of null
  (setting 'textBaseline')`) because there is no 2D rendering context available — `canvas` (node-canvas) is
  not installed in this repo, and depending on `jsdom` (present only as fabric's own optional dependency)
  from a test would be an undeclared dependency. **Do not add either as a new dependency for this ticket.**
  This means the *shape/image* construction-and-`canvas.add()` path (the actual BUG-33 crash trigger) can be
  exercised directly via `fabric/node` + `StaticCanvas`, but the *text* construction path cannot be
  instantiated as a real `Textbox` in this test environment.

This ticket does not cover BUG-34/SPEC-25-03 — its test requirements are named by that ticket once its
investigation lands a confirmed mechanism, not here.

## Implementation Requirements

Numbered steps are the work; MUST / MUST NOT marks a constraint the finished code has to satisfy.

1. **Crash regression: exercise the real construction+add path for shape/image elements.** Using
   `await import('fabric/node')` and a real `StaticCanvas`, call `healTemplate()` (or, if SPEC-25-01's
   extraction makes it more direct, the shared construction function plus `canvas.add()`) against a fixture
   template containing an unmeasured text element together with a shape element and an image-placeholder
   element — the exact combination that triggers BUG-33 (a template of only shapes/images never reaches the
   crash; see SPEC-25-01's Context). The test MUST assert this completes without throwing.
2. **Style-fidelity regression: assert on the constructed options, not by rendering.** Since a real `Textbox`
   cannot be instantiated in this test environment, prove text style fidelity by asserting on the *options
   object* the shared construction function builds for a text element (fill/fontColor, textAlign, lineHeight,
   underline, shadow presence) before it reaches `new fabric.Textbox(...)` — i.e., test the pure option-builder
   half of SPEC-25-01's extraction directly, independent of Fabric/DOM. This requires SPEC-25-01's extraction
   to expose that option-building step as something callable in isolation (a plain function returning a plain
   options object) — if SPEC-25-01 did not shape the extraction that way, this ticket's Step 1 amendment path
   applies: the split is a testability requirement, not an optional nicety.
3. **Shape/image style-fidelity regression.** For the shape and image-placeholder elements in the fixture from
   requirement 1, assert the real `fabric.Rect` instances constructed by the shared function carry the
   fixture's authored `fillColor`/`opacity` (or their `elementToFabricObject`-matching defaults), not Fabric's
   own un-styled defaults (`'rgb(0,0,0)'`/`1` with no authored value).
4. **Assert the untouched-element invariant end to end.** For a shape or image element that required no
   measurement change, assert its full serialized output (`x`, `y`, `w`, `h`, `zIndex`, `style` — including
   `fillColor`/`opacity`) is byte-identical before and after healing, via `serializeCanvas`'s actual output —
   mirroring the invariant `tests/smoke-spec-23.test.mjs` already proves for text geometry, extended to style
   and to every element kind.
5. **Idempotency across repeated runs, for shape/image too.** `tests/smoke-spec-23.test.mjs` already proves
   `healTemplate()` run twice on the same template produces zero further changes for text
   (`res1`/`res2`-style). Extend that same double-pass assertion to the fixture's shape and image-placeholder
   elements — SPEC-25-01's fix MUST NOT be proven only for a single pass.
6. **Absence-guard proof, per `AGENTS.md` — two injections, not one.** Prove both defects were real by
   reverting each fix independently, confirming the right test fails red, then restoring:
   - Revert SPEC-25-01's shape/image construction back to the bare object literal; confirm requirement 1's
     test fails with a `_set is not a function` (or equivalent "not a function") `TypeError`, not an unrelated
     failure.
   - Revert SPEC-25-01's text/shape construction back to the partial option set (drop `fill`/`textAlign`/
     `lineHeight`/`underline`/`shadow`/`opacity`); confirm requirements 2–3's tests fail on the specific
     corrupted field(s), not an unrelated failure.
   Both reversions MUST be demonstrated, not asserted from memory — run red, revert the revert, run green.
7. **Register the suite.** Add `tests/smoke-spec-25.test.mjs` to `package.json`'s test script/list, following
   the same registration `tests/smoke-spec-24.test.mjs` already uses.
8. **Full suite green.** All existing tests (830+ as of SPEC-24's close) MUST continue to pass alongside the
   new suite.

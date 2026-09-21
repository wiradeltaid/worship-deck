# Issue SPEC-55-04 — Browser-Parity Textbox Mocking and Drag-Release Regression Test Suite

**Status:** open  
**Spec:** SPEC-55  
**Component:** registry  
**Satisfies:** [UC-14, FR-20, FR-21]  
**Blocked by:** [SPEC-55-03]  
**Touches:** [artifacts, tests]  

## Description

Harden the test suite in `tests/smoke-spec-55.test.mjs` with browser-parity `fabric.Textbox` mocking, behavioral event-loop lifecycle tests (render -> drag -> release -> duplicate -> auto-expand), and prove all absence guards through defect injection.

## Key Changes

1. **Browser-Parity Textbox Mocking:**
   - In `tests/smoke-spec-55.test.mjs`, mock `fabric.Textbox` using a realistic constructor that captures options, asserting that `buildTextFabricOptions` produces `originX: 'center', originY: 'center'` and centered `left, top`.
   - Assert `fabricObj.type === 'textbox'`, preventing silent fall-through to headless mock stand-ins.
2. **Behavioral Move-Modified Round-Trip Invariant:**
   - Implement a behavioral event-loop test that executes the exact `onObjectMoving` and `onObjectModified` handlers:
     - Start from known `(x, y, w, h)`.
     - Move Fabric center `(left, top)`.
     - Trigger `onObjectModified`.
     - Assert that the resulting `liveElements` state matches the visual position without any `+w/2` or `-w/2` jumping (tolerance $\le 0.05\%$).
3. **Cardinal and Non-Cardinal Rotation Angle Parity:**
   - Test rotation geometry across cardinal angles (0°, 90°, 180°, 270°) and arbitrary angles (e.g. 37°) for text, shapes, lines, and images.
   - Test rotated text auto-expand at 0°, 90°, and 37°, verifying top-edge anchoring.
4. **Absence Guards & Defect Injection Proof:**
   - Add source code scans asserting that `buildTextFabricOptions` contains `originX: 'center'` and that `ArtifactEditor.tsx` routes through `centerPxToTopLeftPct`.
   - Inject defects (e.g. removing `originX: 'center'` from text, or reverting `onObjectModified` to raw `pxToPct(left)`), verify tests fail red, revert, and confirm green.

## Verification & Tests

- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/smoke-spec-55.test.mjs`: PASS (all tests pass).
- Defect injection proof executed and verified red-then-green for all guards.

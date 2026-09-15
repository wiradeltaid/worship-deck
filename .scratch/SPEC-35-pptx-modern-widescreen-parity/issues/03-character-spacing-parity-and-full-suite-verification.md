# SPEC-35-03 — Character Spacing Parity, Registered Conformance Suite, and Executable Absence Guards

**Status:** closed
**Blocked by:** SPEC-35-02

## What to build

Update export character-spacing patching for the modern 1:1 conversion contract, update the existing conformance assertions, and add executable regression guards that actually run in the named test suite.

1. In `src/lib/pptx-draw.ts`:
   - In `patchCharacterSpacing`, compute `spc = Math.round(letterSpacing * 100)`.
   - Preserve the existing semantics that absent or zero `letterSpacing` strips or emits no `spc` attribute, and that finite negative values retain their sign.
   - Update the function comment so it names the `* 100` formula and no longer documents the legacy `* 75` conversion.

2. Update existing coverage:
   - Update T-32-01 and T-32-05 in `tests/smoke-spec-32.test.mjs` from the `spc / 75` contract to `spc / 100` for a 540 pt modern slide. Cover positive, negative, zero, and one-unit rounding cases.
   - Update T-31-01 in `tests/smoke-spec-31.test.mjs` to use the modern 540 pt formula and the dynamic import-scale contract rather than an unconditional legacy constant.
   - Update `tests/pptx-conformance.test.mjs` and `tests/artifact-render-model.test.mjs` for wide export dimensions and 1:1 base font geometry.

3. Add `tests/smoke-spec-35.test.mjs`, and explicitly append it to the named `npm test` command in `package.json`; `npm test` does not glob this directory.
   - Generate a PPTX and inspect `ppt/presentation.xml`; require exactly `cx="12192000" cy="6858000"` and reject the legacy `cx="9144000" cy="5143500"` dimensions.
   - Use a complete `ResolvedElement` fixture to assert Canvas font 12 becomes `toPptxGeometry(...).fontSize === 12`, never 9.
   - Inspect an actual generated text run: `letterSpacing: 1.5` must emit `spc="150"`; `letterSpacing: -0.5` must emit `spc="-50"`; omitted and zero tracking must have no `spc` on their mapped runs.
   - Prove every new or changed absence guard red-then-green in the real files: inject legacy slide dimensions/layout, `PX_TO_PT = 0.75`, and the legacy tracking multiplier in turn; observe the corresponding test fail, then revert each defect before the final run.

## Acceptance criteria

- Exported text runs with `letterSpacing: 1.5` and `-0.5` emit `spc="150"` and `spc="-50"`; zero or absent spacing emits no `spc`.
- A generated PPTX archive declares 12,192,000 x 6,858,000 EMU and not the 9,144,000 x 5,143,500 legacy layout.
- The SPEC-35 smoke test is named in `package.json` and therefore runs under `npm test`.
- New absence guards are proven red-then-green using every defect form they claim to detect.
- `go test ./cmd/... ./internal/...`, `npm run spa:build`, and `npm test` pass.

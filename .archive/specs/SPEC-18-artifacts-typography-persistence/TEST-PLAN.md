# Test Plan — SPEC-18 (Artifacts Canvas Typography & Layout Persistence Follow-up)

## Test Targets

1. `internal/plan/validate_artifact.go` & `internal/plan/validate_artifact_test.go` (Go schema & validator for `textShadowBlur`)
2. `src/lib/registry/types.ts` & `src/lib/artifacts/runtime-contract.ts` (`TextStyle.textShadowBlur` & `ResolvedStyle.textShadowBlur`)
3. `src/lib/registry/validate.ts` (TS client validator `ALLOWED_STYLE_KEYS` parity)
4. `src/lib/registry/canvas-utils.ts` (`serializeTextStyle` blur serialization/cleanup & `serializeCanvas` width persistence)
5. `src/components/admin/ArtifactEditor.tsx` (Shadow blur hydration & Searchable Font Picker UI)
6. `src/components/artifacts/ArtifactSlide.tsx` & `src/lib/pptx-draw.ts` (Multi-surface shadow blur consumption with standardized default 4)

## Test Suites

### 1. Text Shadow Blur Validation & Serialization (`tests/artifact-editor-controls.test.mjs`, `src/lib/registry/validate.ts`, `internal/plan/validate_artifact_test.go`)
- Assert `internal/plan/validate_artifact.go` and `src/lib/registry/validate.ts` permit `textShadowBlur` in allowed style keys.
- Go unit tests in `internal/plan/validate_artifact_test.go`:
  - Valid `textShadowBlur` (`0`, `4`, `15`, `20`) passes validation.
  - Invalid values (negative numbers, strings, numbers > 20) fail validation.
- Assert `serializeTextStyle` saves `textShadowBlur` clamped to 0–20 when `textShadow` is enabled.
- Assert `serializeTextStyle` removes both `textShadow` and `textShadowBlur` when shadow is disabled/false.
- Assert `elementToFabricObject` passes `blur: element.style?.textShadowBlur ?? 4` into `fabric.Shadow`.
- Assert `ArtifactSlide.tsx` and `pptx-draw.ts` both consume `style?.textShadowBlur ?? 4` (standardized fallback 4).

### 2. Searchable Font Picker & Group Header Contrast (`tests/artifact-editor-layout.test.mjs`)
- Assert font family picker contains an integrated search input filtering fonts in real time.
- Assert typing a search query filters the displayed font list without breaking category header grouping.
- Assert category headers carry high-contrast background classes (`bg-muted/90`, `text-foreground`, `font-bold`).
- Assert properties toolbar container remains strictly locked at `h-[88px] min-h-[88px] max-h-[88px]` in all selection states.

### 3. Textbox Width Resize Persistence (`tests/artifact-editor-controls.test.mjs`)
- Assert `serializeCanvas` correctly detects changed `obj.width` when `scaleX = 1` (side-handle drag resize).
- Assert `serializeCanvas` correctly calculates width when text is scaled via corner handles (`scaleX !== 1`).
- Assert `serializeCanvas` writes `pxToPct(measuredWidth, CANVAS_WIDTH)` when `Math.abs(measuredWidth - authoredWidth) > 1px`.
- Assert untouched seed templates (specifically `welcome` element `w: 56.42`) preserve their exact original percentage when not resized.
- Behavioral test: resizing text box from `w: 56.42%` to `w: 80%` preserves `80%` through serialization, ensuring text remains on one line.

### 4. End-to-End Automated Smoke Test (`tests/smoke-spec-18.test.mjs`)
- Script checking:
  1. `textShadowBlur` in Go validator, TS types, and TS validator `validate.ts`.
  2. `serializeCanvas` textbox width update calculation and `welcome` slide round-trip fidelity.
  3. Searchable font picker and contrast header markup in `ArtifactEditor.tsx`.
  4. Standardized PPTX and web slide fallback blur = 4.
  5. Build and typecheck pass without errors.

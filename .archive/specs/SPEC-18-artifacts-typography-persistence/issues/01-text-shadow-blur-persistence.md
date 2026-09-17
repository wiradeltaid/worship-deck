# Ticket SPEC-18-01 — Text Shadow Blur Schema, Serialization, and Multi-Surface Persistence

**Status:** ready-for-agent

## Description

Add end-to-end persistence for the `shadowBlur` value (0–20). Currently, only boolean `textShadow` is stored, causing any customized blur value to revert to the default (4) upon reload.

## Requirements

1. **Go Schema & Validator (`internal/plan/validate_artifact.go` & `internal/plan/validate_artifact_test.go`)**:
   - Add `"textShadowBlur"` to `allowedStyleKeys`.
   - In `parseStyle`:
     ```go
     if v, ok := obj["textShadowBlur"]; ok {
         n, err := asNumber(v, label+".textShadowBlur")
         if err != nil {
             return nil, err
         }
         if n < 0 || n > 20 {
             return nil, failf("%s.textShadowBlur must be 0..20", label)
         }
         style["textShadowBlur"] = math.Round(n)
     }
     ```
   - In `internal/plan/validate_artifact_test.go`:
     - Test valid blur (`0`, `4`, `15`, `20`) passes.
     - Test invalid blur (negative, > 20, string) fails with descriptive error.

2. **TypeScript Types & Client Validator (`src/lib/registry/types.ts`, `runtime-contract.ts`, `validate.ts`)**:
   - In `src/lib/registry/types.ts` `TextStyle`, add `textShadowBlur?: number;`.
   - In `src/lib/artifacts/runtime-contract.ts` `ResolvedStyle`, add `textShadowBlur?: number;`.
   - In `src/lib/registry/validate.ts`, add `'textShadowBlur'` to `ALLOWED_STYLE_KEYS` and validate as finite number between 0 and 20.

3. **Serialization & Deserialization (`src/lib/registry/canvas-utils.ts` & `ArtifactEditor.tsx`)**:
   - In `src/lib/registry/canvas-utils.ts` `serializeTextStyle`:
     - Read blur from `(textObj.shadow as any)?.blur`.
     - When `textObj.shadow` is truthy, serialize `style.textShadow = true` and `style.textShadowBlur = Math.max(0, Math.min(20, Math.round(Number(blur) || 4)))`.
     - When `textObj.shadow` is falsy/disabled, remove both `style.textShadow` and `style.textShadowBlur`.
   - In `src/components/admin/ArtifactEditor.tsx`:
     - In `elementToFabricObject`:
       ```typescript
       const blur = typeof style?.textShadowBlur === 'number' ? style.textShadowBlur : 4;
       ...(style?.textShadow ? { shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.8)', blur, offsetX: 2, offsetY: 2 }) } : {}),
       ```
     - In `syncSelection`: sync `setShadowBlur` from `selectedText.shadow.blur`.

4. **Multi-Surface Rendering (`ArtifactSlide.tsx` & `pptx-draw.ts`)**:
   - In `ArtifactSlide.tsx`: use `textShadow: style?.textShadow ? `2px 2px ${style.textShadowBlur ?? 4}px rgba(0, 0, 0, 0.8)` : undefined`.
   - In `pptx-draw.ts`: use `blur: typeof style?.textShadowBlur === 'number' ? style.textShadowBlur : 4` (standardized fallback 4 across all surfaces).

5. **Automated Tests**:
   - Add unit tests in `tests/artifact-editor-controls.test.mjs` verifying blur serialization, removal on disable, and validator parity.
   - Run Go tests: `go test ./internal/plan/...`.

## Acceptance Criteria
- Setting shadow blur to custom values (e.g. 10 or 18) persists through Save and reload.
- Slideshow proyektor and PPTX export reflect the stored blur value with standardized default 4.
- TypeScript client validator and Go server validator remain in exact lockstep.

# SPEC-22-03 — Shared Export Text & Fit-Scale Contract

**Status:** ready-for-agent

## Component & Scope

- **Component**: `registry` + `hub`
- **Satisfies**: `UC-14`, `UC-6`
- **Files**:
  - `src/lib/artifacts/render-model.ts`
  - `src/lib/pptx-draw.ts`
- **Tests**: `tests/smoke-spec-22.test.mjs` (T-22-05, T-22-06, T-22-07), `tests/artifact-render-model.test.mjs`

## Context

Even with `margin: 0`, PPTX may re-wrap if OOXML receives a single paragraph string. Hard breaks from `wrapLines` prevent LibreOffice from applying character-level overflow. `estimateTextFitScale` must count soft-wrapped lines to avoid `fitScale = 1.0` on multi-line ink.

## Implementation Requirements

1. Add to `render-model.ts`:
   - `resolveWrapLineCount(element): number`
   - `resolveElementTextForPptx(element): string | undefined` — uses `wrapLines.join('\n')` when present, else `resolveElementText(element)`
2. Update `estimateTextFitScale` to use `resolveWrapLineCount` instead of `text.split('\n').length`.
3. Update `pptx-draw.ts` `renderTextElement` to call `resolveElementTextForPptx` instead of `resolveElementText`.
4. Keep `fit: 'shrink'` as safety net; with correct line count, Bandung fixture should remain at scale 1.0.

## Acceptance Criteria

- [ ] PPTX export of Bandung fixture does not split `international` mid-word (T-22-07).
- [ ] `estimateTextFitScale` uses 3 lines for fixture (T-22-06).
- [ ] `artifact-render-model.test.mjs` soft-wrap cases pass.
- [ ] Presenter path unchanged (still uses `resolveElementText` + CSS wrap).

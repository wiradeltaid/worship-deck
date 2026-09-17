# SPEC-22-01 — PPTX Zero-Margin Text Box Geometry

**Status:** ready-for-agent

## Component & Scope

- **Component**: `hub` (PPTX worker / `pptx-draw.ts`)
- **Satisfies**: `UC-14`, `UC-6`
- **Files**: `src/lib/pptx-draw.ts`
- **Tests**: `tests/smoke-spec-22.test.mjs` (T-22-01, T-22-02)

## Context

`renderTextElement` passes geometry `{ x, y, w, h }` to `slide.addText` without `margin`. PowerPoint applies default "Normal" insets (0.1in left+right), narrowing the wrap column by ~19.2px vs Canvas/Presenter. This is the primary trigger for the Bandung `international` mid-word split in LibreOffice.

## Implementation Requirements

1. In `renderTextElement`, add `margin: 0` to the `slide.addText` options object.
2. Apply the same margin to `addImageUnavailable` fallback text for consistency (optional but recommended).
3. Add a one-line comment referencing SPEC-22 and cross-renderer content-box parity.

## Acceptance Criteria

- [ ] `pptx-draw.ts` passes `margin: 0` on all `slide.addText` calls in the artifact renderer path.
- [ ] T-22-01 source guard passes.
- [ ] T-22-02 OOXML inset guard passes on generated fixture deck.
- [ ] No change to non-text `addText` usages outside artifact rendering unless they share the same parity requirement.

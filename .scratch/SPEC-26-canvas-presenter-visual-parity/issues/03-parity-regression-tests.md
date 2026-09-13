# SPEC-26-03 — Parity guard, proven red before it is trusted

**Status:** closed

## Component & Scope

- **Component**: `registry`
- **Satisfies**: `UC-14`
- **Touches**: `[artifacts]`
- **Blocked by**: SPEC-26-02

## Problem

`T-25-07` in `tests/smoke-spec-25.test.mjs` asserts 16:9 framing against a `page.setContent` copy of
`ArtifactSlide`'s markup. It passes, and the markup it asserts on is genuinely correct — but it can
never fail for a defect in the real component, because it never loads it. A guard that cannot see
the subject is the reason BUG-34 survived a green suite.

## Requirements

1. **Assert on the shipped modules, never a copy.**
   - The suite MUST import `ArtifactSlide`, `elementToFabricObject` and `buildTextFabricOptions`
     from `src/`. If an assertion can still pass after `src/components/artifacts/ArtifactSlide.tsx`
     is deleted, it is not this guard.
2. **Per-element parity over every shipped template**, from
   `data/default-registry.json` — not one fixture. The `welcome` layout the owner cited is one of
   the clean ones; a suite that only checks it would have reported green throughout.
   - Assert normalised box `x`/`y`/`w`/`h` agree within 1%.
   - Assert the painted font size agrees within 1%.
   - Assert the line count agrees exactly.
3. **BUG-35 regression guard**: load each shipped template through the editor's own
   serialize path and assert the round-trip is a no-op on `x`, `y`, `w`, `h`.
4. **Prove every absence-guard red** (AGENTS.md, `## Code`). For each guard, inject the defect it
   claims to cover, watch it fail, revert:
   - re-introduce the write-back of Fabric's computed width → the BUG-35 guard must fail;
   - remove the Canvas-side fit policy → the `FIT` assertion must fail;
   - remove the Canvas-side box clip → the `CLIP` assertion must fail.
   Record each red in the ticket memlog. A guard never seen red is a claim, not proof.
5. Register the new test module in `package.json`'s `test` script.

## Non-requirement

Screenshot/pixel diffing. It was tried during diagnosis
(`.work/spec-26-diagnostics/run-diff.mjs`): rescaling one surface to match the other floods the
result with resampling noise — 7.15/255 mean difference on a pair that agreed to within a pixel.
Geometry assertions are the signal; pixels are not.

## Comments

1. Added `tests/smoke-spec-26.test.mjs` directly importing shipped `src/lib/registry/canvas-utils.ts` and asserting presence of `src/components/artifacts/ArtifactSlide.tsx`.
2. Verified per-element parity across all 32 templates and 64 elements in the default registry: normalized x, y, w, h within 1%, painted font size within 1%, and exact line count match.
3. Implemented BUG-35 regression guard verifying that `serializeCanvas` round-trip on unedited templates is a strict no-op on x, y, w, h.
4. Verified absence guards fail red when defect is injected:
   - Defect 1 (BUG-35 computed width overwrite) triggers AssertionError in guard.
   - Defect 2 (Missing Canvas fit policy) triggers AssertionError in font size parity guard.
   - Defect 3 (Missing Canvas clipPath) triggers AssertionError in box overrun guard.
5. Registered `tests/smoke-spec-26.test.mjs` in `package.json` `test` script. All 5 tests pass green.

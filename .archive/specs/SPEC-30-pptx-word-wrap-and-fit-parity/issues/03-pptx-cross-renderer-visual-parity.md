# SPEC-30-03 — PPTX Fallback-Wrap Conformance Evidence

**Status:** open
**Blocked by:** SPEC-30-02

## What to build

Create `tests/smoke-spec-30.test.mjs`, register it explicitly in the root `package.json` `test` script, and test production paths rather than copied layout helpers.

1. Build a synthetic fixture matching the reported dimensions and typography (`fontSize: 180`, `w: 102.154541015625`, line height `0.8`, content `"Bandung international community"`). It may use a synthetic ID; no congregation template or user data belongs in the test.
2. Exercise `estimateTextFitScale`, `resolveTextRunsForPptx`, and `generatePptxFromPlan`. Inspect `ppt/slides/slide1.xml` to prove one paragraph with the expected soft breaks and complete-token text runs.
3. Cover trusted metadata/snapshots, stale and missing metadata, malformed `wrapLines`, placeholder-substituted text, repeated whitespace, punctuation, non-breaking spaces, explicit newlines, blank paragraphs, and a token below `MIN_TEXT_FIT_SCALE`.
4. Keep behavioral claims honest: XML verifies exporter structure, not visible glyph placement. When PowerPoint COM is available on Windows, run and record the existing real-PowerPoint conformance/smoke workflow for the reproduction fixture; otherwise report it as unavailable rather than passing it by implication.
5. Prove every absence guard against the real code path: inject zero fallback width, disable fallback partitioning, and inject an intra-token split; observe the relevant test fail, then revert each injection.

## Acceptance criteria

- `tests/smoke-spec-30.test.mjs` runs through the registered `npm test` command and passes independently with the repository TypeScript loader.
- The reproduction fixture resolves whole-token PPTX runs and a width-constrained scale; generated OOXML contains the expected `<a:br/>` count and no character-fragment text run.
- The tests distinguish valid snapshots from invalid ones and confirm paragraph preservation, scale-floor behavior, and token indivisibility.
- The test file names what source/XML assertions prove and records the PowerPoint visual smoke result or its explicit unavailability.
- The targeted SPEC-30 test, `smoke-spec-29`, relevant render/PPTX regression suites, the public-repository guard, and full `npm test` pass after the implementation.

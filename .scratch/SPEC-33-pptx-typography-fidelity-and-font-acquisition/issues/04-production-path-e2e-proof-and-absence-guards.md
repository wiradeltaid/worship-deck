# SPEC-33-04 — Production-Path Import-to-Acquisition End-to-End Demo and Absence Guards

**Status:** open
**Blocked by:** SPEC-33-03

## What to build

Provide complete production-path end-to-end integration and automated proof:

1. End-to-end demo slice in `tests/smoke-spec-33.test.mjs`:
   - Import a synthetic PPTX containing:
     - Slide 1: Unacquired script font ("The Youngest") with "Welcome to".
     - Slide 2: Tracked uppercase heading ("BANDUNG INTERNATIONAL COMMUNITY") with `letterSpacing: 16.89px` and Montserrat.
   - Verify import returns `fontStatus: "unresolved"` warning for "The Youngest".
   - Upload the missing font binary via `POST /api/admin/fonts`, confirming atomic `font_faces` insertion.
   - Verify live client hydration via `registerDynamicFontFace()` and verify `applyFabricTextFit()` fits `BANDUNG INTERNATIONAL COMMUNITY` onto a single line without wrapping.
   - Generate export PPTX with worker, confirming TrueType font embedding and OOXML `spc` round-trip.
2. Verified Absence Guards:
   - Absence guard: `pptxSafe: false` warning is absent for all curated Google Fonts.
   - Absence guard: `inner.style.letterSpacing` is not missing during `applyFabricTextFit()` binary search.
   - Prove each absence guard red-then-green by injecting real production defects, then reverting.
3. Cleanliness:
   - Verify `tests/public-repo-guard.test.mjs` and complete `npm test` pass.

## Acceptance criteria

- `tests/smoke-spec-33.test.mjs` passes end-to-end across Go API, Vite client modules, and PPTX worker.
- Absence guards are verified red-then-green.
- Public repository hygiene test passes with zero sensitive artifacts.

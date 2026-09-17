# SPEC-32-01 — Import Typography Contract

**Status:** open
**Blocked by:** none

## What to build

In `internal/pptximport`, establish the single-style typography import contract:

1. Parse the first supported effective run-property source (`a:rPr`, then paragraph default/end-paragraph properties) for family, size, `b`, `i`, and signed `spc`.
2. Normalize only complete, recognized terminal weight/style suffix sequences, preserving an unrecognized family verbatim. Store canonical `fontFamily`, exact CSS `fontWeight`, `fontStyle`, original `pptxTypeface`, and finite `letterSpacing = spc / 75`.
3. Register `letterSpacing` and `pptxTypeface` in the matching Go/TypeScript schema and validators. A source `spc` absence remains undefined.
4. Warn when an element contains mixed run typography that the current one-style-per-element schema cannot represent. Do not silently claim it was faithfully imported.

## Acceptance criteria

- Variants, explicit XML precedence, hyphen/space forms, unrecognized final words, no run properties, positive/negative/absent `spc`, and mixed-run warnings are covered by importer fixtures.
- `Montserrat Light` remains weight `300` and `Montserrat Black` remains `900`; neither path is reduced to a boolean representation.
- The import/export data contract preserves `pptxTypeface` until the editor changes family, weight, or style.

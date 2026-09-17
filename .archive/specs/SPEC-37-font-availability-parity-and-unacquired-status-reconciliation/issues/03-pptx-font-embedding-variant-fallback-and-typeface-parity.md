# SPEC-37-03 — PPTX Font Embedding Variant Fallback, License Safety, and Typeface Canonicalization

**Status:** closed
**Blocked by:** none

## What to build

Fix PPTX font embedding and typeface referencing in `src/lib/fonts/embed-fonts.ts`, `src/lib/pptx-draw.ts`, and `src/lib/artifacts/render-model.ts` so that custom font families with partial variant availability still embed cleanly without falling back in PowerPoint Desktop, DrawingML text runs align strictly with embedded font names, and restricted fonts are never illegally embedded.

1. **Typeface Name Canonicalization across Run & Embedding Boundaries:**
   - In `src/lib/pptx-draw.ts` and `src/lib/artifacts/render-model.ts`:
     - Establish a single canonical typeface resolver ensuring that:
       1. DrawingML text run options (`fontFace`),
       2. PPTX font usage collection (`usedFonts` mapping in `generatePptxFromPlan`), and
       3. `<p:font typeface="...">` in `embedPresentationFonts`
       use the exact same family name string.
     - When an element has `style.pptxTypeface` (e.g. `Montserrat Light`), ensure the text run refers to the typeface that is embedded in `<p:embeddedFont>`, eliminating silent PowerPoint Desktop font substitution.

2. **License-Aware Variant Fallback Selection:**
   - In `src/lib/fonts/embed-fonts.ts`:
     - When matching font usage `{ family, weight, style }` against `fontManifest`:
       - First attempt exact variant slot match (`resolveFontVariantKey(m.weight, m.style) === slot`).
       - If no exact variant face exists, search `fontManifest` for an available face belonging to that `family` where `!m.restricted`, preferring `regular`.
       - If all candidate faces for a family are restricted (`m.restricted === true`), do not embed the family and emit a substitution warning.
       - Map the fallback face into the required PresentationML variant slot (`<p:regular>`, `<p:bold>`, `<p:italic>`, `<p:boldItalic>`), ensuring exactly one relationship and embedded part per canonical `(family, slot)`.

3. **Archive Integrity and Conformance Verification:**
   - In `tests/smoke-spec-37.test.mjs`:
     - Register `tests/smoke-spec-37.test.mjs` in `package.json` under `npm test`.
     - Generate a PPTX presentation with slide text styled as `bold` using a custom font that only has a `regular` face in the manifest, and assert that the `.odttf` file and `<p:bold>` slot are emitted.
     - Assert that a presentation with an element carrying `style.pptxTypeface` emits matching typeface names in DrawingML and `<p:embeddedFont>`.
     - Assert that a font with `restricted: true` is not embedded when bold fallback is evaluated.
     - Assert round-trip de-obfuscation succeeds.

## Acceptance criteria

- Exported PPTX presentations containing formatted text (bold/italic) with single-face custom fonts include embedded `.odttf` font parts.
- Elements with `pptxTypeface` use matching names in text runs and `<p:embeddedFont>` so PowerPoint Desktop does not substitute fonts.
- Restricted font binaries are never embedded as variant fallbacks.
- `npm test` runs `tests/smoke-spec-37.test.mjs` cleanly.

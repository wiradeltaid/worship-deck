# Ticket SPEC-17-01 — 45-Font Catalog Embeds, Fallback Stacks, and Constant Deduplication

**Status:** closed

## Description

Complete the font catalog integration: wire Google Fonts `<link>` stylesheet embeds in `spa/index.html` and `spa/projected.html`, deduplicate `DEFAULT_FONT_FAMILY` across `canvas-utils.ts` and `render-model.ts` (re-exporting from `font-catalog.ts`), and add the automated unit test suite `tests/artifact-font-catalog.test.mjs`.

## Baseline Note for Agent
`src/lib/registry/font-catalog.ts` was already created in commit `0add8e0`. Do NOT recreate or overwrite it from scratch; build upon the existing catalog.

## Requirements

1. **Deduplicate `DEFAULT_FONT_FAMILY`**:
   - In `src/lib/registry/canvas-utils.ts`: replace literal `DEFAULT_FONT_FAMILY = 'Arial'` with `export { DEFAULT_FONT_FAMILY } from '@/lib/registry/font-catalog'`.
   - In `src/lib/artifacts/render-model.ts`: replace literal `DEFAULT_FONT_FAMILY = 'Arial'` with `export { DEFAULT_FONT_FAMILY } from '@/lib/registry/font-catalog'`.
   - In `src/lib/registry/font-catalog.ts`: ensure `DEFAULT_FONT_FAMILY = 'Arial'` is exported as the single canonical source.

2. **Web Font Embeds in SPA Templates**:
   - In `spa/index.html` and `spa/projected.html`:
     Add preconnect links and Google Fonts stylesheet link matching the output of `getGoogleFontsStylesheetUrl()`:
     ```html
     <link rel="preconnect" href="https://fonts.googleapis.com" />
     <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
     <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Roboto:wght@400;500;700&family=Open+Sans:wght@400;600;700&family=Lato:wght@400;700&family=Montserrat:wght@400;600;700;800&family=Poppins:wght@400;600;700&family=Nunito:wght@400;600;700&family=Raleway:wght@400;600;700&family=Oswald:wght@400;600;700&family=Barlow+Condensed:wght@400;600;700&family=DM+Sans:wght@400;500;700&family=Work+Sans:wght@400;600;700&family=Merriweather:wght@400;700&family=Playfair+Display:wght@400;600;700&family=Lora:wght@400;600;700&family=Cinzel:wght@400;600;700&family=Cormorant+Garamond:wght@400;600;700&family=PT+Serif:wght@400;700&family=EB+Garamond:wght@400;600;700&family=Baskervville:ital@0;1&family=Bebas+Neue&family=Anton&family=League+Spartan:wght@600;700;800&family=Righteous&family=Teko:wght@500;600;700&family=Abril+Fatface&family=Alfa+Slab+One&family=Russo+One&family=Great+Vibes&family=Pacifico&family=Caveat:wght@600;700&family=Dancing+Script:wght@600;700&family=Sacramento&family=Shadows+Into+Light&family=Satisfy&display=swap" />
     ```

3. **Unit Test Suite `tests/artifact-font-catalog.test.mjs`**:
   - Assert `FONT_CATALOG.length === 45`.
   - Assert exactly 5 categories (`system: 10`, `sans: 12`, `serif: 8`, `display: 8`, `script: 7`).
   - Assert every font has non-empty `family`, `label`, `category`, and `fallback`.
   - Assert `getFontStack(family)` returns `"<family>", <fallback>`.
   - Assert `getFontDefinition(family)` is case-insensitive and trims whitespace.
   - Assert `DEFAULT_FONT_FAMILY === 'Arial'`.

## Acceptance Criteria
- Single source of truth for `DEFAULT_FONT_FAMILY`.
- Web fonts embedded in `spa/index.html` and `spa/projected.html`.
- `tests/artifact-font-catalog.test.mjs` passes with 100% green assertions.

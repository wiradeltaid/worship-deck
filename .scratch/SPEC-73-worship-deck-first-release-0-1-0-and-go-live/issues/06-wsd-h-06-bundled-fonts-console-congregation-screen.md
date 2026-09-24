# 06: [WSD-H-06] Bundled fonts for console and congregation screen

**What to build:** In `package.json`, `spa/index.html`, `spa/projected.html`, `src/lib/registry/font-catalog.ts`, and test files:
1. Local Font Bundling via `@fontsource` (K4):
   - Install `@fontsource/<family>` packages (or local equivalents) for all 35 typography families defined in `src/lib/registry/font-catalog.ts`:
     Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Nunito, Raleway, Oswald, Barlow Condensed, DM Sans, Work Sans, Merriweather, Playfair Display, Lora, Cinzel, Cormorant Garamond, PT Serif, EB Garamond, Baskervville, Bebas Neue, Anton, League Spartan, Righteous, Teko, Abril Fatface, Alfa Slab One, Russo One, Great Vibes, Pacifico, Caveat, Dancing Script, Sacramento, Shadows Into Light, Satisfy.
   - Import the required weights and styles into the frontend bundle (or CSS bundle) matching catalog definitions.
2. Complete Elimination of Google Fonts CDN:
   - Remove Google Fonts `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` tags from `spa/index.html` and `spa/projected.html`.
   - In `src/lib/registry/font-catalog.ts`: delete Google CSS URL builder functions (`googleFont` and dynamic Google query generators).
3. License Verification:
   - Verify that all 35 bundled font packages carry valid SIL Open Font License 1.1 or Apache 2.0 licenses in their installed package files.
4. Testing & Absence Guards:
   - Reverse old tests in `tests/artifact-font-catalog.test.mjs` and `tests/smoke-spec-17.test.mjs` (which previously asserted presence of Google URLs) into strict absence guards.
   - Add `tests/bundled-fonts-guard.test.mjs` asserting that `spa/*.html` and `src/lib/registry/font-catalog.ts` contain zero references to `fonts.googleapis.com` or `fonts.gstatic.com`. Verify red first by injecting a Google font link, then green.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `font-bundling-spec.md`, `spa/index.html`, `spa/projected.html`, and `src/lib/registry/font-catalog.ts`.
- [x] Install and configure `@fontsource` packages for all 35 font families.
- [x] Remove Google Fonts `<link>` tags from `spa/index.html` and `spa/projected.html`.
- [x] Remove Google URL builders in `src/lib/registry/font-catalog.ts`.
- [x] Reverse `tests/artifact-font-catalog.test.mjs` and `tests/smoke-spec-17.test.mjs` to demand absence of Google Fonts.
- [x] Add `tests/bundled-fonts-guard.test.mjs` asserting zero Google font URLs. Verify red first, then green.
- [x] Add `tests/bundled-fonts-guard.test.mjs` to `package.json` `scripts.test`.
- [x] Verify `npm test` passes cleanly.

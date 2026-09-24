# 08: [WSD-H-08] Branding SVGs without Google Fonts and font notices

**What to build:** In `public/branding/`, `ATTRIBUTIONS.md`, and `THIRD-PARTY-NOTICES`:
1. Cleanse Branding SVGs:
   - In `public/branding/worship-deck-lockup-below.svg`, `worship-deck-lockup-right.svg`, and `worship-deck-lockup-right-white.svg`: remove `@import url("https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap");`.
   - Convert text elements in these SVGs to standalone path geometries (`<path d="...">`) or reference locally bundled typography so that SVG rendering triggers zero external network requests.
2. Establish Third-Party Font Notices:
   - Create `THIRD-PARTY-NOTICES` (or a dedicated section in `ATTRIBUTIONS.md`) comprehensively listing all 35 bundled font families, their copyright holders, and their respective SIL OFL 1.1 or Apache 2.0 license texts.
   - Configure installer and release staging to ship `THIRD-PARTY-NOTICES` with the Windows desktop distribution.
3. Testing & Final Absence Guard:
   - Add `tests/branding-svg-guard.test.mjs` asserting that no SVG in `public/` or `spa/` contains `@import` or external font URLs.
   - Add `tests/third-party-notices.test.mjs` verifying that all 35 font families from `font-catalog.ts` are documented in `THIRD-PARTY-NOTICES`.

**Blocked by:** 07-wsd-h-07-pptx-embedding-bundled-font-files.

**Status:** open

- [ ] Read `public/branding/worship-deck-lockup-*.svg` and `ATTRIBUTIONS.md`.
- [ ] Convert branding SVG text to paths and remove Google Fonts `@import` rules.
- [ ] Author `THIRD-PARTY-NOTICES` covering all 35 bundled font families and licenses.
- [ ] Add `tests/branding-svg-guard.test.mjs` asserting zero external URLs in SVGs. Verify red first, then green.
- [ ] Add `tests/third-party-notices.test.mjs` verifying coverage of all 35 families.
- [ ] Add new test files to `package.json` `scripts.test`.
- [ ] Verify `npm test` passes cleanly.

# 01: Bundle Curated Presentation Fonts (WSD-W1)

**What to build:** Install the 6 curated font packages via `@fontsource` (`@fontsource/plus-jakarta-sans`, `@fontsource/fraunces`, `@fontsource/source-serif-4`, `@fontsource/calistoga`, `@fontsource/cinzel-decorative`, `@fontsource/syne`) under SIL OFL 1.1 license and import their stylesheets into `spa/src/fonts.css`. Register the 6 font families in `FONT_CATALOG` in `src/lib/registry/font-catalog.ts` with appropriate categories (`sans`, `serif`, `display`), fallbacks, and universal PowerPoint substitution fallbacks. Download and stage their TrueType (.ttf) font files into `data/fonts/` (regular and bold variants where applicable: `Plus Jakarta Sans.ttf`, `Plus Jakarta Sans-bold.ttf`, `Fraunces.ttf`, `Fraunces-bold.ttf`, `Source Serif 4.ttf`, `Source Serif 4-bold.ttf`, `Calistoga.ttf`, `Cinzel Decorative.ttf`, `Cinzel Decorative-bold.ttf`, `Syne.ttf`, `Syne-bold.ttf`) for offline PPTX font embedding via `src/lib/fonts/embed-fonts.ts`. Author/update `tests/bundled-fonts-guard.test.mjs` verifying that all 41 bundled font families are present in `spa/src/fonts.css` and `data/fonts/`, with zero external network font references.

**Blocked by:** None (can start immediately).

**Status:** open

- [ ] Read `src/lib/registry/font-catalog.ts`, `spa/src/fonts.css`, and `src/lib/fonts/embed-fonts.ts` first.
- [ ] Install `@fontsource` packages for the 6 curated fonts:
      `npm install @fontsource/plus-jakarta-sans @fontsource/fraunces @fontsource/source-serif-4 @fontsource/calistoga @fontsource/cinzel-decorative @fontsource/syne`
- [ ] Import the font stylesheets into `spa/src/fonts.css`.
- [ ] In `src/lib/registry/font-catalog.ts`:
      - Add font definitions for:
        - `Plus Jakarta Sans` (`category: 'sans'`, `fallback: 'sans-serif'`, `pptxSubstitute: 'Arial'`, `embeddable: true`)
        - `Fraunces` (`category: 'display'`, `fallback: 'serif'`, `pptxSubstitute: 'Georgia'`, `embeddable: true`)
        - `Source Serif 4` (`category: 'serif'`, `fallback: 'serif'`, `pptxSubstitute: 'Times New Roman'`, `embeddable: true`)
        - `Calistoga` (`category: 'display'`, `fallback: 'serif'`, `pptxSubstitute: 'Georgia'`, `embeddable: true`)
        - `Cinzel Decorative` (`category: 'serif'`, `fallback: 'serif'`, `pptxSubstitute: 'Times New Roman'`, `embeddable: true`)
        - `Syne` (`category: 'display'`, `fallback: 'sans-serif'`, `pptxSubstitute: 'Arial'`, `embeddable: true`)
- [ ] Stage required TrueType `.ttf` files in `data/fonts/` for offline PPTX embedding.
- [ ] Run `tests/bundled-fonts-guard.test.mjs` and `npm run typecheck` to verify clean offline bundling.

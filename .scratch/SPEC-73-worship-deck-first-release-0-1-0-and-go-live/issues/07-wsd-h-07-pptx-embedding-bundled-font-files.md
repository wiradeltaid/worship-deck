# 07: [WSD-H-07] PPTX embedding from bundled font files

**What to build:** In `src/lib/fonts/embed-fonts.ts`, `data/fonts/`, and `workers/`:
1. Bundle TTF font assets for all 35 font families:
   - Provide local TrueType font (`.ttf`) files for the 35 families in `data/fonts/` (sourced from official `google/fonts` distributions under SIL OFL 1.1 / Apache 2.0).
   - Ensure the required variants (regular, bold, italic) matching the PPTX export requirements are present on disk.
2. Complete Elimination of Network Font Fetching in PPTX Worker:
   - In `src/lib/fonts/embed-fonts.ts`: remove `getFontData` network fetching logic that calls Google Fonts APIs over HTTP/HTTPS.
   - Update font loading to read strictly from the local `data/fonts/` directory.
   - If a requested font file is missing locally, fall back to a safe bundled default (e.g. Inter or system sans-serif) with an explicit warning, but never attempt external network calls.
3. Testing:
   - Add unit test `tests/pptx-bundled-fonts.test.mjs` verifying that `embed-fonts.ts` does not invoke network requests.
   - Assert that an offline PPTX export containing fonts from multiple categories (`sans`, `serif`, `display`, `script`) embeds fonts cleanly from local files.
   - Extend absence guard to verify zero network font fetching calls exist in `src/`. Verify red first, then green.

**Blocked by:** 06-wsd-h-06-bundled-fonts-console-congregation-screen.

**Status:** open

- [ ] Read `src/lib/fonts/embed-fonts.ts` and `workers/generate-pptx.js`.
- [ ] Bundle required TTF files for the 35 font families under `data/fonts/`.
- [ ] In `src/lib/fonts/embed-fonts.ts`: eliminate network `fetch` logic for Google Fonts.
- [ ] Add `tests/pptx-bundled-fonts.test.mjs` asserting offline PPTX font embedding without network requests.
- [ ] Add `tests/pptx-bundled-fonts.test.mjs` to `package.json` `scripts.test`.
- [ ] Verify `npm test` passes cleanly.

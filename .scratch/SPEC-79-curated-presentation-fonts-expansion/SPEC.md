# SPEC-79 — Curated Free Presentation Fonts Expansion

## Problem Statement

WorshipDeck currently bundles 35 open-source TrueType font families (and 10 universal system fonts, totaling 45 catalog fonts) offline. While standard modern sans-serifs (`Inter`, `Roboto`, `Open Sans`, `Montserrat`, `Poppins`) and classic formal serifs (`Merriweather`, `Playfair Display`, `EB Garamond`, `Baskervville`) are well represented, user feedback and hand testing identified noticeable typographical gaps in church slide production:

1. **Warm Retro Display (Cooper BT Style)**: Church worship teams frequently desire friendly, warm, heavy serif display typography for song titles, hymn numbers, and relaxed acoustic worship themes (traditionally styled with Cooper Black / Cooper BT). The current catalog lacks warm retro soft-curve display serifs.
2. **Long-Distance Projector Readability**: Low-contrast or low-resolution church projectors benefit from humanist geometric sans-serifs with open apertures and high x-heights tailored for long-distance legibility across congregational seating.
3. **Dedicated Scripture & Long-Passage Reading**: While `Playfair Display` and `Cormorant Garamond` are elegant for titles, their high stroke contrast can cause visual fatigue when reading multi-verse scripture passages or long announcements. A dedicated reading serif engineered for clarity is needed.
4. **Ceremonial & High-Impact Seasonal Titling**: Special services (Communion, Easter, Christmas, baptism, youth conferences) benefit from regal ceremonial capitals and modern high-impact display glyphs without relying on external design software.

Adding fonts carelessly risks bundle bloat and licensing compliance issues. All added fonts must strictly adhere to the project's legal standard: 100% free under SIL Open Font License (OFL 1.1) or Apache 2.0, packaged via standard `@fontsource` npm modules and offline TrueType (.ttf) files in `data/fonts/` for PPTX font embedding.

## Solution

Curate and bundle exactly **6 high-value presentation fonts** that fill distinct visual niches with full author provenance and zero licensing ambiguity:

1. **Plus Jakarta Sans** (SIL OFL 1.1):
   - **Foundry / Designer**: Gumpita Rahayu / Tokotype
   - **Category**: `sans`
   - **Role**: High-contrast, distant projector readability for lyrics, orders of service, and body reading. Humanist geometric sans with open counters, culturally resonant for Indonesian and international congregations.
   - **Distribution**: `@fontsource/plus-jakarta-sans`, Google Fonts TTF.
   - **Required Variants & Assets**: Regular (`Plus Jakarta Sans.ttf`), Bold (`Plus Jakarta Sans-bold.ttf`).

2. **Fraunces** (SIL OFL 1.1):
   - **Foundry / Designer**: Phaedra Charles, Flavia Zimbardi / Undercase Type
   - **Category**: `display`
   - **Role**: Warm retro soft-curve display serif. The premier open-source counterpart to Cooper Black / Cooper BT for warm acoustic song titles, sermon series, and friendly headings.
   - **Distribution**: `@fontsource/fraunces`, Google Fonts TTF.
   - **Required Variants & Assets**: Regular (`Fraunces.ttf`), Bold (`Fraunces-bold.ttf`).

3. **Source Serif 4** (SIL OFL 1.1):
   - **Foundry / Designer**: Frank Grießhammer / Adobe Systems
   - **Category**: `serif`
   - **Role**: Master reading serif engineered by Adobe specifically for comfortable reading of dense scriptures, responsive readings, and sermon outlines on projectors.
   - **Distribution**: `@fontsource/source-serif-4`, Google Fonts TTF.
   - **Required Variants & Assets**: Regular (`Source Serif 4.ttf`), Bold (`Source Serif 4-bold.ttf`).

4. **Calistoga** (SIL OFL 1.1):
   - **Foundry / Designer**: Yvonne Schüttler / Sorkin Type
   - **Category**: `display`
   - **Role**: Sturdy, friendly retro slab-serif display. Very low bundle footprint (single weight), punchy and distinctive for hymn numbers, dates, and festival headers.
   - **Distribution**: `@fontsource/calistoga`, Google Fonts TTF.
   - **Required Variants & Assets**: Regular (`Calistoga.ttf`).

5. **Cinzel Decorative** (SIL OFL 1.1):
   - **Foundry / Designer**: Natanael Gama
   - **Category**: `serif`
   - **Role**: Regal ceremonial capital lettering with classical Roman proportions. Perfect for Easter, Christmas, Communion, and high liturgical titles; harmoniously shares DNA with already-bundled `Cinzel`.
   - **Distribution**: `@fontsource/cinzel-decorative`, Google Fonts TTF.
   - **Required Variants & Assets**: Regular (`Cinzel Decorative.ttf`), Bold (`Cinzel Decorative-bold.ttf`).

6. **Syne** (SIL OFL 1.1):
   - **Foundry / Designer**: Lucas Descroix, Bonjour Monde / Synesthesie
   - **Category**: `display`
   - **Role**: High-impact modern geometric display. Distinct avant-garde aesthetic for youth nights, conference banners, announcements, and countdowns; distinct from condensed display fonts like Anton/Bebas Neue.
   - **Distribution**: `@fontsource/syne`, Google Fonts TTF.
   - **Required Variants & Assets**: Regular (`Syne.ttf`), Bold (`Syne-bold.ttf`).

### Explicitly Excluded / Deferred Candidates

- **Cabinet Grotesk**: **Rejected (Licensing Blocker)**. Distributed by Fontshare (Indian Type Foundry) under custom "Fontshare Free Software License", not SIL OFL or Apache 2.0. Incompatible with repository legal policy and absent from `@fontsource`.
- **Libre Baskerville**: **Rejected (Redundancy)**. Highly redundant with existing `Baskervville`, `EB Garamond`, and `Lora`.
- **Chango**: **Rejected (Tonal Mismatch / Bloat)**. Cartoonish/playful novelty font rarely suitable for church services.
- **Outfit / Figtree / Gabarito**: **Deferred (Overlap)**. High typographical overlap with `Inter`, `DM Sans`, `Work Sans`, `Poppins`, `Nunito`, and `Plus Jakarta Sans`.

## Integration & Verification

1. Install npm packages (`@fontsource/plus-jakarta-sans`, `@fontsource/fraunces`, `@fontsource/source-serif-4`, `@fontsource/calistoga`, `@fontsource/cinzel-decorative`, `@fontsource/syne`) and import into `spa/src/fonts.css`.
2. Register the 6 families in `src/lib/registry/font-catalog.ts` (raising catalog count from 45 to 51 fonts, and bundled non-system families from 35 to 41).
3. Place TrueType font files in `data/fonts/` for PPTX font embedding in `src/lib/fonts/embed-fonts.ts`.
4. Update `THIRD-PARTY-NOTICES` with full OFL 1.1 attribution and copyright statements.
5. Update `docs/public-facts.yaml` (`bundled_font_families_count: 41`).
6. Update/author automated tests in `tests/bundled-fonts-guard.test.mjs` and `tests/third-party-notices.test.mjs`.

## User Stories

1. As a worship leader choosing slide fonts for a warm acoustic praise song, I want to select Fraunces so that the title slide evokes a warm, retro Cooper BT aesthetic.
2. As a church projectionist on a low-resolution church projector, I want to choose Plus Jakarta Sans for hymn lyrics so that words remain crisp and legible from the back row.
3. As a pastor preparing a scripture reading slide with 10 verses, I want to choose Source Serif 4 so that the congregation can read the passage without eye strain.
4. As an announcement coordinator, I want to use Syne for youth event flyers and Calistoga for song numbers to create visually engaging titles.
5. As a repository maintainer, I want automated absence guards and license verification tests ensuring that all bundled fonts strictly remain under SIL OFL 1.1 with zero network dependencies.

# 02: Font Licensing Notices and Integrity Guards (WSD-W2)

**What to build:** Update legal attributions and public facts for the expanded font collection. In `THIRD-PARTY-NOTICES`, add full copyright notices and SIL Open Font License 1.1 text entries for the 6 new fonts (Plus Jakarta Sans by Tokotype, Fraunces by Undercase Type, Source Serif 4 by Adobe Systems, Calistoga by Sorkin Type, Cinzel Decorative by Natanael Gama, Syne by Synesthesie). In `docs/public-facts.yaml`, update `bundled_font_families_count` from 35 to 41. Verify that `installer/worship-deck.iss` and `scripts/build-desktop.mjs` automatically pick up the new fonts from `data/fonts/` into the Windows installer staging payload. Update `tests/third-party-notices.test.mjs`, `tests/public-facts.test.mjs`, and `tests/installer-corpora-staging.test.mjs` with executable defect injection proofs asserting that all 41 bundled families are fully attributed with zero missing license texts.

**Blocked by:** `SPEC-79-01` (Bundle Curated Presentation Fonts).

**Status:** closed

- [x] Read `THIRD-PARTY-NOTICES`, `docs/public-facts.yaml`, and `tests/third-party-notices.test.mjs` first.
- [x] In `THIRD-PARTY-NOTICES`:
      - Add attribution headers, copyright notices, and SIL Open Font License 1.1 blocks for:
        - Plus Jakarta Sans (Gumpita Rahayu / Tokotype)
        - Fraunces (Phaedra Charles, Flavia Zimbardi / Undercase Type)
        - Source Serif 4 (Frank Grießhammer / Adobe Systems)
        - Calistoga (Yvonne Schüttler / Sorkin Type)
        - Cinzel Decorative (Natanael Gama)
        - Syne (Lucas Descroix, Bonjour Monde / Synesthesie)
- [x] In `docs/public-facts.yaml`:
      - Update `bundled_font_families_count: 41`.
- [x] In `tests/third-party-notices.test.mjs`:
      - Update the expected font family count to 41 and ensure all 6 new fonts are validated.
- [x] Run `tests/third-party-notices.test.mjs`, `tests/public-facts.test.mjs`, and `tests/bundled-fonts-guard.test.mjs` to ensure 100% green execution.

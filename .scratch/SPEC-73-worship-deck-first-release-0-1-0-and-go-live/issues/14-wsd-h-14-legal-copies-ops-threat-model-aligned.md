# 14: [WSD-H-14] Legal copies from ops and threat model aligned

**What to build:** In `PRIVACY.md`, `PRIVACY.id.md`, `SECURITY.md`, `SECURITY.id.md`, and `docs/threat-model.md`:
1. Synchronize Legal Documents from Ops SSOT:
   - Copy the body of legal texts verbatim from the studio ops source (`ops/research/wdi-ecosystem-strategy/legal/worship-deck/`):
     - `PRIVACY.id.md` from `privacy.id.md`
     - `PRIVACY.md` from `privacy.en.md`
     - `SECURITY.id.md` from `security.id.md`
     - `SECURITY.md` from `security.en.md`
   - Omit the initial Indonesian commentary header blocks present in ops files.
   - Insert the prescribed English copy stamp on the second line immediately below the title:
     ```markdown
     <!-- Copied from the Wira Delta Indonesia legal source (worship-deck/<source-filename>) on YYYY-MM-DD.
          Edit the source, then copy it here again. -->
     ```
   - Ensure the effective date matches the finalized go-live date, and ensure cross-language relative links between `.id.md` and `.en.md` resolve cleanly.
2. Align `docs/threat-model.md`:
   - Update document title to "WorshipDeck" (retiring "Worship Presenter Web").
   - Align section 4 data deletion policies with actual behavior: deleting a service removes orphaned uploads; deleting announcement slides or background images removes database rows; deleting fonts deletes font files.
3. Verification & Absence Guard:
   - Add `tests/legal-copy-guard.test.mjs` asserting:
     (1) All four legal files contain the English copy stamp on line 2.
     (2) Zero occurrences of "Worship Presenter", `<TANGGAL GO-LIVE>`, `<GO-LIVE DATE>`, U+2014, or U+2013 across legal files and threat model.
     (3) All internal relative document links resolve to valid repository paths.
     Verify red first on today's files, then green.

**Blocked by:** 04-wsd-h-04-first-admin-setup-screen, 10-wsd-h-10-changelog-rewrite, 13-wsd-h-13-readme-translations-docs-match-build.
*(External Gate Prerequisites: Ops C-01 [effective date filled in ops], Ops C-02 [first-admin setup security exception drafted in ops], Ops C-03 [cross-language links added in ops], Owner B-03 [GitHub private vulnerability reporting enabled], and Owner B-04 [official go-live date confirmed]).*

**Status:** open

- [ ] Verify external prerequisites completed: ops C-01, C-02, C-03, owner B-03, and owner B-04.
- [ ] Inspect ops legal sources in `ops/research/wdi-ecosystem-strategy/legal/worship-deck/`.
- [ ] Copy `privacy.id.md` to `PRIVACY.id.md`, `privacy.en.md` to `PRIVACY.md`, `security.id.md` to `SECURITY.id.md`, and `security.en.md` to `SECURITY.md`.
- [ ] Add prescribed English copy stamp on line 2 of each file.
- [ ] Update `docs/threat-model.md` to "WorshipDeck" and align data deletion semantics.
- [ ] Add `tests/legal-copy-guard.test.mjs` validating copy stamps, dates, links, and absence of legacy names and dashes. Verify red first, then green.
- [ ] Add `tests/legal-copy-guard.test.mjs` to `package.json` `scripts.test`.
- [ ] Verify `npm test` passes cleanly.

# 11: [WSD-H-11] ATTRIBUTIONS scope refinement

**What to build:** In `ATTRIBUTIONS.md`:
1. Narrow Non-Monetisation Statement:
   - In `ATTRIBUTIONS.md:24-25`, the current text states: "Nothing in this project is sold, licensed for a fee, or monetised in any form."
   - Narrow this clause to refer strictly to the open-source software and its bundled corpora (matching the approved ops license copy: "WorshipDeck does not sell or license the software for a fee"), ensuring it does not improperly restrict Wira Delta Indonesia from providing professional installation, hosting, and customisation services.
2. Orthography & Public Standards:
   - Use American English spelling across the modified section (e.g. "monetized").
   - Eliminate any em-dashes or en-dashes in modified lines.
3. Verification:
   - Add `tests/attributions-guard.test.mjs` asserting that `ATTRIBUTIONS.md` does not contain the broad phrase "monetised in any form". Verify red first on today's file, then green.

**Blocked by:** 08-wsd-h-08-branding-svgs-font-notices.
*(Sequencing Rationale: Both WSD-H-08 and WSD-H-11 touch `ATTRIBUTIONS.md` and third-party notices. In accordance with handover §8.1 line 372 ("digabung PR dengan WSD-H-08 bila lebih rapi") and method rule `parallel-tickets-blocked`, sequencing H-11 downstream of H-08 provides a clean atomic commit boundary and avoids concurrent merge conflicts).*

**Status:** closed

- [x] Read `ATTRIBUTIONS.md` lines 20-35.
- [x] Refine the non-monetisation sentence to apply strictly to the software and corpora.
- [x] Add `tests/attributions-guard.test.mjs` asserting absence of "monetised in any form". Verify red first, then green.
- [x] Add `tests/attributions-guard.test.mjs` to `package.json` `scripts.test`.
- [x] Verify `npm test` passes cleanly.

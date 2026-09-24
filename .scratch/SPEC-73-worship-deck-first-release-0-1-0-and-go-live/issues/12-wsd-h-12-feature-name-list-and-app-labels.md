# 12: [WSD-H-12] One feature-name list and application label harmonization

**What to build:** In `src/lib/i18n/catalogue-en.ts`, `src/lib/i18n/catalogue-id.ts`, `src/operator/present/PresenterOperator.tsx`, and `spa/src/App.tsx`:
1. Establish Single Feature-Name List (Owner Confirmed):
   Harmonize all user-visible copy with the approved product decisions:
   - "congregation screen" / "layar jemaat" replaces "projector" / "proyektor" and "Open projector" across the entire UI.
   - "operator console" / "konsol operator" replaces generic console headers; "presenter bar" becomes "top bar of the operator console" / "bilah atas konsol operator".
   - "order of service" in English prose; "rundown" strictly in formal feature titles; "susunan acara" in Indonesian.
   - Parse button label in Indonesian (`form.parse`): "Baca susunan acara" replaces "Uraikan".
   - "Layout" / "Tata letak" replaces "Template" across UI labels and admin panels (Owner Decision Q4).
   - "Rundown Parser Profiles" removed from remaining catalog keys (conforming to SPEC-70 parser profile retirement).
2. Clean Hardcoded Strings in Components:
   - Move hardcoded strings in `PresenterOperator.tsx` (such as "Open projector" at lines 822 and 886) to keys in `catalogue-en.ts` and `catalogue-id.ts`.
3. Hide Mockup Route `/new` (Owner Decision Q3):
   - In `spa/src/App.tsx`: hide route `/new` from production navigation menus, header links, and production bundles, preserving it strictly for local development if needed without exposing unreviewed prototype flows to end users.
4. Testing & Guards:
   - Add `tests/operator-i18n-guard.test.mjs` asserting that the catalog files and operator UI strings contain zero occurrences of: "projector", "proyektor", "Open projector", "Parser Profile", "Uraikan", or "Template". Verify red first on today's code, then green.
   - Ensure `tests/i18n.test.mjs` passes with 100% key parity between English and Indonesian catalogues.

**Blocked by:** None (can start immediately; PR #109 merged, Owner Q3 and Q4 confirmed).

**Status:** closed

- [x] Read `src/lib/i18n/catalogue-en.ts`, `catalogue-id.ts`, and `src/operator/present/PresenterOperator.tsx`.
- [x] Update catalog keys for congregation screen, layout, order of service, and Indonesian parse button.
- [x] Replace hardcoded "Open projector" strings in `PresenterOperator.tsx` with localized catalog keys.
- [x] In `spa/src/App.tsx`: hide `/new` mockup route from production navigation.
- [x] Update `tests/operator-i18n-guard.test.mjs` to assert absence of prohibited terms. Verify red first, then green.
- [x] Verify `npm test` passes with full i18n key parity.

# 02: Scripture Comma Translation Normalization and Auto-Warming Resilience

**Satisfies:** [UC-13, FR-14, FR-19]
**Blocked by:** SPEC-103-01
**Status:** open

**What to build:** In `internal/scripture/match.go`, `src/lib/offline/service-snapshot.ts`, `internal/scripture/match_test.go`, and `tests/scripture-offline-resilience.test.mjs`:

1. **Backend Scripture Reference Normalization**:
   - In `internal/scripture/match.go` (`stripTranslationSuffix`):
     - Extend translation suffix stripping to match both parenthetical format and bare/comma-prefixed translation codes:
       comma or whitespace separator before supported translation codes (`KJV`, `NKJV`, `TB`, `NIV`, `ESV`, `BIMK`, `AYT`).
     - Order of sanitization: (1) strip translation suffix, (2) trim whitespace, (3) strip trailing punctuation (`[,;.]+`), (4) trim whitespace.
     - Ensure references like `"Hebrews 1:1, 2, NKJV"` cleanly become `"Hebrews 1:1, 2"`, so `parseVerseSpan` receives `"1, 2"` without trailing commas, parsing successfully (`ok: true`).
     - Preserve internal commas in verse spans (`1, 2` -> start 1, end 2).

2. **Frontend Offline Auto-Warming Sanitization**:
   - In `src/lib/offline/service-snapshot.ts` (`sanitizeScriptureRef`):
     - Update `TRANSLATION_BARE_RE` to match optional comma before bare translation codes:
       `/(?:\s*,\s*|\s+)(KJV|NKJV|TB|NIV|ESV|BIMK|AYT)\s*$/i`.
     - Follow identical sanitization sequence: strip suffix, trim whitespace, strip trailing punctuation (`s = s.replace(/[,;.]+$/, '').trim()`).
     - Ensure references such as `"Hebrews 1:1, 2, NKJV"` are sanitized to `"Hebrews 1:1, 2"` prior to querying `/api/scripture` and computing offline cache keys, preventing duplicate or mismatched cache keys.

3. **Automated Unit & Integration Tests**:
   - In `internal/scripture/match_test.go`:
     - Add test cases for comma-separated translation suffixes:
       - `Hebrews 1:1, 2, NKJV` -> `Hebrews`, chapter 1, start 1, end 2.
       - `Hebrews 1:1,2,NKJV` -> `Hebrews`, chapter 1, start 1, end 2.
       - `1 Korintus 13, TB` -> `1 Korintus`, chapter 13, whole chapter.
       - `John 3:16, KJV` -> `John`, chapter 3, start 16, end 16.
       - Reject commentary with commas: `John 3:16, sermon notes` -> `ok: false`.
   - In `tests/scripture-offline-resilience.test.mjs`:
     - Test that `extractRequiredScriptureRefs` normalizes `"Hebrews 1:1, 2, NKJV"` to `"Hebrews 1:1, 2"`.
     - Test that offline snapshot warming of Service 10 achieves `Offline Ready` with matching canonical cache keys.

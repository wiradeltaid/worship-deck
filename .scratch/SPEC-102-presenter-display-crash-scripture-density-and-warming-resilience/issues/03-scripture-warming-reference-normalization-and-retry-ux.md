# 03: Scripture Auto-Warming Reference Normalization & Retry UX

**Satisfies:** [UC-13, FR-14, FR-19]
**Blocked by:** none
**Status:** open

**What to build:** In `internal/scripture/match.go`, `src/lib/offline/service-snapshot.ts`, `src/components/offline/OfflineReadinessBadge.tsx`, `tests/scripture-offline-resilience.test.mjs`, and `internal/scripture/match_test.go`:

1. **Scripture Reference Sanitization & Normalization**:
   - In `internal/scripture/match.go` (`ParseRef`):
     - Strip trailing parenthetical translation annotations using a strict pattern matching supported translations: `/\s*\((KJV|NKJV|TB|NIV|ESV|BIMK|AYT)\)\s*$/i` and bare suffixes `/\s+(KJV|NKJV|TB|NIV|ESV|BIMK|AYT)\s*$/i` before chapter/verse parsing. Arbitrary malformed text (e.g. `John 3:16 (sermon)`) must not be silently accepted.
     - Retain existing comma-span support (`1, 2` -> start 1, end 2).
   - In `src/lib/offline/service-snapshot.ts` (`extractRequiredScriptureRefs`):
     - Filter out non-scripture placeholder tokens (`TBA`, `TBD`, `-`, `N/A`, `None`).
     - Apply identical translation suffix stripping prior to querying `/api/scripture` and deriving cache keys.

2. **Durable Diagnostic Persistence & Rehydration**:
   - In `src/lib/offline/service-snapshot.ts`:
     - Add `failed_scripture_refs?: string[]` to `OfflineServiceSnapshot` in IndexedDB.
     - When `warmServiceSnapshot` encounters unresolvable references, persist their specific names into `failed_scripture_refs`.
     - In `getServiceSnapshot()`, restore `snapshot.failed_scripture_refs` into `OfflineReadiness.scriptures.failedRefs`.
     - Define combined presentation when media failures and scripture failures co-exist: e.g. `Degraded: 1 asset, 1 scripture failed`.

3. **Offline Readiness Retry Feedback**:
   - In `src/components/offline/OfflineReadinessBadge.tsx`:
     - Provide detailed tooltip / status message identifying the exact failed reference(s) (e.g. `Degraded: 1 scripture failed ('Hebrews 1:1, 2')`).
     - On "Retry" button click:
       - Show visual busy state (`...`).
       - On completion, display explicit toast notification via `sonner`: `toast.success` if all assets/scriptures succeeded, or `toast.error('Gagal memuat ayat: ' + failedRefs.join(', '))`, eliminating the silent failure experience.

4. **Automated Tests**:
   - In `internal/scripture/match_test.go`:
     - Test parsing of supported translation annotations: `Hebrews 1:1, 2 (NKJV)`, `1 Korintus 13 (TB)`, `John 3:16 KJV`.
     - Test rejection of invalid parenthetical commentary: `John 3:16 (sermon notes)` -> `ok: false`.
   - In `tests/scripture-offline-resilience.test.mjs`:
     - Test placeholder filtering: verify `TBA` and `-` are not sent to warming.
     - Test durable persistence and rehydration: verify `failed_scripture_refs` survives snapshot reload.
     - Test retry outcome: verify toast notification on retry completion.

## Completion evidence

Record actual commands/results and defect-injection proofs when implemented. Leave checkboxes/status open until proven; inherited review reports do not close acceptance.

# 01: Presenter Session Recovery Helper and Schema

**Satisfies:** [UC-12, FR-16]
**Blocked by:** none
**Status:** open

**What to build:** In `src/lib/<presenter-session.ts>` and `tests/presenter-session-recovery.test.mjs`:

1. **Recovery Schema Definition**:
   ```ts
   import type { ScriptureOverlay } from './present-channel';
   import type { SlideTransition } from './transitions';

   export interface PresenterSavedSessionV1 {
     version: 1;
     planIdentity: string;
     updatedAt: number;
     activeSessionId: string;
     index: number;
     blank: boolean;
     scriptureOverlay: ScriptureOverlay | null;
     loadedScripture: {
       reference: string;
       verses: Array<{ verse: number; text: string }>;
       typographyMode: 'chapter' | 'verse';
     } | null;
     scripturePageIndex: number;
     liveTransition?: SlideTransition;
     liveBackground?: string | null;
   }
   ```

2. **Core Helper Functions**:
   - `getPresenterStorageKey(serviceId: number | string): string`: Returns `worship_deck_present_${serviceId}`.
   - `loadPresenterSession(serviceId: number | string, currentPlanIdentity: string, planLength: number): PresenterSavedSessionV1 | null`:
     - Reads raw string from `localStorage`.
     - Returns `null` if empty or storage throws.
     - Parses JSON safely; rejects if `version !== 1`.
     - Validates `planIdentity === currentPlanIdentity`. If plan identities differ, rejects and clears stale cache (returns `null`).
     - Validates expiration: `Date.now() - session.updatedAt <= 8 * 60 * 60 * 1000` and `session.updatedAt <= Date.now() + 60000`. If expired or corrupt future date, clears and returns `null`.
     - Sanitizes `index`: clamped to `Math.max(0, Math.min(Math.floor(session.index), planLength - 1))`.
     - Sanitizes `blank`: boolean coercion (`Boolean(session.blank)`).
     - Sanitizes `liveTransition`: validates against known `SLIDE_TRANSITIONS`.
     - Sanitizes `scriptureOverlay`: validates non-empty reference, text, verses array, and page index bounds. If corrupt, sanitizes to `null`.
     - Returns validated `PresenterSavedSessionV1`.
   - `savePresenterSession(serviceId: number | string, session: Omit<PresenterSavedSessionV1, 'version' | 'updatedAt'>): void`:
     - Constructs versioned payload with `version: 1` and `updatedAt: Date.now()`.
     - Serializes and stores in `localStorage` wrapped in `try/catch` (swallows quota/private mode errors gracefully).
   - `clearPresenterSession(serviceId: number | string): void`:
     - Removes `worship_deck_present_${serviceId}` from `localStorage` wrapped in `try/catch`.
   - `peekPresenterSession(serviceId: number | string, currentPlanIdentity: string): { hasSession: boolean; slideNumber: number; isBlank: boolean; hasScripture: boolean } | null`:
     - Strictly requires `currentPlanIdentity: string`.
     - Validates `planIdentity === currentPlanIdentity`, `version === 1`, and unexpired state.
     - Returns `{ hasSession: true, slideNumber: index + 1, isBlank, hasScripture }` if valid, otherwise `{ hasSession: false, slideNumber: 1, isBlank: false, hasScripture: false }`. Does not throw.

3. **Test Requirements (`tests/presenter-session-recovery.test.mjs`)**:
   - Valid session save and load round-trip.
   - Expiration after 8 hours (verifies rejection and cache eviction).
   - Future timestamp corruption rejection (`updatedAt > now + 60s`).
   - Plan identity mismatch fail-closed (verifies rejection when plan differs).
   - Non-integer / negative / out-of-range index clamping.
   - Malformed JSON and missing field handling without throwing.
   - Fail-closed `peekPresenterSession` on mismatched plan identity or expired session.
   - Storage error simulation (`quota exceeded`, `security error`) without crashing.

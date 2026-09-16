# SPEC-37-02 — Global SPA and Presenter Window Multi-Context Font Hydration

**Status:** open
**Blocked by:** none

## What to build

Ensure custom fonts imported into SQLite (`font_faces`) are hydrated into the browser's `document.fonts` across all application contexts, including page reloads/restarts and isolated multi-window projector popups.

1. **Top-Level Application Boot Hydration:**
   - In `spa/src/App.tsx`:
     - Add an initial `useEffect` that calls `hydrateImportedFonts()`.
     - Ensure this runs once on application start, making custom fonts immediately available on all routes (`/`, `/services/:id/present`, `/services/:id`, `/admin`).

2. **Single-Flight & Idempotent Hydration:**
   - In `src/lib/registry/font-catalog.ts`:
     - Ensure `hydrateImportedFonts()` retains an in-flight promise while loading so concurrent calls from `App.tsx`, `PresenterOperator.tsx`, or `ProjectorClient.tsx` do not send duplicate requests to `/api/fonts` or register duplicate `FontFace` instances.

3. **Presenter Command Center & Projector Popup Resilience:**
   - In `src/operator/present/PresenterOperator.tsx`:
     - Call `hydrateImportedFonts()` on mount as an idempotent defense-in-depth safeguard against cold direct navigation.
   - In `src/projected/ProjectorClient.tsx` (and `spa/src/pages/ProjectorPage.tsx`):
     - Because `window.open` spawns an isolated browsing context with its own `document.fonts` table, call `hydrateImportedFonts()` in `ProjectorClient` upon mounting.

4. **Regression Verification for Text Re-fit:**
   - Verify that existing `ArtifactSlide.tsx` logic re-runs `applyFit()` upon `document.fonts.ready` and `loadingdone`, ensuring slide text scales accurately without clipping when fonts settle.

5. **Multi-Window Playwright Verification:**
   - In `tests/smoke-spec-37.test.mjs`:
     - Test direct navigation to `/services/:id/present` in a fresh browser context and assert custom font presence in `document.fonts`.
     - Test clicking the projector launcher, capture the real popup via `page.waitForEvent('popup')`, and assert that the popup's `document.fonts` contains the custom font.

## Acceptance criteria

- Restarting or reloading Presenter Command Center (`Ctrl+R`) keeps custom fonts rendered without reverting to fallback.
- Presenter Window (`/present/projector`) renders the identical custom font as the Command Center.
- Multi-context font hydration does not execute redundant network calls or duplicate font face registrations.

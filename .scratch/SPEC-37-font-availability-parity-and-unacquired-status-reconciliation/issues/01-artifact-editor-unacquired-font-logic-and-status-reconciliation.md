# SPEC-37-01 — Artifact Editor Unacquired Font Warning Logic Correction and Element Status Reconciliation

**Status:** open
**Blocked by:** none

## What to build

Fix the stale unacquired font detection and element style status persistence in `src/components/admin/ArtifactEditor.tsx` so that when a font has been imported or is present in the font catalog, the editor does not continue displaying an "Unacquired Font" warning badge.

1. **Decouple Warning Indicator from Stale Property:**
   - In `ArtifactEditor.tsx` (around lines 4166–4173):
     - Replace the short-circuiting check:
       ```tsx
       const isFontAcquired = isFontExportReady(fontFamily) || Boolean(getFontDefinition(fontFamily));
       const isUnacquired = !isFontAcquired || (activeEl?.style?.fontStatus === 'unresolved' && !isFontAcquired);
       ```
     - Ensure that if `isFontAcquired` is true, `isUnacquired` evaluates to `false` and the warning badge `Unacquired Font` is hidden.

2. **Reconcile Element `fontStatus` on Batch Import:**
   - In `handleFontUploadBatch`:
     - When font faces are successfully registered, scan `liveElements` for all text elements whose `fontFamily` matches any of the uploaded families (case-insensitively).
     - Update their style to set `fontStatus: 'uploaded'` and remove stale warnings, even if the element was not selected at the moment the upload began.
     - Mark canvas dirty and synchronize state.

3. **Template Mount Reconciliation Pass & PPTX Import Recognition:**
   - In `loadTemplate` or initial template hydration in `ArtifactEditor.tsx`:
     - Check each text element: if its `fontFamily` is already defined in `FONT_CATALOG` or `FONT_MAP`, reconcile its `fontStatus` away from `'unresolved'` to avoid displaying false warnings on reloaded templates.
   - In `internal/httpapi/pptx_import.go`:
     - When constructing artifact templates from imported PPTX slides, check existing `font_faces` in SQLite: if an un-embedded custom font is already present in the database from a prior font import, mark its `fontStatus` as acquired/uploaded rather than `unresolved`.

4. **Absence Guard and Defect Injection Test:**
   - In `tests/smoke-spec-37.test.mjs`:
     - Assert that an element with `fontStatus: 'unresolved'` does NOT trigger `Unacquired Font` indicator if `fontFamily` is present in `FONT_CATALOG`.
     - Inject defect (restoring the stale OR short-circuit) and verify test goes red before passing.
     - Verify selector matches actual DOM text `Unacquired Font`.

## Acceptance criteria

- Selecting a text element whose font is in `FONT_CATALOG` never displays the `Unacquired Font` badge.
- Uploading a font via `+ Import Font` updates all canvas text elements using that family to resolved status.
- Reloading an imported PPTX template whose fonts have been acquired shows clean canvas text without unacquired warnings.

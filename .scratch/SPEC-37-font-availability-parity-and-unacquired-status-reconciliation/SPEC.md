# SPEC-37 — Cross-Surface Font Availability Parity, Multi-Context Hydration, and Unacquired Font Status Reconciliation

> **Status:** closed — all tickets implemented, verified, and closed.
> **Review:** 2026-09-16 · baseline `3c9c7c1` · lenses: structure, prose, edge-case-hunter.
> **Component:** registry, presenter, pptx (`src/components/admin/ArtifactEditor.tsx`, `src/operator/present/PresenterOperator.tsx`, `src/projected/ProjectorClient.tsx`, `spa/src/App.tsx`, `src/components/artifacts/ArtifactSlide.tsx`, `src/lib/fonts/embed-fonts.ts`, `src/lib/pptx-draw.ts`, `src/lib/artifacts/render-model.ts`, `src/lib/registry/font-catalog.ts`, `package.json`)
> **Touches:** artifacts, presenter, pptx, typography
> **Depends on:** SPEC-36

## 1. Problem statement

During manual and browser verification of SPEC-36 (Review 2026-09-16 06:02), two visual regression and parity defects were identified across the typography lifecycle:

1. **Finding 1 (Cross-Surface Font Availability Drift & Multi-Context Isolation):**
   - In Presenter Command Center (`/services/:id/present`), custom fonts only render if the browser session previously opened Artifact Editor within the same SPA tab. Upon page reload (`Ctrl+R`) or fresh session start, the Command Center reverts to standard fallback font (Arial) because custom fonts are not hydrated on mount.
   - In Presenter Window (`/services/:id/present/projector`), opened via `window.open` as an isolated popup, the new window has its own DOM and `document.fonts` context. Because the projector client never invokes `hydrateImportedFonts()`, the projector view permanently falls back to system fonts.
   - In PPTX export, if slide text runs specify a weight/style variant (e.g. `bold` or numeric `700`) while only a `regular` face exists in the font manifest, exact slot lookup fails and the font is omitted entirely from the exported archive, causing PowerPoint Desktop to substitute Arial.
   - In PPTX text runs, `resolveFontFamily()` prioritizes imported `style.pptxTypeface` (e.g. `Montserrat Light`), while PPTX usage collection and `<p:embeddedFont>` emission use typographic `fontFamily` (e.g. `Montserrat`). PowerPoint Desktop matches the text-run typeface attribute strictly against `<p:font typeface="...">`, causing silent substitution when names diverge.

2. **Finding 2 (Unacquired Font Warning Logic & Stale Status Persistence):**
   - In Artifact Editor (`/admin/artifacts`), when editing slides imported from PPTX or previously saved with `fontStatus: 'unresolved'`, the warning badge `Unacquired Font` persists in the toolbar even after the font binary has been uploaded, registered in SQLite, and rendered cleanly on the Fabric canvas.
   - The conditional check `activeEl?.style?.fontStatus === 'unresolved' || (!isFontExportReady(fontFamily) && !getFontDefinition(fontFamily))` short-circuits on the stale element property, ignoring whether the font definition is now present in the catalog or export-ready.

## 2. Decisions and invariants

### 2.1 Reconciled Unacquired Font Evaluation & State Synchronization (Finding 2)

- In `src/components/admin/ArtifactEditor.tsx`:
  - Decouple font acquisition evaluation from stale element style properties: a font is acquired if it exists in `getFontDefinition(fontFamily)` or satisfies `isFontExportReady(fontFamily)`.
  - The `Unacquired Font` warning indicator MUST NOT render if the font family is acquired, regardless of whether `activeEl.style.fontStatus` still contains `'unresolved'`.
  - When a font batch finishes uploading in `handleFontUploadBatch`, all elements in `liveElements` matching the successfully registered family (case-insensitive) MUST have their `fontStatus` normalized from `'unresolved'` to `'uploaded'`.
  - When an artifact template is loaded into `ArtifactEditor`, perform an initial reconciliation pass: any text element referencing a family that is already registered in `FONT_CATALOG` MUST have its `fontStatus` reconciled away from `'unresolved'` so stale warnings do not persist across reloads.
  - In `internal/httpapi/pptx_import.go`, when importing PPTX files containing custom fonts that were already uploaded/stored in SQLite (`font_faces`) from previous sessions, tag those elements as acquired/uploaded immediately instead of generating false `unresolved` warnings.

### 2.2 Global & Multi-Context Font Hydration across Operator and Projector Surfaces (Finding 1)

- In `spa/src/App.tsx`:
  - Trigger `hydrateImportedFonts()` at top-level application boot. Because `projected.html` mounts the same SPA root under `App.tsx`, both operator routes and projector popup contexts automatically load available custom fonts on initial mount.
- In `src/lib/registry/font-catalog.ts`:
  - Ensure `hydrateImportedFonts()` is strictly single-flight and idempotent. Simultaneous or repeated calls from `App.tsx`, `PresenterOperator.tsx`, or `ProjectorClient.tsx` must reuse the existing in-flight promise and never tear down or duplicate loaded `FontFace` instances.
- In `src/operator/present/PresenterOperator.tsx` & `src/projected/ProjectorClient.tsx`:
  - Call `hydrateImportedFonts()` on component mount as an idempotent defense-in-depth guarantee against cold window starts.
- In `src/components/artifacts/ArtifactSlide.tsx`:
  - Preserve and verify existing regression guard: `ArtifactSlide` already re-executes `applyFit()` upon `document.fonts.ready` and the `loadingdone` event, ensuring canvas text boxes adjust their font-scale immediately when custom fonts finish hydration.

### 2.3 PPTX Embedding Variant Fallback & Typeface Canonicalization (Finding 1 PPTX)

- **Typeface Name Alignment across Run and Embedding Boundaries:**
  - In `src/lib/pptx-draw.ts` and `src/lib/artifacts/render-model.ts`:
    - Establish a single canonical typeface resolver used identically by:
      1. DrawingML text run options (`fontFace: resolvePptxTypeface(style)`),
      2. PPTX font usage collection (`usedFonts` mapping in `generatePptxFromPlan`), and
      3. OpenXML font declaration (`<p:font typeface="...">` in `embedPresentationFonts`).
    - When `style.pptxTypeface` represents a specific variant (e.g. `Montserrat Light`) while the embedded font family is canonical `Montserrat`, the text run MUST reference the exact typeface declared in `<p:embeddedFont>` so PowerPoint Desktop does not substitute a system fallback.
- **License-Aware Variant Fallback Selection:**
  - In `src/lib/fonts/embed-fonts.ts`:
    - When iterating over `usageMap.values()` for each `{ family, weight, style }`:
      1. Attempt exact variant slot match (`resolveFontVariantKey(m.weight, m.style) === slot`).
      2. If no exact variant face exists, search `fontManifest` for an available non-restricted face (`!m.restricted`) belonging to that `family`, preferring `regular`.
      3. Restricted font entries (`m.restricted === true` per OS/2 fsType) MUST NEVER be selected as fallback faces. If all candidate faces for a family are restricted, omit the family and emit a substitution warning.
      4. Map the selected fallback face into the required PresentationML variant slot (`<p:regular>`, `<p:bold>`, `<p:italic>`, `<p:boldItalic>`) in `familySlotMap`, ensuring exactly one embedded part and relationship per canonical `(family, slot)`.

### 2.4 Testing & Absence Guards

- In `package.json`:
  - Register `tests/smoke-spec-37.test.mjs` in the `npm test` script runner.
- In `tests/smoke-spec-37.test.mjs`:
  - Unit tests verifying `Unacquired Font` badge suppression when font is registered in catalog.
  - Absence guards with defect injection for element `fontStatus` batch reconciliation.
  - PPTX tests asserting that a presentation with `style.pptxTypeface` emits identical typeface names in text runs and `<p:embeddedFont>`, and that missing bold/italic variants fallback to unrestricted regular faces while restricted faces are omitted.
  - Real popup Playwright test capturing `page.waitForEvent('popup')` and asserting that the projector window's `document.fonts` contains the imported custom font faces.

## 3. Tickets

- **SPEC-37-01:** Artifact Editor unacquired font warning logic correction and element status reconciliation.
- **SPEC-37-02:** Global SPA and Presenter Window multi-context font hydration.
- **SPEC-37-03:** PPTX font embedding variant fallback, license safety, and typeface canonicalization.

# SPEC-85 — Presentation Fidelity, Slide Visibility Control, and Operator Polish

## Requirement Traceability & Scope
- **PRD**: `operator-turn`, `offline-deck`
- **Architectural Decision**:
  - `AD-1` (Sabbath Guarantee: PPTX export Plan A, browser presentation Plan B)
  - `AD-10` (Plan identity fingerprinting)
  - `AD-29` (Projector liveness protocol & BroadcastChannel isolation)
- **Use Cases**:
  - `UC-14` (Visual Template & Artifact Editing)
  - `UC-18` (Offline Presentation Deck Guarantee — satisfies `FR-14`)
  - `UC-20` (Operator Service Management & View)
  - `UC-21` (Presenter Display and Control — satisfies `FR-16`)
  - `UC-22` (Projector Dual-Screen Display — satisfies `FR-19`)
- **Functional Requirements**:
  - `FR-14` (Offline Presentation Guarantee — PPTX fail-safe Plan A, in-browser presentation Plan B)
  - `FR-16` (Presenter View and Operator Control Surface)
  - `FR-19` (Auditorium Projector Output and Live Synchronization)
  - `FR-31` (Song-Set Background Overrides & Customization)
  - `FR-33` (Hymn & Song-Set Dynamic Parsing)
- **Components**: `hub`, `presenter`
- **Touches**: `services`, `projector`, `spa`, `presenter`, `pptx`, `present-channel`, `artifacts`

## Problem Statement

Hand-testing of the deployed dev environment (`https://presenter-dev.bic.my.id`) revealed six distinct ergonomics, visual fidelity, and workflow integrity gaps across the operator console, service management, and congregation projection surfaces:

1. **Presenter Run-Sheet Panel Vertical Height Underflow (`PresenterOperator.tsx`)**:
   - In `/services/{id}/present`, the bottom-right Run-Sheet panel (`<aside>`) has an enclosing `<section>` that flexes to match the slides panel, but its inner scrollable container `<ul className="... max-lg:max-h-[45vh] lg:max-h-[30rem]">` is artificially restricted by `lg:max-h-[30rem]`.
   - On desktop (>=1024px) and widescreen operator displays, this leaves significant empty dead space at the bottom of the Run-Sheet panel while the text is needlessly scrolled or truncated.

2. **Emergency Local Edit Limited to Single Textarea vs. Multi-Element Visual Reality (`PresenterOperator.tsx`)**:
   - The emergency edit facility introduced in SPEC-84 opens a minimal single `<textarea>` that only edits the primary text line of a slide.
   - Live worship slides routinely consist of multi-element compositions (hymn lyrics, verse labels, sermon references, background imagery, sermon subtitle boxes, and announcement images).
   - Furthermore, slides in presentation mode are hydrated with concrete service data (resolved hymn lyrics, sermon titles, preacher names, date strings), not raw unseeded sequence deck templates. An emergency stage correction requires visually adjusting the final rendered canvas (fixing typos, adjusting positions, swapping images, or tweaking multiple text blocks) rather than blind editing of a single string.

3. **Run-Sheet Action Bar Layout Wrapping & "Download PPTX" Displacement (`RunSheetPage.tsx`)**:
   - The addition of `OfflineReadinessBadge` in the top header of `/services/{id}` caused the single unconstrained `flex flex-wrap items-center gap-3` bar to overflow horizontally on standard laptop/desktop widths (1024px-1440px).
   - Consequently, the essential "Download PPTX" button is pushed down into an isolated, awkward second line, degrading header hierarchy and operator visual flow.

4. **Fatal Song-Set "Save to Book" Overwriting Hymnal with Empty Strings (`DynamicFormBody.tsx`)**:
   - In the song-set row renderer, the "Save to Book" button is unconditionally rendered whenever `hasValidNum` is true, regardless of whether the lyrics editor is open or if lyrics have been edited.
   - If an operator clicks "Save to Book" without clicking "Edit Lyrics" or without modifying lyrics, `values.lyricText` (which defaults to an empty string `""`) is transmitted to the save handler, destructively overwriting the hymnal song row in SQLite with an empty string.

5. **Congregation Scripture Screen Responsive Deformation vs. 16:9 Canvas Parity (`ScriptureOverlayView.tsx`)**:
   - When scripture is pushed to the congregation projector (`/services/:id/present/projector`), `ScriptureOverlayView` relies on responsive rem units, `max-w-5xl` pixel clamping, and media queries (`sm:px-12`) rather than fixed 16:9 container-query geometry.
   - When the projector window is maximized, resized, or displayed across different auditorium aspect ratios, the text reflows responsively and does not maintain fixed 16:9 stage scaling, breaking visual parity with all other canvas slides.

6. **Missing Slide Hide/Show Visibility Control Across Run-Sheet, Presenter, and PPTX (`SlidePlanItem`)**:
   - Operators have no mechanism to hide/omit specific slides (e.g. unneeded announcement flyers, skipped song stanzas, or conditional liturgy items) without deleting them from the service.
   - Operators need a flexible slide visibility toggle:
     - On `/services/{id}`: a hover action on thumbnail cards in `Live Slide Preview` with a visible `Hidden` badge.
     - On `/services/{id}/present`: a toggle in the thumbnail filmstrip hover and/or console toolbar.
     - On congregation projector: hidden slides are cleanly skipped during live navigation.
     - On PPTX export: hidden slides are flagged as hidden (`<p:sld show="0">`) or excluded from the generated presentation.

## Architecture & Detailed Solution

### 1. Song-Set "Save to Book" Dirty State Guard & Safety Threshold
- In `DynamicFormBody.tsx`:
  - **Baseline Lifecycle**: Record `initialLyricText` when song-set slot loads. Reset baseline upon switching song books, selecting a different song number, or when save successfully completes.
  - **Dirty Check**: Compute `isLyricsDirty = isLyricOpen && values.lyricText.trim().length > 0 && values.lyricText.trim() !== (initialLyricText || '').trim()`.
  - **Conditional Visibility**: ONLY render "Save to Book" button when `isLyricOpen` is true AND `isLyricsDirty` is true. When `isLyricOpen` is false or lyrics are clean/unmodified, the button MUST NOT appear.
  - **Safety Gate**: In `onSaveToBook` handler, strictly abort and surface an operator-facing toast/error if `values.lyricText.trim().length === 0`.

### 2. Scripture Congregation Screen 16:9 Canvas Aspect Containment
- In `ScriptureOverlayView.tsx` and `src/lib/scripture-scaling.ts`:
  - **Reference Canvas**: Align with `REFERENCE_CANVAS` (960x540 reference dimensions, 16:9 aspect ratio, `containerType: 'size'`).
  - **No Responsive Clamping**: Eliminate `max-w-5xl`, `sm:px-12`, and `clamp(rem, ...)`. The scripture stage is constrained to `aspectRatio: '16 / 9'` centered inside the outer viewport with letterbox/pillarbox padding.
  - **Pure Container Scaling**:
    - Reference label: `#D4A574`, font size `3.2cqh`, margin-bottom `2cqh`.
    - Verse body text: scaling by character count using pure `cqh` units (short <60: ~8.5cqh; medium 60-120: ~6.5cqh; standard 120-200: ~4.8cqh; long >200: ~3.5cqh), line height 1.35, white italic.
    - Resizing the window maintains 100% geometric and typographic scale parity without responsive reflow.

### 3. Run-Sheet Header Action Bar Redesign & Presenter Rundown Height Fill
- In `RunSheetPage.tsx`:
  - **Semantic Grouping**: Restructure the top header into two distinct, non-wrapping zones above 1024px:
    - *Left Zone (Meta)*: Service Title, Service ID badge, `OfflineReadinessBadge`.
    - *Right Zone (Actions)*: Primary cluster (`Present` button with primary styling, `Preview` slideshow, `Remote`) alongside Utility cluster (`Sync Artifact` for admins, `Download PPTX` split button with word wrap dropdown).
    - *Responsive Breakpoint*: Below 1024px, the header cleanly stacks into two full-width rows (Meta on top, Actions on bottom) preventing the Download PPTX button from ever being orphaned alone on a third line.
- In `PresenterOperator.tsx`:
  - Remove `lg:max-h-[30rem]` from the Run-Sheet panel inner container.
  - Apply `h-full flex-1 min-h-0 flex flex-col` to allow the rundown text to fill the full vertical panel height, eliminating dead space.

### 4. Slide Hide/Show Visibility Control Across Run-Sheet, Presenter, and PPTX
- **Stable Identity Contract**:
  - Each slide carries a stable `slide.id` (e.g. `hymn-1-v1`, `scripture`, `sermon-title`, `announcement-1`).
  - Persist `hidden_slide_ids: string[]` in the service record via `services` SQLite table and `PATCH /api/services/:id`.
  - When compiling slide plans or hydrating presenter snapshots, set `slide.hidden = true` for any slide whose `id` exists in `hidden_slide_ids`. Reordering or regenerating the plan preserves hidden state for surviving slide IDs; deleted IDs cleanly lapse.
- **Run-Sheet Interface (`SlidePreviewGrid`)**:
  - Hovering a slide card displays an eye/eye-off toggle button.
  - Hidden slides display a semi-transparent dark overlay and a prominent `Hidden` badge.
- **Presenter Interface (`PresenterOperator.tsx`) & Navigation Semantics**:
  - Filmstrip thumbnails show hover visibility toggle; console header provides a hide/show button for the active slide.
  - **Skip Rule**: Linear navigation (Next/Previous/Space/PageDown/Up) strictly skips hidden slides.
  - **Jump Rule**: If an operator clicks a hidden slide in the All Slides grid, the console prompts to "Unhide & Tampilkan" (or automatically unhides it before projecting), guaranteeing that a slide is never projected while marked hidden.
  - **Boundary Case**: If all remaining slides are hidden, linear navigation halts at the last visible slide without crashing.
  - **Active Slide Hide Mutation**: If the currently active slide is hidden, presenter automatically advances to the next visible slide (or previous if at end).
- **Auditorium Projector (`ProjectorClient.tsx`)**:
  - Projector adopts the active non-hidden slide index transmitted via `openPresentChannel`.
- **PPTX Generation (`pptx-draw.ts` / `workers/pptx/draw.mjs`)**:
  - Inspect `slide.hidden`: set `slide.hidden = true` on the PptxGenJS slide instance to emit native PowerPoint hidden attribute `<p:sld show="0">`. If native attribute is unsupported, exclude the slide from the generated deck.
  - Verification: Test must inspect the generated PPTX package and assert `<p:sld show="0">` or exact visible slide count.

### 5. Full Canvas Editor for Emergency Local Edit with Hydrated Slide Seed
- In `PresenterOperator.tsx`:
  - **Component Boundary**: Implement `EmergencyCanvasDesignerModal` reusing the established Fabric.js canvas engine from `src/components/admin/ArtifactEditor.tsx` / `canvas-utils.ts` in modal presentation mode.
  - **Hydrated Slide Seeding**: Seed the canvas with `activeSlides[index].artifact` (`ArtifactInstance`), which carries the exact resolved layout, resolved effective background image, and all hydrated element boxes (lyrics, titles, sermon texts, images) from `/services/{id}`.
  - **Editable Matrix**: Allow editing text content, font family, font size, color, alignment, and position across all element boxes.
  - **Concurrency & Life Cycle**:
    - If operator clicks Cancel: dismiss with zero changes.
    - If slide navigation occurs while modal is open: modal is tied to the specific slide index it opened on.
  - **Emergency Apply & Real-Time Broadcast**:
    - Update `activeSlides[index].artifact` in presenter memory.
    - Persist updated slide plan to `service_snapshots` in IndexedDB.
    - Append patch to `emergency_outbox` (`{ serviceId, basePlanIdentity, patchRevision: Date.now(), slideIndex: index, artifact: updatedArtifact }`).
    - Emit `slide-patch` message with monotonic `patchRevision`, `artifact: updatedArtifact`, and `planIdentity` across `BroadcastChannel`.
    - `ProjectorClient.tsx`: validates `planIdentity === basePlanIdentity` and `patchRevision > lastRev`, updates memory slide at `index`, and re-renders live onstage immediately.

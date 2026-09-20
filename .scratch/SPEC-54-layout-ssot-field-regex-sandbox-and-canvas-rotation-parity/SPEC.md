# SPEC-54 — Layout SSOT & Rundown Regex Sandbox Integration, Photo Deletion Persistence, and Canvas Element Rotation Parity

> **Status:** ready-for-agent  
> **Release:** layout-ssot-field-regex-sandbox-and-canvas-rotation-parity  
> **Component:** hub  
> **Touches:** operator, spa, artifacts, services, uploads, tests  
> **Depends on:** SPEC-53  

## Problem Statement

During operator and maintainer testing of the Service Page editing, Form Layout management, Rundown parsing, and Artifact Canvas Editor on the development server (`https://presenter-dev.bic.my.id`), five concrete operational gaps, architectural redundancies, and visual defects were identified:

1. **Dual Form Layout Customization & Seeder Collision Confusion:**
   - On the Service Editing page (`/services/:id`), an inline toolbar labeled `Kelola Layout Visual` provided in-place card creation and slot reordering directly within `DynamicFormBody.tsx`. However, the authoritative layout management already resides at `Artifacts -> Layout & Fields -> Card Groupings & Layout` (`FormLayoutAdminPanel.tsx`).
   - Maintaining two separate mutation surfaces creates confusion over which layout governs weekly services.
   - Furthermore, `EditForm.tsx` permanently froze card groupings to `initialLayoutSnapshot`, preventing updates made in the admin layout panel from taking effect on existing services.
   - In `internal/db/form_layout.go`, default seeder data still contained obsolete, hardcoded song set entries (`ds_opening_song`, `praise_song_1/2`, `ds_closing_song`), which operators previously deleted or reorganized.

2. **Photo Deletion Resurrection on Page Refresh:**
   - In Service Page: Editing, deleting weekly photos (such as `Family of the Week` or `Youth of the Week` photos) visually cleared the image preview in the form. However, upon saving and refreshing the page, the deleted photos reappeared.
   - Root cause: In `EditForm.tsx`, the hydration state checked falsiness (`!base.family_photo`) rather than explicit presence (`base.family_photo !== undefined`). Consequently, an intentional empty string `""` was treated as unset and overwritten with `initialFamilyPhotoUrl`. In addition, backend fallback logic in `internal/httpapi/services.go` revived empty field values from legacy payloads because `storedFieldValues` did not implement per-key merge precedence.

3. **Redundant Standalone Rundown Parsing Tab & Missing Integrated Test Area:**
   - In the Artifacts Admin view (`RegistryAdmin.tsx`), a separate `Rundown Parsing` tab existed alongside `Layout & Fields`.
   - Operators questioned why two distinct configuration screens exist when predefined fields in `Card Groupings & Layout` are the exact fields required for weekly Service Editing.
   - Admins need to view and edit extraction regexes directly where fields are laid out, and require a live Rundown Test Area (textarea) right within `Card Groupings & Layout` to paste real bulletin text and verify extraction across all predefined fields and song set entries in one place using production-parity parser rules.
   - Advanced parser-profile configuration (e.g. SDAH numbering, book aliases, section delimiters) must be cleanly nested within `Layout & Fields` (under an "Advanced Parser Profiles" accordion or sub-tab) rather than destroyed, preserving full profile administration while unifying daily layout and parsing workflows.

4. **Jarring Page Refresh on Layout Modifications:**
   - In `FormLayoutAdminPanel.tsx`, every card reorder (move up/down), slot move, slot transfer, and card deletion triggered a full-panel `setLoading(true)` reload (`fetchLayout()`).
   - This caused unmounting and remounting of card components, visual flickering, and loss of scroll position.

5. **Canvas Element Rotation Coordinate Detachment & Missing Real-Time Render:**
   - In the Canvas Editor (`ArtifactEditor.tsx`), inspecting rotated text elements (specifically `Prayer Request` on the `Family & Youth of the Week` announcement slide, rotated 90 degrees) revealed a major geometric disconnection:
     - The Visual Layer (`ArtifactSlide.tsx`) rendered CSS rotation with `transformOrigin: 'center center'`.
     - The Fabric.js overlay positioned and rotated objects around `originX: 'left', originY: 'top'` (top-left pivot).
     - At 90° rotation, Fabric's rotation handle and selection bounding box pivoted away from the center, ending up far in the upper-left off-canvas coordinate space, completely detached from the visually rendered text.
     - Furthermore, during manual rotation dragging on canvas, `ArtifactSlide` did not update in real time (`object:rotating` was not hooked into `liveInstance`).

---

## Solution & Architectural Contracts

### 1. Form Layout Single Source of Truth & Compatibility Contract
- **Eliminate Duplicate Customization Surface:**
  - Remove `isCustomizing`, `Kelola Layout Visual`, inline seeder triggers, and in-place slot/card manipulation from `src/operator/DynamicFormBody.tsx`.
  - Establish `Artifacts -> Layout & Fields -> Card Groupings & Layout` as the sole SSOT.
- **Dynamic Layout Hydration with Historical Data Preservation:**
  - `EditForm.tsx` loads the active layout from `/api/worship-form-layout` dynamically to determine card groupings and slot order.
  - Compatibility Contract: If an existing service contains saved field values in `service_field_values` for fields or slots that have been removed or unassigned from the active layout, those values MUST NOT be deleted or dropped. They are rendered in a designated "Preserved Historical Fields" card group at the bottom of the form, ensuring zero data loss on layout schema migration.
  - Active edits guard: Background layout re-fetches MUST NOT overwrite an operator's unsaved form field inputs.
- **Seeder Cleanup:**
  - Clean `defaultGroupings` in `internal/db/form_layout.go` to remove fixed obsolete song set entries. The seeder checks existing groupings and never re-inserts deleted cards or forces obsolete slots into customized layouts.

### 2. Photo & Image Deletion Persistence (Per-Key Merge Precedence)
- **Client Explicit Value Representation:**
  - In `src/operator/EditForm.tsx`, image field state uses `undefined` for uninitialized, a valid URL string for populated, and empty string `""` for explicitly cleared/deleted.
  - Hydration uses explicit `=== undefined` checks:
    ```tsx
    if (initialFamilyPhotoUrl && base.family_photo === undefined) base.family_photo = initialFamilyPhotoUrl;
    if (initialYouthPhotoUrl && base.youth_photo === undefined) base.youth_photo = initialYouthPhotoUrl;
    if (initialSermonGraphicUrl && base.sermon_poster === undefined) base.sermon_poster = initialSermonGraphicUrl;
    ```
    Empty string `""` is strictly preserved and never overwritten by initial props.
- **Backend Per-Key Merge Precedence in `services.go`:**
  - `fieldValuesFromBody`: Explicit `""` values in `field_values` are preserved and written to `service_field_values` with `value_text = ''`.
  - `storedFieldValues`: Evaluates presence per variable key. If a key exists in `service_field_values` (even if `value_text == ""`), that row is authoritative for that key and MUST NOT fall back to `images_payload` or `parsed_data`. Missing keys that do NOT exist in `service_field_values` continue to fall back gracefully to legacy payloads, preserving mixed-state backwards compatibility.
  - `mergeImagesPayload`: When `familyPhotoUrl`, `youthPhotoUrl`, or `sermonGraphicUrl` is cleared, the backend explicitly sets `current[field] = nil` in `images_payload`.

### 3. Integrated Rundown Regex Sandbox & Parser Profile Coexistence
- **Layout-Integrated Parsing & Regex Configuration:**
  - In `FormLayoutAdminPanel.tsx`, each predefined field and slot displays its associated `extraction_regex` with inline editing capabilities.
  - Live Rundown Test Area: Embedded directly inside `Card Groupings & Layout`. Accepts raw rundown text and evaluates parsing against the active layout's configured fields and song set matching rules.
  - Production-Parity Parser Contract: The live test area executes the exact same parsing rules and engine as production (`parseRundownWithProfile` from `src/lib/parser-rules.ts` and `matchSongSets` from `src/lib/song-set-matching.ts`).
  - Result Schema: The test area renders a deterministic summary:
    - Extracted Predefined Fields (field label, variable name, extracted value, status: matched / empty regex / unmatched).
    - Extracted Song Sets (slot variable, song title, song number, song book, match kind: label / positional, status: matched / unfilled).
    - Unmapped / Overflow lines (lines containing hymns or text not matched to any active slot).
- **Navigation & Parser Profiles Disposition:**
  - Rather than deleting parser-profile administration, `RegistryAdmin.tsx` nests `ParserProfilesPanel` under an `Advanced Parser Profiles` sub-view within `Layout & Fields`.
  - The redundant top-level `Rundown Parsing` tab is retired from the primary tab bar, creating a clean unified information architecture while retaining full access to underlying parser profiles.

### 4. Smooth Optimistic AJAX Interactions
- In `FormLayoutAdminPanel.tsx`:
  - Card reordering (`handleMoveGrouping`), slot reordering (`handleMoveSlot`), and slot transfer (`handleTransferSlot`) apply optimistic in-place array state updates immediately.
  - API mutations execute asynchronously. On HTTP success, state reconciles quietly without toggling `setLoading(true)` or unmounting components.
  - Rollback & Concurrency Strategy: If a mutation fails (non-2xx response or network error), the panel displays an explicit error toast/banner, rolls back the optimistic state to the last confirmed snapshot, and re-fetches layout data. Action buttons are debounced during in-flight operations to prevent race conditions.

### 5. Canvas Rotation Bidirectional Geometry & Real-Time Sync
- **Bidirectional Center-Origin Geometry Alignment:**
  - In `src/lib/registry/canvas-utils.ts`, Fabric objects are configured with `originX: 'center'` and `originY: 'center'`.
  - Complete Bidirectional Geometry Conversion Contract:
    - **Top-Left to Center (Construction & Ingestion):**
      `centerX = pctToPx(element.x + element.w / 2, CANVAS_WIDTH)`
      `centerY = pctToPx(element.y + element.h / 2, CANVAS_HEIGHT)`
      `angle = element.rotation ?? 0`
    - **Center to Top-Left (Serialization & Persistence):**
      `element.x = pxToPct(target.left - target.getScaledWidth() / 2, CANVAS_WIDTH)`
      `element.y = pxToPct(target.top - target.getScaledHeight() / 2, CANVAS_HEIGHT)`
      `element.w = pxToPct(target.getScaledWidth(), CANVAS_WIDTH)`
      `element.h = pxToPct(target.getScaledHeight(), CANVAS_HEIGHT)`
      `element.rotation = Math.round((((target.angle % 360) + 360) % 360))`
    - All transform event handlers (`object:moving`, `object:scaling`, `object:resizing`, `object:rotating`, `syncTextClipOnMove`, `syncTextClipOnScale`) strictly adhere to center-origin math.
  - This guarantees that at all rotation angles (0°, 90°, 180°, 270°), Fabric's bounding box and rotation control handle stay precisely centered on the visual DOM element.
- **Real-Time Drag Synchronization:**
  - `ArtifactEditor.tsx` registers Fabric's `object:rotating` event listener in addition to `object:modified`.
  - During rotation dragging, `liveInstance` is updated on every tick, allowing `ArtifactSlide.tsx` to render the CSS rotation transform in real time with zero lag.
- **Shared-Path Coverage Rationale:**
  - Text, shape, and image elements share the identical `canvas-utils.ts` and `ArtifactEditor.tsx` transform pipeline. Center-origin geometry is enforced across all element types to prevent regression across shapes and images.

---

## User Stories

1. As an operator editing a weekly service, I want the form card grouping and slot layout to be cleanly managed in `Artifacts -> Layout & Fields`, so that the service edit page is clean, focused purely on data entry, and reflects active layout changes dynamically.
2. As an operator editing an older service, I want any previously entered data for fields removed from the active layout to remain accessible in a preserved section, so that my past records are never silently deleted.
3. As an operator, I want deleting a family, youth, or sermon graphic photo in the service form to permanently persist across page refreshes, so that cleared photos do not resurrect unexpectedly.
4. As an administrator, I want to configure field extraction regexes directly inside `Card Groupings & Layout`, so that I can manage the layout and its parsing rules in one unified workspace.
5. As an administrator, I want a live Rundown Test Area inside `Card Groupings & Layout` executing production-parity parser rules, so that I can paste bulletin text and immediately verify which predefined fields and song sets match with clear error and overflow reporting.
6. As an administrator, I want moving cards up and down, transferring slots, and deleting groupings to happen smoothly via optimistic AJAX without full-page loading flashes, with automatic rollback on network failure.
7. As an administrator editing slide artifacts, I want rotated elements (such as 90° rotated text) to have selection handles and rotation controls centered directly over the visual text, so that I can easily resize and rotate elements without controls flying off into unreachable coordinates.
8. As an administrator rotating an element on canvas, I want the visual rendering to update in real time as I drag the rotation handle, so that I can see the exact orientation before releasing the mouse.

---

## Testing Decisions & Absence-Guard Defect Injection Proof

1. **Absence Guards with Mandatory Defect Injection Proof:**
   - Absence Guard: Verify `src/operator/DynamicFormBody.tsx` does NOT contain `Kelola Layout Visual`, `Seed Default Predefined Fields`, `Tambah Kartu Form Baru`, or inline card deletion/move controls.
   - **Defect Injection Protocol:**
     1. Inject forbidden button `<Button>Kelola Layout Visual</Button>` into `DynamicFormBody.tsx`.
     2. Run `tests/smoke-spec-54.test.mjs` and confirm the test suite fails (goes RED).
     3. Revert the injected defect and confirm the test suite passes (goes GREEN).
     4. Document proof in test comments.

2. **Per-Key Mixed Legacy/Current State API Test:**
   - In `internal/httpapi/services_test.go` and Node HTTP tests:
     - Setup service with legacy `images_payload` (`familyPhotoUrl: "https://example.com/family.jpg"`) and legacy `parsed_data`.
     - Execute `PUT /api/services/:id` with `field_values: { family_photo: "" }`.
     - Query `GET /api/services/:id`: verify `field_values["family_photo"]` is `""`, `images_payload.familyPhotoUrl` is `null`, while unrelated legacy fields (e.g. `sermon_speaker_name`) are correctly returned and not lost.

3. **Geometry Invariant Tests Across Cardinal Angles:**
   - In `tests/artifact-editor-rotation.test.mjs`:
     - Test coordinate round-tripping (`top-left -> center -> top-left`) at 0°, 90°, 180°, and 270°.
     - Assert that the calculated center coordinate matches `pctToPx(x + w/2)` within 0.01px tolerance.
     - Assert that Fabric object bounding boxes surround the exact visual center of the element.
     - Assert that `object:rotating` event listener is registered on the canvas.

4. **Parser Sandbox Production-Parity Tests:**
   - Test that the Rundown Test Area correctly identifies matched fields, unmatched slots, and song set suggestions against identical fixtures used by the Go and TypeScript parsing engines.

---

## Out of Scope

- Redesigning PowerPoint presentation generation or altering `.potx` layout dimensions.
- Changing hymn lyrics database schemas or hymn numbering catalogs.

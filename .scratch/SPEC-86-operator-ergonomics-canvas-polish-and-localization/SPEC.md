# SPEC-86 — Operator Ergonomics, Canvas Polish, and Localization Parity

## Requirement Traceability & Scope
- **PRD**: `operator-turn`, `offline-deck`
- **Architectural Decisions**:
  - `AD-13` (Canvas State Boundary — Uncontrolled wrapper pattern)
  - `AD-16` (Service-Bound Registry Snapshot)
  - `AD-24` (Operator Theme & Chrome vs. Black Room-Facing Projector Shell)
  - `AD-29` (Projector Liveness Protocol & BroadcastChannel Isolation)
- **Use Cases**:
  - `UC-5` (Operator edits Service fields in Hub — satisfies `FR-14`, `FR-16`)
  - `UC-12` (Operator runs the two-screen presenter — satisfies `FR-14`, `FR-16`, `FR-19`)
  - `UC-28` (Operator corrects a song's lyrics for this Service, and optionally saves the fix back to the Song Book — satisfies `FR-34`)
- **Functional Requirements**:
  - `FR-14` (Offline Presentation Guarantee — PPTX fail-safe Plan A, in-browser presentation Plan B)
  - `FR-16` (Presenter View and Operator Control Surface)
  - `FR-19` (Auditorium Projector Output and Live Synchronization)
  - `FR-25` (The Operator interface in the Operator's language — English and Indonesian bilingual parity)
  - `FR-34` (Song Book write & lyric corrections)
- **Components**: `hub`, `presenter`
- **Touches**: `services`, `song-sets`, `preview-list`, `present-console`, `emergency-canvas`, `i18n`

---

## Problem Statement

Hand-testing and ergonomic evaluation of the deployed dev environment (`https://presenter-dev.bic.my.id`) following SPEC-85 (DEC-072) surfaced seven distinct usability frictions, layout shifts, inspector defects, and localization gaps across the operator console, service management, and emergency canvas modal:

1. **Run-Sheet Header Layout Wrapping & Title Crowding (`RunSheetPage.tsx`)**:
   - In `/services/{id}`, the top header puts title, ID, offline badge, and five action buttons into a loose flex layout.
   - On standard laptop/desktop widths (1024px–1440px), the title text experiences awkward line breaks while the action buttons crowd into each other or wrap unpredictably.
   - The maintainer requires a clean 50:50 two-column structure: Left column (50%) strictly for Service Title and ID with line-break prevention; Right column (50%) for the offline readiness badge on Row 1 and neatly tiered action buttons on Row 2 and Row 3.

2. **Song-Set Lyric Editor Button Layout Shift Upon Typing (`DynamicFormBody.tsx`)**:
   - In `SongSetSlotRenderer`, the *Edit Lyrics / Close Lyrics* toggle button sits in the same horizontal flex row as the Song Number input, Song Book select, and Background select.
   - When lyrics are edited, `isLyricsDirty` becomes true and dynamically injects the *Save to Book* button beside it.
   - This addition exceeds available horizontal width, causing both buttons to suddenly jump downward into a new line mid-typing.
   - The maintainer requires moving lyric editor action buttons (*Edit/Close Lyrics* and *Save to Book*) to a dedicated row, keeping the input selectors stable and predictable (`UC-28` / `FR-34`).

3. **Slide Thumbnail List Visual Clutter from Always-Visible Eye Toggles (`SlidePreviewList.tsx`)**:
   - The slide visibility toggle (Eye/EyeOff icon) introduced in SPEC-85-04 is currently rendered with full opacity on every single slide card in the rundown list.
   - On long services (50–70 slides), 50+ eye icons create intense visual noise.
   - The maintainer requires this button to be hidden by default (`opacity-0`) and to only reveal upon mouse hover over that specific slide element (`group-hover:opacity-100`).

4. **Presenter Console Active Slide Hide Action Trapped in Filmstrip (`PresenterOperator.tsx`)**:
   - Currently, slide visibility toggles in the presenter view reside on tiny 24×24px hover buttons on the bottom horizontal filmstrip thumbnails, while a redundant active toggle sits in the crowded top-right header (`toggle-current-slide-visibility`).
   - During live service playback, operators focus primarily on the Current Slide preview and the transport bar underneath it (`Prev`, `Next`, `Auto Loop`, `Blank Screen`).
   - The maintainer requires placing the active slide's Hide/Unhide toggle prominently within the Current Slide transport bar, and removing the tiny hover button from filmstrip thumbnails and from the top-right header.

5. **Presenter Console Top-Right Header Chaos (`PresenterOperator.tsx`)**:
   - Currently, eight heterogeneous buttons are grouped together in a single flex-wrap bar in the top-right console header (`All Slides`, `Open Congregation Screen`, `Remote Code`, `Presentation Lock`, `Emergency Edit`, `Slide Visibility`, `Offline Badge`, `Run-Sheet`).
   - The maintainer requires organizing these into two distinct semantic rows:
     - *Row 1 (Display & Audience):* `All Slides` | `Open congregation screen` | `Remote code`
     - *Row 2 (Safety, Workflow & Emergency):* `Offline ready` | `Buka Kunci` / `Kunci Ibadah` | `Edit Darurat` | `Run-Sheet`

6. **Emergency Canvas Inspector Shape Defect & Missing Image Cropping (`PresenterOperator.tsx` / `emergency-canvas.ts`)**:
   - When an operator clicks a Shape or Line element in `EmergencyCanvasDesignerModal`, the element inspector erroneously displays Image URL and image upload inputs. Shapes and lines must strictly display shape/line properties (fill color, stroke, opacity, geometry, rotation) and omit image controls.
   - When an Image or image-placeholder element is selected, the inspector lacks an image upload action and has no image cropping capability, whereas Deck Spine provides full image cropping (`ImageCropDialog`).
   - Furthermore, the runtime model (`ResolvedElement`) persists `imageUrl` (not authoring-time `imageRef`). The cropping flow must crop the file, upload it via `POST /api/upload`, update `imageUrl` in draft state, and support offline object URLs when disconnected.

7. **Bilingual Localization Incompleteness (`catalogue-en.ts` / `catalogue-id.ts` / `keys.ts`)**:
   - Various user-facing strings across Run-Sheet, Presenter, Song-Set editor, Slide List, `ImageCropDialog`, and Emergency Canvas Modal have incomplete or inconsistent localization.
   - Maintainer requires 100% complete English coverage when interface language is English, and natural Indonesian coverage when interface language is Indonesian (retaining natural industry technical terms such as *Offline*, *ID*, *PPTX*, *Full HD*, *Z-Index*).

---

## Architecture & Detailed Solution

### 1. Run-Sheet 50:50 Header Layout & Tiered Action Clusters (`RunSheetPage.tsx`)
- Structure the `<header>` element into a 2-column grid (`grid grid-cols-1 lg:grid-cols-2 gap-4 border-b pb-4 items-start`):
  - **Left Column (50%)**:
    - Service Title (`<h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate whitespace-nowrap" title={title}>`) preventing unwanted line-breaks while preserving full accessible title via native `title` attribute.
    - Service ID and date text below the title.
  - **Right Column (50%)**:
    - *Row 1*: `OfflineReadinessBadge` aligned right (giving clear status visibility).
    - *Row 2*: Primary action cluster (`Present` [default prominent], `Preview` slideshow, `Remote`).
    - *Row 3*: Utility action cluster (`Sync Artifact` for admins, `Download PPTX` split button with word wrap dropdown).
  - On viewports below 1024px, collapses gracefully into a clean vertical stack.

### 2. Song-Set Lyric Action Dedicated Row Placement (`DynamicFormBody.tsx`)
- In `SongSetSlotRenderer`:
  - Keep the top row strictly for inputs: Song Number, Book Code selector, Background selector.
  - Move the lyric toggle (*Edit Lyrics / Close Lyrics*) and dirty save button (*Save to Book*) into their own dedicated action row immediately below the selectors (`<div className="flex items-center gap-2 pt-1.5" data-testid="song-set-action-row">`).
  - Editing lyrics in the textarea will no longer displace the selector inputs or cause unexpected layout jumps (`UC-28` / `FR-34`).

### 3. Slide Thumbnail List Hover-Only Visibility (`SlidePreviewList.tsx`)
- In `SlideRow`:
  - Add `group relative` to the container `div[data-testid="slide-preview-row"]`.
  - Update visibility toggle button styling:
    `className="shrink-0 h-7 w-7 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-opacity opacity-0 group-hover:opacity-100 focus-visible:opacity-100"`
  - If a slide is hidden, the `Hidden` badge (`data-testid="slide-hidden-badge"`) remains visible for immediate recognition, while the toggle button itself only reveals upon hover or keyboard focus.

### 4. Presenter Console Transport Bar Integration & Two-Row Header (`PresenterOperator.tsx`)
- **Transport Bar Placement**:
  - In the transport controls bar below the Current Slide preview (beside `Blank screen` and `Next →`), add the toggle button for the active slide:
    `<Button data-testid="transport-slide-visibility-toggle" variant={current?.hidden ? 'destructive' : 'outline'} onClick={() => toggleSlideVisibility(index)} ...>`
  - Remove `filmstrip-visibility-toggle` from `FilmstripFrame` thumbnails to keep the filmstrip clean.
  - Remove redundant `toggle-current-slide-visibility` from the top-right header.
- **Top-Right Console Header**:
  - Restructure into two clear horizontal rows aligned to the right:
    - *Row 1 (Audience & Screen Control)*: `All Slides` | `Open congregation screen` | `Remote code`
    - *Row 2 (Session Safety & Navigation)*: `OfflineReadinessBadge` | `Buka Kunci` / `Kunci Ibadah` | `Edit Darurat (Lokal)` | `Run-Sheet`

### 5. Emergency Canvas Inspector Shape Guard & Image Cropping Parity (`PresenterOperator.tsx`)
- **Type-Specific Element Branching**:
  - In `EmergencyCanvasDesignerModal`, branch inspector controls strictly by `selectedElement.type`:
    - `type === 'shape'`: Render shape fill color, opacity slider, geometry (`x`, `y`, `w`, `h`), and rotation. Suppress image URL, upload, and object-fit inputs.
    - `type === 'line'`: Render line stroke color, opacity, geometry (`x`, `y`, `w`, `h`), and rotation. Suppress image URL and upload inputs.
    - `type === 'image'` or `type === 'image-placeholder'`: Render image URL input, "Upload & Crop" button, object-fit selector (`contain` vs `cover`), geometry (`x`, `y`, `w`, `h`), and rotation. Suppress text formatting inputs.
    - `type === 'text'`: Render text editor textarea, font family, font size, text color, alignment, geometry, and rotation.
- **Durable Image Cropping Flow**:
  - Integrate `src/components/media/ImageCropDialog.tsx`:
    - When file is selected: open `ImageCropDialog`.
    - Upon crop confirmation: upload cropped `File` via `POST /api/upload` (multipart form). On success, update `selectedElement.imageUrl` with the returned URL. In offline mode (network error / 5xx), generate `URL.createObjectURL(file)` as a resilient local fallback.
    - Handle loading, busy, and cancel states gracefully without state corruption.

### 6. Strict Bilingual i18n Localization Parity (`catalogue-en.ts` / `catalogue-id.ts` / `keys.ts`)
- **Key Declaration Discipline**:
  - Declare all new i18n keys in `src/lib/i18n/keys.ts` first, ensuring complete TypeScript type-safety (`npm run typecheck`).
  - Provide corresponding English translations in `src/lib/i18n/catalogue-en.ts` and Indonesian translations in `src/lib/i18n/catalogue-id.ts`.
- **String Inventory in Scope**:
  - Run-Sheet header labels, badges, tooltips, and action button labels.
  - Song-Set lyric editor buttons: `Edit Lyrics`, `Close Lyrics`, `Save to Book`, `Saving...`.
  - Slide visibility toggle tooltips and badges: `Hide slide`, `Unhide slide`, `Hidden`.
  - Presenter console controls: `All slides`, `Open congregation screen`, `Remote code`, `Kunci Ibadah / Buka Kunci`, `Edit Darurat (Lokal)`, `Run-Sheet`, `Blank screen`, `Resume screen`, `Clear scripture`, `Auto Loop`, `Stop Loop`.
  - Emergency Canvas Designer modal: Titles, descriptions, element inspector labels, shape properties, image upload/crop triggers, apply and cancel buttons.
  - `ImageCropDialog`: Audit and replace hardcoded Indonesian text with `t(...)` keys.
- **Language Fidelity**:
  - In English mode: 100% clean, idiomatic English.
  - In Indonesian mode: 100% natural Indonesian, preserving accepted technical terms (*Offline*, *ID*, *PPTX*, *Full HD*, *Z-Index*).

---

## Ticket Breakdown

- **SPEC-86-01**: Run-Sheet Header 50:50 Layout & Tiered Action Clusters (`spa/src/pages/RunSheetPage.tsx`)
- **SPEC-86-02**: Song-Set Lyric Action Dedicated Row Placement (`src/operator/DynamicFormBody.tsx`)
- **SPEC-86-03**: Slide Thumbnail List Hover-Only Visibility State (`src/components/SlidePreviewList.tsx`)
- **SPEC-86-04**: Presenter Transport Slide Hide Toggle & Two-Row Header Layout (`src/operator/present/PresenterOperator.tsx`)
- **SPEC-86-05**: Emergency Canvas Inspector Shape Guard, Image Upload & Cropping Parity (`src/operator/present/PresenterOperator.tsx`, `src/lib/emergency-canvas.ts`, `src/components/media/ImageCropDialog.tsx`)
- **SPEC-86-06**: Strict Bilingual i18n Localization Parity Across Service & Presenter Surfaces (`src/lib/i18n/`, `RunSheetPage.tsx`, `PresenterOperator.tsx`, `DynamicFormBody.tsx`, `ImageCropDialog.tsx`)

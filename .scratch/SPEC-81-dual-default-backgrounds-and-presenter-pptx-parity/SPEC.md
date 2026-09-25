# SPEC-81 — Dual Default Backgrounds, Song-Set Resolution, and Presenter/PPTX Parity

## Requirement Traceability & Scope
- **PRD**: `operator-turn`, `offline-deck`
- **Use Cases**:
  - `UC-25` (Background & Media Library Management)
  - `UC-27` (Presenter Live Background Override)
  - `UC-12` (Live Congregation Presentation)
  - `UC-14` (Template Layout & Canvas Customization)
  - `UC-18` (Offline Presentation Deck Download — `usecases.yaml`)
- **Functional Requirements**:
  - `FR-16` (Presentation Controller)
  - `FR-31` / `FR-32` (Song Sets & Background Management)
  - `FR-14` (PPTX Export Generation)

## Problem Statement

During hand-testing and operational review of the presentation workflow, critical defects and architectural disconnects were identified across background selection, presenter previews, and slide export:

1. **Presenter Live Background Override Disconnect in Operator Previews**:
   - In `src/operator/present/PresenterOperator.tsx`, when an operator selects a live background from the "Live background" dropdown, a message is broadcast over `BroadcastChannel` (`type: 'background'`).
   - The congregation projector (`ProjectorClient.tsx`) receives this message and passes `backgroundOverride={backgroundOverride}` to `SlideView`, displaying the background immediately on the congregation screen for lyric slides (`isVerseOrReff`).
   - However, within `PresenterOperator.tsx` itself:
     - Line 953: `<SlideView slide={current} />`
     - Line 1234: `<SlideView slide={next} />`
     - Line 1161: `<FilmstripFrame slide={slides[entry.index]} ... />`
     render the current slide, next slide, and filmstrip thumbnails **without passing `backgroundOverride={liveBackground}`**.
   - As a result, the operator's current slide preview and filmstrip do not reflect the live background, leaving the operator blind to what the congregation is seeing.

2. **Song-Set Background Dropped Before Plan Hydration (Missing in Presenter & PPTX)**:
   - When editing a service plan (`/schedule`), operators can select a background for a song set (stored in `song_set_inputs.background_id`) or select "Default Background" (`background: ''`).
   - In `internal/plan/snapshot.go` (`loadSongSetInputsIntoSnapshot`), the query only reads `song_number`, `song_book_code`, and `lyric_override`, **completely dropping `background_id`**.
   - In `internal/plan/types.go`, struct `HymnItem` has no background field.
   - In `internal/plan/plan.go`, `songGroup` and `hydrateOne` hydrate song slides (Title, Verse, Reff) using only static template layouts, with zero injection of the song set's selected background or library default background.
   - Because `plan.PlanForService` is the single source of truth for both `/present` slides (`GET /api/services/{id}`) and PPTX export (`GET /api/services/{id}/pptx`), neither the presenter operator nor downloaded PowerPoint files contain the background.

3. **Single Global Default Ambiguity & Fallback Semantics**:
   - Currently, `background_library_images` only supports a single `is_default` boolean.
   - Churches desire a distinct visual atmosphere for congregational singing (lyrics on a calm, high-contrast, dark plate) versus general church liturgy (welcome, announcements, scripture, sermon).
   - A single default forces an awkward compromise: either lyrics inherit an inappropriate graphic or general slides remain blank black screens unless manually decorated.

4. **Image Placeholder Contain/Fit Mode Transparency**:
   - When canvas elements or placeholders are resized and set to `fit` (`objectFit: 'contain'`), non-filled letterbox/pillarbox areas must be transparent so that underlying slide backgrounds show through cleanly, rather than rendering opaque or tinted stand-in boxes.

## Solution

1. **Presenter Live Preview Parity (Lyric-Gated via `isVerseOrReff`)**:
   - In `src/operator/present/PresenterOperator.tsx`, forward `backgroundOverride={liveBackground}` to:
     - `<SlideView slide={current} backgroundOverride={liveBackground} />`
     - `<SlideView slide={next} backgroundOverride={liveBackground} />`
     - `<FilmstripFrame ... backgroundOverride={liveBackground} />`
   - `SlideView` delegates to `ArtifactSlide.tsx`, which already strictly restricts `backgroundOverride` to lyric slides via:
     ```tsx
     const isVerseOrReff =
       instance.layoutKey === 'verse' ||
       instance.layoutKey === 'reff' ||
       instance.layoutKey === 'lyric' ||
       instance.group?.role === 'lyric';
     ```
   - This ensures live background overrides immediately update on the operator console's Current, Next, and Filmstrip views, while strictly preserving authored non-lyric slides without bleeding into other components.

2. **Dual Default Background Architecture (`Song-Set Default` & `General Default`)**:
   - Establish two explicit, independent default roles:
     - **`song_set` (Song-Set Default Background)**: Automatically applies to slides in a song set (Title, Verse, Reff) when no specific song background is selected.
     - **`general` (General Default Background)**: Serves as a universal aesthetic fallback for non-song slides (Welcome, Scripture Reading, Sermon, Thank You, and announcement templates without custom flyers).
   - In database schema, create a normalized assignment model with `ON DELETE CASCADE` to honor UC-25 (deleting an asset from library must never be blocked; resolution gracefully falls through):
     ```sql
     CREATE TABLE IF NOT EXISTS background_default_assignments (
       role TEXT PRIMARY KEY CHECK (role IN ('song_set', 'general')),
       background_image_id INTEGER NOT NULL,
       updated_at TEXT NOT NULL,
       FOREIGN KEY (background_image_id) REFERENCES background_library_images(id) ON DELETE CASCADE
     );
     ```
   - Same image asset can be assigned to either role, both roles, or neither.
   - Deleting a default image in Background Library cleanly cascades and removes the role assignment, safely falling through to template/black backgrounds.
   - Migration handles 0 defaults (empty), 1 default (seeded into both roles), and dirty multi-default data (lowest ID selected deterministically).

3. **Background Library UI Enhancement (`BackgroundLibraryPanel.tsx`)**:
   - Replace the single ambiguous "Make Default" button with clear dual actions and badges:
     - `Set as Song-Set Default` (renders badge `Song-Set Default`)
     - `Set as General Default` (renders badge `General Default`)
   - Empty states and clear toasts guide the administrator.

4. **Service Editor UX & Song-Set Granularity (`DynamicFormBody.tsx`)**:
   - Maintain **one background selector per song set** (not separate verse vs reff selectors). One song represents a single visual family; title, verses, and choruses share the same visual backdrop.
   - Update selector placeholder and option labels:
     - Default option: `Use Song-Set Default` (with thumbnail and title of the active Song-Set Default).
     - Explicit options: list available library images with thumbnails and IDs.

5. **Authoritative Resolution Precedence by Slide Kind**:

| Slide Kind | Resolution Chain (Highest -> Lowest) |
|---|---|
| **Lyric Slide (Verse, Reff, Lyric)** | 1. Live Presenter Override (active session only, transient)<br/>2. Explicit Song-Set Selection (from `song_set_inputs`)<br/>3. Song-Set Default Background (from `background_default_assignments`)<br/>4. Template Authored Background (`layout.BackgroundImage`)<br/>5. General Default Background (`role: 'general'`)<br/>6. Fallback Color (`#000000`) |
| **Song Title Slide** | 1. Explicit Song-Set Selection (shares song family)<br/>2. Song-Set Default Background<br/>3. Template Authored Background<br/>4. General Default Background<br/>5. Fallback Color (`#000000`) |
| **Non-Song Slide (Welcome, Scripture, Sermon, Announcements, Thank You)** | 1. Explicit Slide Image (Flyer, Photo, Sermon Graphic)<br/>2. Template Authored Background<br/>3. General Default Background<br/>4. Fallback Color (`#000000`) |

6. **Image Placeholder Transparency on Fit/Contain Modes**:
   - In Web DOM (`ArtifactSlide.tsx`), `ImageElement` renders `<img>` with `objectFit: contain` inside a transparent `div`.
   - In Fabric Canvas (`canvas-utils.ts`), placeholder stand-in removes opaque fill, using transparent background and dashed outline.
   - In PPTX (`src/lib/pptx-draw.ts`), `slide.addImage` with `{ sizing: { type: 'contain' } }` applies zero shape fill behind the image.

7. **Observable PPTX Media Deduplication Proof**:
   - PPTX media deduplication (`collapseDuplicateMedia` in `src/lib/pptx-draw.ts`) guarantees that applying the General or Song-Set Default across 50 slides adds the physical image file **only once** to the PPTX zip archive (`ppt/media/image1.png`).
   - Automated tests will inspect the zip archive to assert that multiple slide relationship files point to one canonical image file.

## User Stories

1. As an operator running a live service on `/present`, when I change the live background from the dropdown, I want the Current slide and Filmstrip thumbnails to update immediately for lyric slides alongside the projector, so that I can monitor the presentation with full confidence.
2. As a church administrator, I want to set a dedicated "Song-Set Default Background" for lyrics and a "General Default Background" for other slides in the Background Library, so that the entire service looks polished without manual per-slide configuration.
3. As a church administrator, when I delete a background image that was previously set as default, I want the system to allow the deletion and gracefully fall back without throwing database errors.
4. As a service leader preparing hymns in the service form, I want the default option to clearly say "Use Song-Set Default" with a thumbnail preview, so that I know exactly which backdrop will be used.
5. As a media director downloading the PowerPoint deck, I want all song slides to carry the resolved background image without causing multi-megabyte file duplication in the exported PPTX.

# SPEC-39 — Central Media Gallery Bucket, Presenter Announcement Section Looping, and Weekly Announcement Placeholders

> **Status:** open
> **Release:** media-gallery-announcement-loop-dynamic-binding
> **Component:** registry, presenter, hub
> **Touches:** registry, presenter, hub
> **Depends on:** SPEC-38

## Problem Statement

Church operators, pastors, and audio-visual teams running Sabbath services encounter three friction points when managing worship announcements, visual assets, and presentation slides:

1. **Redundant Visual Asset Uploads & Fragmented Media Storage:**
   Common church flyers and static graphics (e.g. "Welcome to Church", "Keep Our Church Clean", "Please Do Not Touch Audio Equipment", "Online Mid-Week Prayer", and "Offering & Tithe") are reused across multiple presentation contexts — including Opening Announcements, Break Announcements, Closing Announcements, and the Main Worship Spine. In the current Canvas Editor, adding an image element always prompts for a local disk upload (`uploadImageFile`), creating duplicate server copies, bloating disk storage, and forcing operators to repeatedly locate files on their local laptops. There is no central visual media gallery where church flyers and branding images can be uploaded once and inserted anywhere by reference.

2. **Absence of an Automated Section-Bounded Looping Carousel in Presenter:**
   During service intermissions (pre-service opening waiting periods, sabbath school breaks, and post-service closing fellowship), announcement slides need to cycle continuously so arriving or departing congregation members can view upcoming church events. Currently, the Presenter view only supports manual key/click stepping across a single flattened slide array. Operators are forced to either manually click through announcement slides repeatedly or leave the screen frozen on a single static slide. Furthermore, unconstrained global looping would loop the entire worship service deck instead of staying bounded within the announcement block.

3. **Disconnection Between Weekly Service Data and Announcement Slides:**
   Weekly dynamic assets and announcements — specifically the Sermon Poster (`sermonGraphicUrl`), Prayer of the Week photos (`familyPhotoUrl`, `youthPhotoUrl`), and Afternoon Program schedule — are entered through the weekly worship service edit form (`CreateForm` / `EditForm`). While single-slide templates have placeholder infrastructure, announcement slide templates in Announcement Sets currently lack seamless binding to these weekly fields. Furthermore, Afternoon Program currently lacks a structured field on the weekly service record, forcing operators to manually edit announcement text every week.

## Solution

1. **Central Media & Asset Gallery Bucket with Unified Storage:**
   - Provide a persistent Media Gallery in Registry Admin (`/admin/registry`) for managing church visual media (flyers, logos, background textures, announcement banners) with thumbnail grids, metadata labels, image previews, and deletion.
   - Unify the existing `/api/admin/background-library` into a categorized media library endpoint supporting `category: 'flyer' | 'background' | 'general'`, retaining 100% backward compatibility for existing background consumers.
   - Deletion Lifecycle & Reference Safety: Deleting an asset removes its entry from the gallery index. Physical files in `data/uploads/` remain preserved on disk so historical presentations and previously authored slide layouts referencing the URL do not break. If an image file is missing, Canvas Editor, Presenter, and PPTX export render safe placeholder fallbacks instead of crashing or failing export.
   - In `ArtifactEditor.tsx`, provide an "Insert Image from Gallery" action alongside local upload, allowing operators to pick existing images directly into canvas image elements by canonical URL reference without duplicate file uploads.
   - Enhance the canvas background picker with full visual thumbnail selection from the unified gallery.

2. **Presenter Section-Bounded Looping Carousel for Announcement Decks:**
   - Introduce a section-bounded Looping mode in `PresenterOperator.tsx`:
     - Scope & Boundary: The loop is bounded to contiguous announcement slides (`templateId.startsWith('ann-slide-')` or slides sharing the active announcement section).
     - State Transitions:
       - **Start:** When toggled on, the loop sets `isLooping = true` with a configurable interval (5s, 7s, 10s, 15s; default 7s).
       - **Tick:** An active timer advances `currentSlideIndex`. Upon reaching the final slide of the announcement section (`sectionEndIndex`), the next tick wraps back to `sectionStartIndex`.
       - **Disarm / Pause:** Any manual operator intervention (pressing Arrow keys, clicking a slide in the jump grid or list, changing services, or clicking Stop Loop) immediately disarms `isLooping = false`.
       - **Single / Empty Guard:** If the section contains $\le 1$ slide, looping is disabled or treated as a no-op hold.
     - Synchronization: Loop slide transitions broadcast across `present-channel` so the live projection client (`ProjectorClient.tsx`) mirrors slide changes in lockstep.

3. **Dynamic Announcement Placeholders & Weekly Service Data Hydration:**
   - Align with canonical existing catalog keys in `placeholder-catalog.ts` and Go `internal/plan/plan.go`:
     - `{sermon_poster}` (image placeholder, mapped from `sermonGraphicUrl`).
     - `{family_photo}` (image placeholder, mapped from `familyPhotoUrl`).
     - `{youth_photo}` (image placeholder, mapped from `youthPhotoUrl`).
   - Add structured weekly field:
     - `afternoon_program` (string) added to `WorshipServiceRecord`, database schema `worship_services`, and weekly edit forms.
     - `{afternoon_program}` (text placeholder) declared in `placeholder-catalog.ts` and Go planner.
   - Enable slide templates in Announcement Sets to declare and render these placeholders.
   - Hydrate placeholders at slide plan creation (`slide-plan.ts` and `internal/plan/hydrate.go`) from the active weekly service context, displaying the current week's poster, photos, and afternoon schedule without manual template editing.

## User Stories

1. As a church administrator, I want to upload church flyers (such as Welcome, Church Cleanliness, and Tithe slides) to a central Media Gallery once, so that I do not have to upload the same file repeatedly for different announcement sets.
2. As a church administrator, I want to browse all uploaded church flyers and backgrounds as visual thumbnails in the Media Gallery tab of Registry Admin, so that I can easily find and manage existing visual assets.
3. As a church administrator, I want to delete obsolete flyers or background images from the Media Gallery index without corrupting previously generated presentations, so that the gallery stays clean while historical slide layouts remain safe.
4. As a slide designer in Canvas Editor, I want to click an "Insert from Gallery" button when adding an image, so that I can immediately select an existing church flyer without searching my computer's hard drive.
5. As a slide designer in Canvas Editor, I want to choose a slide background from visual gallery thumbnails, so that I can quickly apply consistent church background textures.
6. As a church operator, I want to toggle an "Auto Loop" button in Presenter with a selectable interval (5s, 7s, 10s, 15s), so that announcement slides cycle automatically during church break times without manual clicking.
7. As a church operator, I want the auto-advance loop to cycle strictly within the active announcement section and wrap from its last slide back to its first slide, so that the main worship liturgy is never accidentally skipped or looped.
8. As a church operator, I want the auto-advance loop to disarm immediately if I press an arrow key, click another slide, or close the deck, so that I maintain complete manual authority during live worship.
9. As a church operator, I want the live projection window (`/projected`) to transition slides in lockstep with the operator loop timer, so that the congregation sees smooth, synchronized slide changes.
10. As a church operator, I want the Sermon Poster uploaded in the weekly service form to automatically hydrate into the sermon announcement slide via `{sermon_poster}`, so that weekly graphics appear without redesigning slides.
11. As a church operator, I want Family and Youth prayer photos entered in the weekly worship form to display dynamically on the Prayer of the Week announcement slide via `{family_photo}` and `{youth_photo}`, so that weekly prayer requests are visually highlighted.
12. As a church operator, I want to enter Afternoon Program schedule notes in the weekly service form and have it appear on the announcement slide via `{afternoon_program}`, so that afternoon activities are displayed accurately.
13. As a church administrator, I want announcement slides with dynamic placeholders to export cleanly to PowerPoint (`.pptx`), with missing images falling back to graceful placeholders rather than failing the export.

## Implementation Decisions

1. **Central Media Gallery Backend & Reference Safety**:
   - In `internal/httpapi/background_library.go` (or extended `media_library.go`):
     - Support category filtering: `?category=flyer|background|all`.
     - Deletion: Delete record from database table. The underlying file in `data/uploads/` is retained to prevent breaking historical decks and templates citing the URL.
     - Storage: Continues to store in `data/uploads/` with hashed filenames and local SQLite metadata persistence. Zero external CDN calls.
   - Missing Asset Fallback: In `ArtifactSlide.tsx` and `canvas-utils.ts`, if an image fails to load, render a subtle placeholder outline rather than throwing an unhandled error. In `pptx-draw.ts`, catch fetch errors and omit the image or draw an empty box, ensuring PPTX export succeeds.

2. **Registry Admin Media Gallery UI & ArtifactEditor Integration**:
   - In `src/components/admin/RegistryAdmin.tsx`: Provide a "Media Gallery" tab featuring category filter pills (`All`, `Flyers`, `Backgrounds`), upload dropzone, thumbnail preview grid, and delete buttons.
   - In `src/components/admin/ArtifactEditor.tsx`:
     - Toolbar Image tool: provide options "Upload New Image" and "Choose from Gallery".
     - Choosing from gallery inserts a `CanvasElement` (`type: 'image'`) using the canonical URL reference.
     - Background dialog: visual thumbnail selection from the gallery.

3. **Presenter Section-Bounded Looping Engine**:
   - In `src/operator/present/PresenterOperator.tsx`:
     - Define announcement bounds helper: given `currentSlideIndex` and `slides: PresenterRow[]`, determine if the current slide is an announcement (`templateId.startsWith('ann-slide-')`). If yes, compute `[sectionStartIndex, sectionEndIndex]` of the contiguous announcement block.
     - Loop state: `isLooping: boolean`, `loopIntervalSeconds: number` (stored in `localStorage`, default 7s).
     - Interval timer: advances slide index. If `currentIndex === sectionEndIndex`, advance to `sectionStartIndex`.
     - Manual override: on `handlePrev`, `handleNext`, keyboard arrow press, or slide list click, set `isLooping = false`.
     - Synchronization: slide advances trigger standard `broadcastState()` over `present-channel`.

4. **Dynamic Announcement Placeholders & Weekly Service Schema**:
   - Use canonical keys: `{sermon_poster}`, `{family_photo}`, `{youth_photo}`.
   - Database migration / schema: Add `afternoon_program TEXT DEFAULT ''` to `worship_services` table in `internal/db/db.go`.
   - Update `StructuredServiceFields` in `src/lib/parsed-fields.ts` and `src/lib/worship-form-fields.ts` to include `afternoonProgram?: string`.
   - In `placeholder-catalog.ts` and `internal/plan/plan.go`: Add `{afternoon_program}` (text placeholder).
   - In `slide-plan.ts` and `internal/plan/hydrate.go`: Map `afternoonProgram` to `{afternoon_program}` in weekly catalog values.

5. **PPTX Export Resolution**:
   - `src/lib/pptx-draw.ts` resolves gallery URLs and dynamic weekly placeholder images, catching fetch errors gracefully to guarantee export integrity.

## Testing Decisions

1. **Unit & Contract Tests (`tests/smoke-spec-39.test.mjs`)**:
   - Test Media Gallery API: create flyer/background, list with category filters, delete record, verify URL persistence.
   - Test Canvas serialization with gallery-referenced images: verify identical URL reference and lack of duplicate file generation.
   - Test Presenter announcement section bounding: verify timer step progression, wrap-around at announcement boundary, refusal to loop non-announcement liturgy, and cancellation upon manual key input.
   - Test dynamic placeholder hydration: verify that `{sermon_poster}`, `{family_photo}`, `{youth_photo}`, and `{afternoon_program}` populate from sample service records in both TypeScript and Go.
   - Real absence guards with defect injection proving that omitting reference safety or loop boundary checking fails tests.

## Out of Scope

- Video background loop playback (covers static graphics and slide transitions only).
- AI automatic sermon flyer generation.
- Multi-church cloud sync.

## Further Notes

- Existing background images in `data.db` map to category `background`.
- If an announcement slide contains no dynamic placeholder, it renders as a static visual slide.

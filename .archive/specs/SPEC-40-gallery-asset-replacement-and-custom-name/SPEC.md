# SPEC-40 — Gallery Asset In-Place Replacement, Category Reconciliation, and Ergonomic Custom Naming

> **Status:** closed
> **Release:** gallery-asset-replacement-and-custom-name
> **Component:** registry
> **Touches:** artifacts, uploads, db
> **Depends on:** SPEC-39

## Problem Statement

Following manual testing of the initial Media Gallery introduced in SPEC-39, several operational friction points and design misalignments were identified by church operators managing worship media:

1. **Inability to Replace Existing Gallery Images in Place (Broken Deck Links):**
   When an announcement banner or graphic is updated (e.g., sermon title tweaked, date adjusted, or typo corrected), operators must upload a completely new image. This generates a new random filename and URL (e.g., `/api/uploads/<new-hash>.png`), forcing operators to manually navigate through every artifact template, announcement set, and weekly deck sequence that already referenced the previous image to swap the URL. Replacing an image must preserve the existing record `id` AND the exact stored URL slug/path so that all connected slides, main deck sequences, and templates automatically reflect the updated graphic without manual re-linking.

2. **Categorical Disconnect (`flyer` vs `announcement`):**
   The categories initially included `flyer`, `background`, and `general`. In actual church operations, standalone "flyers" do not exist as a distinct media bucket; church flyers are situational announcements. The domain terminology must be reconciled to:
   - **General** (general media, church logos, brand assets)
   - **Background** (worship backgrounds, lyric textures, slide wallpapers)
   - **Announcement** (renamed from `flyer`; encompasses church event flyers, weekly notices, and program banners)

3. **Suboptimal Input Ergonomics & Low-Contrast Category Selection:**
   In the upload interface of `BackgroundLibraryPanel.tsx`, the category selector was positioned far in the top-right header, decoupled from the file picker and URL input boxes below. Furthermore, the upload action button was pushed to an awkward separate column, and the visual distinction between the active category and inactive categories used low-contrast button variants (`secondary` vs `outline`), making it difficult to tell at a glance which category was currently selected.

4. **Missing Custom Asset Naming & Renaming:**
   Gallery images currently display only an internal auto-increment ID (`Media #12`) and their raw uploaded URL. Operators have no ability to assign a human-meaningful custom name (e.g. "Poster Kebaktian Paskah 2026", "Background Navy Blue Gradient") during upload or rename existing assets later, causing confusion when searching or selecting assets in the gallery.

## Solution

1. **In-Place Image Replacement Preserving ID and URL Path:**
   - **Invariant:** Every successful replacement strictly preserves the stored `id` and the existing URL path (`/api/uploads/<filename>`). The URL path never changes.
   - **Atomic Overwrite:** The backend accepts a replacement image file via `POST /api/admin/media-library/{id}/replace` (multipart form `file`, requiring admin session, size capped at 20MB). The payload is written to a temporary staging file in the uploads directory and atomically renamed (`os.Rename`) over the existing target file on disk.
   - **Concurrency Safety:** Replacement requires the current `updatedAt` token (via form field or header). If `storedUpdated != updatedAt`, the request is rejected with `409 Conflict`.
   - **Format Compatibility:** Replacement files must be a valid image format compatible with web rendering (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`). If the extension matches, the file is overwritten directly. If the uploaded image format differs, it is saved into the existing container or rejected if incompatible, ensuring the URL slug `/api/uploads/<filename>` is never altered.
   - **Immediate Cache Freshness:** Update `getUpload` in `internal/httpapi/uploads.go`: replace `Cache-Control: public, max-age=31536000, immutable` with `Cache-Control: no-cache, must-revalidate` alongside an `ETag` / `Last-Modified` validator based on `os.Stat(path).ModTime()`. When slides, operator presenter, projector screen, or canvas editor request the image, browsers revalidate and immediately receive the fresh graphic with zero delay.

2. **Domain Category Reconciliation (`General`, `Background`, `Announcement`):**
   - **Database Migration:** Idempotent migration in `internal/db/migrate.go` executing `UPDATE background_library_images SET category = 'announcement' WHERE category = 'flyer'`.
   - **Transitional Normalization:** Incoming `POST` and `PATCH` requests accept `'general'`, `'background'`, `'announcement'`. If legacy `'flyer'` is submitted, it is normalized to `'announcement'`. Outgoing `GET` responses strictly emit `'announcement'`, never `'flyer'`.
   - **Frontend:** Category buttons and filter tabs in `BackgroundLibraryPanel.tsx` and `ArtifactEditor.tsx` are updated to "General", "Background", and "Announcement".

3. **Input UX Ergonomics & High-Contrast Visual State:**
   - Reorganize the upload card in `BackgroundLibraryPanel.tsx` into a cohesive, stacked form layout where:
     - The Category Selector sits immediately above/adjacent to the asset input.
     - Active category selection uses high-contrast styling (solid primary fill `variant="default"`, bold font, checkmark icon) easily distinguishable from unselected outline items (`variant="outline"`).
     - Custom Name input field is integrated directly alongside the file picker and direct URL input.
     - Upload button is intuitively aligned with the active input method.

4. **Custom Name Metadata & Inline Renaming:**
   - Add `name TEXT NOT NULL DEFAULT ''` to `background_library_images` schema.
   - Stored `name` defaults to `""` unless the operator explicitly provides a custom title.
   - Enable inline editing / rename via `PATCH /api/admin/media-library/{id}` with `{ name, updatedAt }`.
   - Display the custom name prominently on gallery asset cards (falling back to `Media #<id>` if empty) and in the Canvas Editor gallery picker dialog.

## User Stories

1. As a church administrator, I want to replace an existing gallery image file in place without changing its ID or URL slug, so that any slides or deck sequences already connected to that image update automatically without manual re-linking.
2. As a church administrator, I want the media categories to be "General", "Background", and "Announcement" (renamed from flyer), so that the categories reflect actual church media workflows.
3. As a church administrator, I want existing flyer assets to automatically migrate to the Announcement category, so that no historical assets are lost or orphaned.
4. As a church administrator, I want the category selector in the upload form to be located directly next to the input box and upload button, so that my upload workflow is ergonomic and fast.
5. As a church administrator, I want the selected upload category to have high visual contrast against unselected categories, so that I can instantly verify which category my file will belong to.
6. As a church administrator, I want to give uploaded images a custom name (e.g. "Easter Sermon Poster"), so that I can easily identify assets in the gallery.
7. As a church administrator, I want to rename existing gallery images at any time, so that I can fix or update descriptions without re-uploading the file.
8. As a slide author in Canvas Editor, I want the "Choose from Gallery" dialog to show the reconciled categories (General, Background, Announcement) and custom names, so that I can quickly pick the right graphic.

## Implementation Decisions

1. **Storage & In-Place Replacement Semantics:**
   - In `internal/httpapi/background_library.go`:
     - Handler `POST /api/admin/media-library/{id}/replace` (and alias `/api/admin/background-library/{id}/replace`).
     - Optimistic locking: checks `updatedAt` against current stored record.
     - Atomicity: writes to temp file `filepath.Join(uploadsDir(), "tmp_"+filename)` and renames over target file `filepath.Join(uploadsDir(), filename)`.
     - Invariant: the stored `url` path is never mutated on replacement.
   - Cache control in `uploads.go`: replace immutable cache with `Cache-Control: no-cache, must-revalidate` and `ETag`/`Last-Modified`, guaranteeing immediate browser revalidation.

2. **Database Migration & Schema Evolution:**
   - In `internal/db/schema.sql`: add `name TEXT NOT NULL DEFAULT ''` to `background_library_images`.
   - In `internal/db/migrate.go`:
     - `ensureBackgroundLibraryNameColumn(handle)`: adds `name TEXT NOT NULL DEFAULT ''` if not present.
     - `migrateLegacyFlyerCategories(handle)`: executes `UPDATE background_library_images SET category = 'announcement' WHERE category = 'flyer'`.

3. **Component & Touch Mapping:**
   - SPEC-40-01: Backend schema migration, atomic replace API, category reconciliation, and rename endpoints.
   - SPEC-40-02: Media gallery input layout ergonomics, high-contrast category badges, rename UI, and replace modal/action.
   - SPEC-40-03: ArtifactEditor picker category alignment, custom name display, and end-to-end smoke tests.

# SPEC-40-02 — Gallery Input Ergonomics, Category Badging, and In-Place Replace UI

**What to build:**
Redesign the upload card in `BackgroundLibraryPanel.tsx` with cohesive ergonomics, high-contrast category selection (`General`, `Background`, `Announcement`), optional custom name input on upload, inline rename action on gallery cards, and an in-place "Replace Image" action on each media card that overwrites the image asset while retaining its exact ID and URL path.

**Blocked by:** 01-schema-migration-replace-api-and-category-reconciliation

**Status:** closed

- [x] Category Reconciliation in Frontend (`src/components/admin/BackgroundLibraryPanel.tsx`):
  - Replace `'flyer'` category with `'announcement'`.
  - Categories: `'general'`, `'background'`, `'announcement'`.
  - Filter tabs: `All Assets`, `General`, `Background`, `Announcement`.
- [x] Upload Form Ergonomics & High-Contrast Visual State:
  - Reposition Category Selector directly above/alongside the asset input, not separated in the card header.
  - Implement high-contrast active state for selected category button (solid primary background `variant="default"`, bold font, checkmark icon) compared to unselected outline buttons (`variant="outline"`). Include accessible aria-pressed and focus outlines.
  - Add optional "Custom Name" text input in the upload form (`placeholder="e.g. Easter Sermon Poster"`). Stored value defaults to empty string if left blank.
  - Unify file picker and URL input with clearly positioned submit buttons.
- [x] Custom Name Display & Inline Rename:
  - Display custom `name` prominently on each gallery card, falling back to `Media #<id>` when empty.
  - Add a "Rename" button on each media card allowing operators to update the asset's custom name without re-uploading.
  - Call `PATCH /api/admin/media-library/{id}` with `{ name, updatedAt }` and update local state upon success.
- [x] In-Place Image Replace Action on Gallery Cards:
  - Add a "Replace Image" button on each gallery asset card.
  - Clicking opens a file selector to choose the replacement image.
  - Upload replacement to `POST /api/admin/media-library/{id}/replace` sending multipart form data with `file` and current `updatedAt`.
  - On success, update the card's `updatedAt` in component state and refresh the thumbnail with a cache-busting timestamp (`?t=Date.now()`) to provide instantaneous feedback in the operator UI.
  - Toast notification confirming image replacement while preserving the linked URL path.

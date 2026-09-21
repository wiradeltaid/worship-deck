# 04: In-Place Media Gallery Asset Manager Drawer & End-to-End Smoke Tests

**What to build:**
Implement the in-place media gallery drawer and comprehensive smoke test suite:
1. Create MockupMediaGalleryDrawer in `src/operator/workspace`:
   - Side drawer / modal for browsing church media gallery assets.
   - Category filter tabs:
     - Semua
     - Latar Belakang (Worship Backgrounds)
     - Salib & Simbol
     - Alam & Lanskap
     - Tekstur Abstrak
   - Asset grid displaying thumbnails, image dimensions, and category badges.
   - Handles empty search/filter states gracefully with clear empty indicator.
   - "Pilih & Pasang Latar" button to assign selected image directly to the active item (Song, Custom Slide, General Slide).
   - "Unggah Gambar Baru" simulation button adding local synthetic mock asset to the gallery.
2. Connect Media Gallery triggers:
   - "Pilih dari Galeri" in Song context editor (`MockupEditor.tsx`).
   - "Pilih dari Galeri" in Custom Slide context editor.
   - "Galeri Media" button in `MockupCanvasDesignerModal.tsx`.
3. Create End-to-End Smoke Test Suite `tests/smoke-spec-49.test.mjs`:
   - Assert in-place Canvas Designer modal opens, modifies element alignment/typography, and reflects in live preview upon Apply, while Cancel discards edits cleanly.
   - Assert Custom Slide (`custom_slide`) can be added to the timeline and edited.
   - Assert Jadwal Bebas (Non-Preset) supports blank slate clearing and empty state addition.
   - Assert Duty Roster drawer binds selected synthetic personnel to sermon speaker.
   - Assert Media Gallery drawer opens, filters assets, and assigns background image.
   - Register `test:smoke-spec-49` script in `package.json`.

**Blocked by:** 03

**Status:** closed

- [x] Create MockupMediaGalleryDrawer in `src/operator/workspace` with category filtering and asset assignment.
- [x] Connect media gallery picker to Song, Custom Slide, and Canvas Designer.
- [x] Create `tests/smoke-spec-49.test.mjs` and add `test:smoke-spec-49` to `package.json`.
- [x] Verify all test assertions pass cleanly.

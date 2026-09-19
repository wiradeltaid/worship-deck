# 01: In-Place Visual Canvas Designer Modal & Freeform Layout Editor

**What to build:**
Implement the in-place visual canvas designer modal for the unified schedule workspace prototype:
1. Create MockupCanvasDesignerModal in `src/operator/workspace`:
   - Fullscreen/large modal dialog embedding a visual slide layout editor.
   - Live visual canvas area rendering the slide elements with selectable bounding boxes:
     - Header / Title block
     - Body / Lyrics / Scripture text block
     - Subtitle / Reference block
   - Layout & Alignment toolbar:
     - Horizontal alignment (Kiri, Tengah, Kanan).
     - Vertical position controls (Atas, Tengah, Bawah).
     - Bounding box width/margin adjustment.
   - Typography controls:
     - Font family picker (Geist Sans, Geist Mono, Serif, Sans-serif).
     - Font size slider with numerical indicator.
     - Font weight and text color picker (White, Yellow, Cyan, Gold).
   - Background picker trigger:
     - Preset solid/gradient backgrounds.
     - Button to open Media Gallery drawer.
   - Action buttons with clear observable semantics:
     - "Terapkan Perubahan" (saves to local React item state and updates live canvas preview).
     - "Batal" (discards changes without mutating active item state or live preview).
2. Wire up triggers to launch the Canvas Designer:
   - "🎨 Ubah Tata Letak Kanvas" button in `MockupEditor.tsx` across Song, Sermon, and General contexts.
   - "🎨 Edit Kanvas" button in `MockupCanvasPreview.tsx` header toolbar.

**Blocked by:** none

**Status:** closed

- [x] Create MockupCanvasDesignerModal in `src/operator/workspace`.
- [x] Implement bounding box alignment, typography, and color controls.
- [x] Connect modal triggers from editor and canvas preview.
- [x] Ensure "Terapkan" updates the sticky live canvas preview while "Batal" discards edits cleanly.

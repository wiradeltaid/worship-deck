# 02: Interactive Run Sheet Timeline & In-Place Item Context Editor

**What to build:**
Implement the interactive timeline and contextual in-place item editor:
1. Build the Run Sheet timeline in `src/operator`:
   - Interactive list of worship schedule items:
     1. Pembukaan & Ucapan Selamat Datang (General Slide)
     2. Lagu Buka — Hai Pujilah Tuhan / SDAH 123 (Song)
     3. Doa Pembuka (General Slide)
     4. Warta Jemaat Mingguan (Announcement Set, 4 slides)
     5. Pembacaan Alkitab — Yohanes 3:16 (Scripture)
     6. Khotbah — Kasih yang Mengubahkan (Sermon Predefined Card)
     7. Lagu Tutup — Tuhan Allah Beserta Engkau (Song)
     8. Doa Berkat (General Slide)
   - Visual drag-handle, item sequence number, duration/time badge, and color-coded item type badge.
   - Interactive Add Item button opening a dropdown to insert new items.
2. Build the in-place contextual editor in `src/operator`:
   - Toggle tabs: Editor Item Aktif vs Teks Rundown Mentah (Salin-Tempel & Parse).
   - Dynamic contextual form adapting to the selected timeline item:
     - Song Context: Song title autocomplete mockup, active verse selector checkboxes (Bait 1, 2, 4), pitch/key transpose selector, and background picker.
     - Announcement Context: Single-row 4-slot flyer grid preview respecting Registry boundaries, with in-place upload simulation affordance and looping carousel toggle.
     - Sermon Context: Predefined fields (Speaker, Title, Scripture Reference) with instant token preview.
   - In-place creation simulation: Add New Song and Upload New Flyer opening in-place modal drawers (simulating local fixtures without network mutations).

**Blocked by:** 01

**Status:** closed

- [x] Build timeline component in `src/operator` with item selection and drag-handle affordance.
- [x] Build contextual item editor form adapting to Song, Announcement, and Sermon selections.
- [x] Implement in-place modal drawers for adding songs and uploading flyers without leaving the workspace.
- [x] Add smoke tests verifying item selection updates center form context.

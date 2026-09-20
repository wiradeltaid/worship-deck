# 02: Master Libraries In-Drawer Direct CRUD & Layout Refactoring

**What to build:**
Equip the `MockupMasterLibrariesDrawer` ("Koleksi Master & Kamus Variabel") with direct in-drawer CRUD actions to eliminate the need to route through active service schedules to manage master records:
1. Direct In-Drawer Master Song Sets CRUD:
   - Provide primary action: **"+ Tambah Song Set Baru"** in the Master Song Sets tab header:
     - Opens modal dialog: Title, Description, and dynamic song items picker (Hymn title, number, key, verses).
   - In each Song Set card:
     - Add **"Ubah"** action: edit title, description, and songs in-place.
     - Add **"Hapus"** action: validates with a **Preset Dependency Guard** (checks if any master preset blueprint references this master song set; if referenced, refuses deletion with descriptive error toast).
   - Retain **"Pilih Set Ini"** for injecting into the active schedule timeline with frozen snapshot isolation (`schedule_items.payload`).
2. Direct In-Drawer Master Announcements CRUD:
   - Provide primary action: **"+ Tambah Warta Baru"** in the Master Announcements tab:
     - Form: Title, Looping Carousel toggle, and flyer uploads.
   - In each Announcement Set card:
     - Add **"Ubah"** action: add/remove flyers, reorder slides, and adjust carousel settings.
     - Add **"Hapus"** action: removes from master library with confirmation dialog displaying flyer count. Existing scheduled services retain deep-cloned flyer snapshots.
   - Retain **"Pilih Warta Ini"** for injecting into timeline.
3. Predefined Tokens Editor & Immutability Protection:
   - In Predefined Tokens tab:
     - Support inline editing of token labels and descriptions.
     - System tokens (`sermon_speaker`, `sermon_title`, `scripture_reference`, `worship_leader`, `church_announcement_date`) display an explicit **[System]** badge with delete protection (delete button disabled).
     - Custom tokens support deletion with confirmation.
4. Drawer Ergonomics & Resizing for 1920px:
   - Expand drawer width from `max-w-2xl` to `max-w-3xl 2xl:max-w-4xl` for spacious multi-card grid viewing on 1920px Full HD screens.

**Satisfies:** UC-14, UC-24, FR-20, FR-29, FR-30

**Touches:** operator, artifacts

**Blocked by:** 01

**Status:** closed

- [x] Implement "+ Tambah Song Set Baru", in-place edit, and delete with preset dependency guard in Master Song Sets tab.
- [x] Implement "+ Tambah Warta Baru", flyer management, and delete in Master Announcements tab.
- [x] Add inline editing and system token immutability guard in Predefined Tokens tab.
- [x] Expand drawer width to max-w-3xl / 2xl:max-w-4xl for 1920px Full HD displays.

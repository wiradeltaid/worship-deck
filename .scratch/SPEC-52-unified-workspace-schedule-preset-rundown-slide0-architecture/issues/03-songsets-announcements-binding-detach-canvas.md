# 03: Master Song Sets & Announcements Variable Binding, Detachment & Canvas Template Layouts

**What to build:**
Implement dynamic binding and detachment lifecycle for Master Song Sets and Announcements:
1. Dynamic Master Song Set Binding & Detach Action:
   - When a Master Song Set is applied to the timeline via `Pilih dari Master Songset`:
     - Binds the master record ID (`master_song_set_id`) and surfaces parameters in Slide 0.
     - Displays visual binding indicator badge: `[ 🔗 Terikat Master: {songSet.title} ]`.
     - Support optional non-binding path (inserting song directly as local standalone slide without master pointer).
   - **Explicit Detach Action (`[ 🔓 Detach dari Master Songset ]`):**
     - Deep-clones the song set template data into `schedule_items.payload`.
     - Clears the `master_song_set_id` pointer (sets to null).
     - Converts the item into independent, locally editable presentation slides with zero retroactive mutation to the master catalog.
2. Master Song Set Canvas Visual Template:
   - Implement structured canvas template zones for song slides in the preview and canvas designer:
     - Song Title header: Hymn Title and Hymn Book/Number badge (`SDAH 123 • Key D`).
     - Lyric Verse zone: Formatted typography for active verse (`Bait 1, 2, 4`).
     - Lyric Chorus / Reff zone: Distinct styling for chorus lines (italicized or highlighted accent color).
3. Master Announcement Sets Binding & Central Slot Persistence:
   - When an announcement set is selected from master:
     - Shows binding indicator badge with an option to `[ 🔓 Detach dari Master Warta ]`.
     - Maintains slot architecture (`initialAnnouncementInserts`) so announcement flyers and descriptions can be centrally assigned and previewed from Slide 0.
     - Supports `[Simpan sebagai Master Warta Baru]` for saving customized announcement slide collections into the master catalog.

**Satisfies:** UC-11, UC-14, UC-24, FR-20, FR-29

**Touches:** artifacts, present-channel

**Blocked by:** SPEC-52-02

**Status:** closed

- [x] Implement `[ 🔗 Terikat Master ]` badge and `[ 🔓 Detach dari Master Songset ]` uncoupling action with deep-clone snapshot.
- [x] Provide optional non-binding path for adding local songs without master catalog pointers.
- [x] Render structured Master Song Set canvas template with Title, Lyric Verse, and Lyric Reff styling zones.
- [x] Implement `[ 🔓 Detach dari Master Warta ]` and `[Simpan sebagai Master Warta Baru]`.
- [x] Retain announcement slot persistence and multi-flyer carousel controls managed via Slide 0.

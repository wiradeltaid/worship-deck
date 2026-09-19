# 02: Custom Slide (`custom_slide`) Item Type & Blank Slate Free Schedule

**What to build:**
Implement the custom slide item type and blank slate free schedule workflow:
1. Extend `src/operator/workspace/types.ts`:
   - Add `'custom_slide'` to `TimelineItemType` (ensuring consistent naming across types and state).
   - Add `customSlideData` interface containing `{ title: string; content: string; subtitle?: string; backgroundUrl?: string; style?: { alignment: string; fontSize: number; color: string } }`.
2. Update `MockupTimeline.tsx`:
   - Add `🎨 Slide Bebas (Kanvas Kustom)` option to `+ Tambah Item` dropdown menu.
   - Render custom slide cards with distinctive teal/emerald color badge (`custom_slide`).
3. Update `MockupEditor.tsx`:
   - Build contextual editor form for `custom_slide`:
     - Slide Title input.
     - Content textarea (supports multi-line freeform text, poems, responsive readings, special announcements).
     - Subtitle input.
     - "🎨 Buka Canvas Designer" button.
4. Support Blank Slate for "Jadwal Bebas (Non-Preset)":
   - When user switches preset to "Jadwal Bebas (Non-Preset)", show an interactive action banner:
     - "Mulai dari Jadwal Kosong (Blank Slate)" & "Gunakan Template Contoh".
   - Clicking "Mulai dari Jadwal Kosong" clears all timeline items and displays an empty state placeholder with `+ Tambah Item Pertama` button.
   - Clicking "Tambah Item Pertama" creates an initial valid slide item and selects it immediately.

**Blocked by:** 01

**Status:** closed

- [x] Add `custom_slide` item type consistently to types and timeline dropdown.
- [x] Implement contextual editor for custom slides with multiline text input.
- [x] Implement blank slate clearing action and empty state for non-preset schedule.
- [x] Ensure custom slides render properly in sticky live canvas preview.

# SPEC-52 — Unified Workspace Schedule-Preset Lifecycle, Slide 0 Rundown Hub & Canvas-First Architecture

> **Status:** open  
> **Release:** unified-workspace-slide0-architecture  
> **Component:** hub  
> **Touches:** operator, spa, presenter, artifacts, settings, tests  
> **Depends on:** SPEC-51  

## Problem Statement

During hand-testing and operational review of SPEC-51, the maintainer provided explicit architectural feedback to rectify workflow friction and align the workspace with actual church AV booth reality:

1. **Schedule vs. Preset Conceptual & Operational Model:**
   - **Flawed live switcher:** The top command bar in SPEC-51 contained an in-place *Preset Selector Dropdown* alongside service status. In presentation workflows, presets are not live runtime switches. A preset is a clean, empty blueprint template copied into a schedule at initialization. Switching presets mid-schedule causes accidental state loss or confusion.
   - **Top-left primary navigation:** Operators need direct, unambiguous top-left actions: `[Jadwal Baru]` (Blank schedule from scratch) and `[Muat Jadwal]` (Load existing saved schedules, renamed from `Riwayat Jadwal`).
   - **Symmetric Data Contract:** Structurally, a **Schedule** and a **Preset** are identical slide arrays (`Schedule ≡ Preset`). The sole distinction is data fullness:
     - **Preset:** Reusable master template where `rundown_text` is empty, flyer/poster image payloads are empty, and weekly variable values are blank. Presets can be created, copied into schedules (`[Salin Preset]`), duplicated in the master library, and deleted with dependency checks.
     - **Schedule:** Operational instance containing populated event data (pasted rundown, specific preacher/speaker names, uploaded flyers). Schedules can be loaded, duplicated, saved, and exported.
   - **Safety Warning on `[Salin Preset]`:** When an operator is on a loaded or dirty schedule and invokes `[Salin Preset]`, an explicit overwrite confirmation warning is presented (analogous to re-syncing artifacts in `UC-16`):
     *"Menyalin preset akan menggantikan susunan slide jadwal aktif saat ini. Seluruh slide yang ada akan ditimpa dengan cetak biru preset. Lanjutkan?"*
   - **Save as Preset (Sanitizer):** Any active schedule can be saved as a new Preset (`[Simpan sebagai Preset Baru]`). The system executes an automated **Preset Sanitizer** that preserves the slide sequence, slide types, typography, and token placements, while stripping all instance-specific payloads (raw rundown text, uploaded flyer/poster files, specific dates, and instance personnel names).

2. **Rundown Ingestion as Step 1: Pinned Slide 0 ("Rundown & Form Hub"):**
   - The primary workflow entry point for church AV operators is copy-pasting a raw rundown received via WhatsApp or email.
   - The Run Sheet Timeline (panel kiri) permanently pins **Slide 0: Rundown & Formulir Ibadah** at index 0 (non-reorderable, non-deletable).
   - Selecting Slide 0 displays the **Rundown Hub** in the center panel:
     - Full-width textarea for pasting raw WhatsApp rundowns with one-click `[⚡ Parse Rundown]` execution.
     - Centralized weekly variable inputs for service-bound values: Sermon Preacher (`{sermon_speaker}`), Sermon Title (`{sermon_title}`), Scripture Reference (`{scripture_reference}`), Worship Leader (`{worship_leader}`), Family of the Week (`{family_of_the_week}`), and announcement flyer slots.
     - Reconciled with `DEC-004` and `SRS-hub`: Slide 0 owns the weekly instance values and preview expansion, while the global token catalog and layout definitions remain governed in the Registry.
     - Option to `[⚙️ Edit Tata Letak Form]` to configure field groupings and display ordering.

3. **Canvas-First Freedom for General Slides (Slide 1..N):**
   - Eliminates rigid `Judul Agenda` and `Keterangan / Subtitle` input boxes from Slide 1..N contextual editors.
   - Slides 1..N are pure presentation slides (WYSIWYG canvas-first):
     - Timeline card titles automatically derive from slide content (first line of text or song title).
     - Direct in-place editing of text boxes, font family, typography size, alignment, and background.
     - One-click insertion of Predefined Field tokens (`{sermon_speaker}`, etc.) directly into slide text boxes.

4. **Master Song Sets & Announcements Binding & Detachment Lifecycle:**
   - **Binding:** When an item is populated via `Pilih dari Master Songset` or `Pilih dari Master Warta`:
     - Binds the master record ID and surfaces configurable parameters in Slide 0.
     - Shows visual status pill: `[ 🔗 Terikat Master: {title} ]`.
   - **Detachment:** Provides an explicit `[ 🔓 Detach dari Master ]` action:
     - Deep-clones the master template payload into local schedule item state (`schedule_items.payload`), clearing the master reference pointer.
     - Transforms the item into independent, locally editable slides with zero retroactive impact on master catalog records.
   - **Master Song Set Canvas Template:** Previews structured layout zones:
     - Header: Song Title & Hymn Number badge (`SDAH 123 • Key D`).
     - Body: Formatted Verse Lyrics (`Bait 1, 2, 4`).
     - Refrain / Chorus: Highlighted accent styling.
   - **Master Announcement Sets:** Retains slot architecture (`initialAnnouncementInserts`) managed centrally from Slide 0, with support for saving customized announcement sets as new masters.

5. **Legacy UI/UX Capability Parity & Regression Safeguards:**
   - Bounded, testable inventory preserving 100% operational parity with legacy presenter workflows:
     - Multi-slide filmstrip grid overlay (`F` key / toggle) during presentation mode for random-access slide jumps.
     - Quick projection tools: Emergency Blackout (`B`), Clear Text (`C`), 16:9 and 4:3 Aspect Ratio guides, and Stage Confidence monitor switcher.
     - Keyboard focus safety guard (`isInputOrEditableFocused`) suppressing single-key shortcuts when typing in Slide 0 or slide text inputs.
     - Remote control pairing modal with 4-digit PIN and scoped expiration.
     - Desktop offline sync dialog with local-server-fork conflict resolution.

---

## User Workflows & State Transitions

### Workflow 1: Schedule & Preset Lifecycle
```text
Top-Left Action:
  [Jadwal Baru] ──> Initializes blank slate (Slide 0 only, 0 item slides)
  │
  ├──> [Salin Preset] ──> Modal selects Preset (Sabat Pagi, Vesper, dll.)
  │                         └──> Overwrites timeline slides from preset blueprint
  │                              (Prompts warning if active schedule already has slides/data)
  │
  [Muat Jadwal] ──> Opens Schedule Drawer (Search, Load, Duplicate, Delete)

Secondary Menu:
  [Simpan Jadwal] ──> Persists active schedule instance
  [Duplikat Jadwal] ──> Clones active schedule into a new dated instance
  [Simpan sbg Preset] ──> Runs Preset Sanitizer (strips raw text, posters, names);
                           saves reusable blueprint to Master Presets
  [Duplikat Preset] ──> Clones an existing Preset blueprint in Master Presets
```

### Workflow 2: Pinned Slide 0 "Rundown & Form Hub"
```text
RUN SHEET TIMELINE (Left 400px)           CONTEXTUAL VIEW (Center Fluid 600-900px)
┌──────────────────────────────────────┐  ┌─────────────────────────────────────────────────────────┐
│ 📌 [ Slide 0: Rundown & Formulir   ] │  │ SLIDE 0: RUNDOWN & FORMULIR IBADAH TERPADU              │
│    • Status: Terisi (7 Item)         │  │ ┌─────────────────────────────────────────────────────┐ │
│ ──────────────────────────────────── │  │ │ [ Salin-Tempel Teks Rundown WA ] [ ⚡ Parse Rundown ]│ │
│ 1. [ Lagu: Hai Pujilah Tuhan       ] │  │ └─────────────────────────────────────────────────────┘ │
│ 2. [ Doa Pembukaan                 ] │  │ FORMULIR VARIABEL & SLOT TERPUSAT                       │
│ 3. [ Warta Jemaat (4 Flyer)        ] │  │ • Pengkhotbah: [ Pdt. E. R.                         ] │
│ 4. [ Khotbah: Kasih Karunia        ] │  │ • Ayat Firman: [ Yohanes 3:16                       ] │
│ 5. [ Lagu Tutup: SDAH 45           ] │  │ • Family of the Week: [ Kel. Bpk. S.                ] │
│                                      │  │ • Slot Warta: [ 4 Flyer Terunggah                   ] │
│ [ + Tambah Slide ]                   │  │ [ ⚙️ Edit Tata Letak Form (Grouping & Tokens)       ] │
└──────────────────────────────────────┘  └─────────────────────────────────────────────────────────┘
```

### Workflow 3: Song Set & Announcement Dynamic Binding & Detach
```text
Master Library Selection:
  [Pilih dari Master Songset] ──> Injects into schedule; sets master_song_set_id
                                   Shows [ 🔗 Terikat Master: Kemuliaan Bagi Allah ]
                                   Variables populate in Slide 0

Operator Customization:
  [ 🔓 Detach dari Master ] ──> Deep-clones template into schedule_items.payload
                                Sets master_song_set_id = null
                                Slide becomes standalone local presentation slide
                                Zero retroactive mutation to master catalog
```

---

## User Stories

1. As an operator opening the presenter, I want direct `[Jadwal Baru]` and `[Muat Jadwal]` buttons at the top-left so that I can start from a clean slate or resume an existing service immediately (`UC-5`, satisfying `FR-11`).
2. As an operator, I want to use `[Salin Preset]` with a safety warning dialog so that I can seed my schedule from a template without accidental data loss (`UC-14`, satisfying `FR-11`, `UC-16`).
3. As an operator, I want to duplicate schedules and duplicate master presets, and save any refined schedule as a sanitized Preset blueprint, so that service structures can be reused seamlessly (`UC-14`, satisfying `FR-11`, `FR-20`).
4. As an operator, I want Slide 0 permanently pinned at the top of the timeline as the Rundown & Form Hub, so that pasting WhatsApp rundowns and filling weekly variables is the clear first step of my preparation (`UC-5`, satisfying `FR-21`, `FR-30`).
5. As an operator, I want standard presentation slides (Slide 1..N) to be canvas-first without rigid "Judul Agenda" and "Subtitle" form inputs, so that I have complete visual WYSIWYG freedom (`UC-11`, `UC-12`, satisfying `FR-32`).
6. As an operator, I want Master Song Sets and Announcements to support dynamic binding to Slide 0 with an explicit `Detach dari Master` action, so that I can adapt songs or announcements locally when last-minute worship changes occur (`UC-24`, satisfying `FR-20`, `FR-29`).
7. As an AV operator presenting live on stage, I want a toggleable multi-slide filmstrip grid alongside emergency blackout and clear text, so that I have instant visual random-access to any slide during live preaching and praise (`UC-11`, `UC-12`, satisfying `FR-32`).

---

## Tickets

- `SPEC-52-01`: Top Header Refactoring: Blank Schedule, Load Schedule, Copy Preset & Preset Lifecycle Management
- `SPEC-52-02`: Pinned Slide 0 "Rundown & Form Hub" Architecture & Canvas-First Slide Model
- `SPEC-52-03`: Master Song Sets & Announcements Variable Binding, Detachment & Canvas Template Layouts
- `SPEC-52-04`: Presentation Filmstrip Grid Parity, Edge-Case Auditing & Automated Smoke Regression Suite

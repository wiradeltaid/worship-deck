# 02: Pinned Slide 0 "Rundown & Form Hub" Architecture & Canvas-First Slide Model

**What to build:**
Reorganize the timeline structure and contextual editor around Slide 0 and canvas-first slides:
1. Pinned Slide 0 in Run Sheet Timeline:
   - Introduce a permanent, non-draggable root item at index 0 of the timeline:
     - Card Title: `Slide 0: Rundown & Formulir Ibadah` (accent pinned badge).
     - Non-reorderable (locked to top) and non-deletable.
     - Displays summary pill (e.g. `7 Item Slide • Rundown Terisi`).
     - Onboarding behavior: When creating a `[Jadwal Baru]`, the workspace immediately selects Slide 0 with focus on the raw rundown textarea.
2. Centralized Rundown & Predefined Form Hub (When Slide 0 is Selected):
   - When Slide 0 is active, the center panel displays the **Rundown Hub**:
     - **Primary Ingestion Card:** Full-width textarea for pasting raw WhatsApp/email rundowns, with `[⚡ Parse Rundown]` button that runs parser rules to populate/update timeline items.
     - **Central Predefined Fields Form:** Form grouping for all church weekly variables:
       - Sermon Speaker (`{sermon_speaker}`) & Sermon Title (`{sermon_title}`).
       - Scripture Reading (`{scripture_reference}`) with inline lookup.
       - Worship Leader (`{worship_leader}`).
       - Family of the Week (`{family_of_the_week}`).
       - Centralized Announcement Flyer Slots (previews and slot assignments for weekly flyers).
     - **Governance Boundary (Reconciled with DEC-004 & SRS-hub):**
       - Slide 0 administers weekly instance values and token hydrations for this specific schedule.
       - Master variable definitions, global schema rules, and system token invariants remain strictly governed in the Registry.
       - `[⚙️ Edit Tata Letak Form]` allows the operator to configure display ordering and visual grouping of fields within the active schedule view.
3. Elimination of Rigid Agenda Form Fields for General Slides:
   - For all standard presentation slides (Slide 1..N):
     - Remove the rigid `Judul Agenda` and `Keterangan / Subtitle` input boxes from the contextual editor.
     - Replace with a pure **Canvas-First** editing model:
       - Item title in the timeline naturally derives from slide content (first line of text or song name).
       - Direct visual editing of slide body, font family, typography size, text alignment, and background.
       - One-click insertion of Predefined Field tokens directly into the slide text body from a compact token palette.

**Satisfies:** UC-5, UC-14, FR-21, FR-30, FR-32

**Touches:** artifacts, services

**Blocked by:** SPEC-52-01

**Status:** closed

- [x] Pin permanent Slide 0 (`Rundown & Formulir Ibadah`) at index 0 in the timeline.
- [x] Implement central Rundown Hub with raw text parser and grouped predefined fields when Slide 0 is active.
- [x] Ensure default focus lands on Slide 0 rundown textarea upon `[Jadwal Baru]`.
- [x] Reconcile form layout configuration with DEC-004 boundary (instance grouping without mutating master catalog schema).
- [x] Eliminate `Judul Agenda` and `Subtitle` input boxes from Slide 1..N contextual editors.
- [x] Adopt canvas-first visual editing with token chip inserter for standard presentation slides.

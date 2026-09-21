# SPEC-48 — Unified Schedule Workspace UI/UX Visual Mockup & Interactive Prototype

> **Status:** closed  
> **Release:** unified-schedule-workspace-uiux-mockup  
> **Component:** hub  
> **Touches:** operator, spa  
> **Depends on:** SPEC-47  

## Problem Statement

Following the completion of SPEC-45, SPEC-46, and SPEC-47, strategic evaluation and market analysis recorded in the WDI ecosystem operations repository (`wiradeltaid/ops` under `research/wdi-ecosystem-strategy/worship-presenter-web/unified-schedule-roadmap/`) identified that Worship Presenter Web suffers from fundamental UI/UX friction:
1. **Siloed Navigation Fatigue:** Managing a service currently requires jumping across disconnected menus: `/services/new` for raw rundown, `/songs` for song sets, `/announcements` for flyers, `/media` for backgrounds, and `/admin` for layout configuration.
2. **Single Rigid Sequence:** Services are bound to a single global spine, making multi-preset worship (Sabbath, Vesper, Midweek Prayer, Special Service) and ad-hoc / non-preset slide creation cumbersome.
3. **Need for Visual Ground Truth Before Backend Coding:** Before investing ~7,250 lines of new backend and frontend code across future specs (SPEC-49 to SPEC-52), the maintainer requires a complete, hand-browsable visual mockup and interactive prototype deployed at `https://presenter-dev.bic.my.id/` (accessible via route `/new` within the operator shell). This prototype serves as a visual exploration of future UX for `UC-5`, `UC-11`, `UC-12`, and `UC-13`, showcasing the target look-and-feel, 3-panel layout, in-place editing drawers, live canvas preview, and presenter simulation without requiring database mutations.

## Solution

Build an interactive, high-fidelity visual UI/UX mockup in React/Vite integrated into the SPA:

1. **Workspace Shell & Preset Selector (`SPEC-48-01`):**
   - Mounted at route `/new` within `spa/src/App.tsx` under `OperatorShell` (accessible via authenticated operator session).
   - Top Header bar featuring:
     - Preset Selector dropdown (`Ibadah Sabat Pagi (Dewasa)`, `Ibadah Vesper Jumat`, `Ibadah Doa Rabu Malam`, `Kebaktian Khusus / Natal`, `Jadwal Bebas (Non-Preset)`);
     - Service Date picker with preset-aware defaults;
     - Status badge (`Draft`, `Siap Tayang`, `Live`);
     - Header Action Buttons: Quick Verse (`⚡ Ayat Cepat`), Live Presentation (`▶ Tayangkan`), PPTX Export (`⬇ Unduh PPTX`), and Sync Status indicator.
     - Note on prototype behavior: all header actions operate strictly on local React state with visual toasts; zero network API calls or database mutations.

2. **Run Sheet Timeline & In-Place Contextual Editor (`SPEC-48-02`):**
   - **Left Panel — Run Sheet Timeline:**
     - Reorderable item cards with status indicators (Lagu Buka, Doa Pembuka, Warta Jemaat, Khotbah, Ayat Firman, Doa Tutup);
     - Item type badges with distinct color-coding (Song, Scripture, Announcement, Sermon, Custom);
     - `+ Tambah Item` button with dropdown drawer (Lagu Baru, Warta Baru, Ayat Alkitab, Custom Slide).
   - **Center Panel — In-Place Item Editor:**
     - Contextual form that switches dynamically based on selected timeline item:
       - *Song Context:* Hymn title autocomplete mockup, active verses checkboxes (Bait 1, 2, 4), pitch/key transpose selector, and background picker.
       - *Announcement Context:* Single-row 4-slot flyer grid preview respecting Registry boundaries, with in-place upload simulation affordance and looping toggle.
       - *Sermon / Predefined Item Selected:* Predefined fields (Speaker, Title, Scripture Reference) with instant token preview.
     - In-Place Drawer / Modal simulation for adding a new song or uploading a flyer without leaving the workspace.

3. **Sticky Live Canvas Preview & Quick Tools Simulation (`SPEC-48-03`):**
   - **Right Panel — Sticky Live Canvas Preview:**
     - 16:9 canvas preview simulating real-time rendered slides of the currently active timeline item.
     - Slide filmstrip / thumbnail navigation (Slide 1 of 4, Next/Previous buttons, Black Screen `B` toggle preserving slide position).
   - **Quick Scripture Modal Simulation (`UC-13`):**
     - Interactive drawer/modal for searching and projecting instant Bible verses on-the-fly as temporary overlay without altering the permanent run sheet.
   - **Presenter Mode Visual Simulation (`UC-11`, `UC-12`):**
     - Split preview showing operator confidence display vs clean congregation projector output.

## User Stories

1. As an operator or maintainer, I want to navigate to `https://presenter-dev.bic.my.id/new` and interact with the complete 3-panel Unified Schedule Workspace, so that I can validate the look-and-feel, layout, and ergonomics before backend database code is written (visual exploration for `UC-5`).
2. As an operator, I want to click through different item types on the timeline (Song, Announcement, Sermon) and see the center editor and right canvas preview adapt instantly, so that I experience the seamless in-place editing workflow (visual exploration for `UC-5`).
3. As a church technician, I want to test the Quick Scripture lookup drawer and Presenter mode preview directly on the page, so that I can verify operational readiness for live Sunday worship (visual exploration for `UC-11`, `UC-12`, `UC-13`).

## Implementation Decisions

1. **Routing & Session Mount:**
   - Mount the visual mockup at route `/new` inside `spa/src/App.tsx` within `OperatorShell`.
   - Accessible to logged-in operators. Preserves existing `/services` and `/services/:id` intact; zero disruption to currently running services or database tables.
2. **Self-Contained Mockup State (Zero DB Mutations):**
   - Use React local state (`useState`, `useReducer`) seeded with rich realistic worship service fixtures (SDAH 123, 4 announcement flyers, Sermon on John 3:16).
   - Zero database mutations, zero WebSocket broadcasts; 100% focused on UI/UX fidelity and visual navigation.
3. **Theme & Design Tokens:**
   - Adhere to the existing Tailwind CSS dark/light theme, typography, and color tokens established in Worship Presenter Web.

## Testing & Verification Decisions

- **Visual Smoke Test (`tests/smoke-spec-48.test.mjs`):**
  - Verify route `/new` renders the 3-panel layout with element assertion `[data-testid="workspace-mockup"]`.
  - Verify clicking timeline items updates the center editor form context.
  - Verify clicking the preset dropdown displays all 5 presets.
  - Verify opening and closing in-place drawers (Quick Scripture, Add Item).
  - Register `test:smoke-spec-48` script in `package.json`.

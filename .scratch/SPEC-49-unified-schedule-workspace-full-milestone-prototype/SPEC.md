# SPEC-49 — Unified Schedule Workspace Full Milestone Prototype (In-Place Canvas Designer, Custom Slides, Duty Roster & Free Schedule)

> **Status:** closed  
> **Release:** unified-schedule-workspace-full-prototype  
> **Component:** hub  
> **Touches:** operator, spa  
> **Depends on:** SPEC-48  

## Problem Statement

Following the completion of SPEC-48 (which established the baseline 3-panel layout, run sheet timeline, and live canvas preview), the maintainer tested the `/new` prototype and instructed that `/new` must represent the complete, full-package visual exploration of the new application reflecting all milestone features documented in `ops/research/wdi-ecosystem-strategy/worship-presenter-web/unified-schedule-roadmap/`.

Before implementing ~7,250 lines of persistent backend Go SQLite migrations, offline desktop sync adapters, and database tables across future milestones, the maintainer requires an exhaustive, interactive front-end visual ground truth deployed at `/new`. 

The current prototype at `/new` has the following specific gaps:
1. **Read-Only Canvas Preview:** Panel 3 only displays a static/read-only slide rendering. There is no in-place workflow or modal drawer to visually customize slide layout, reposition text bounding boxes, adjust typography and colors, or pick background images.
2. **Missing Custom Slide (`custom_slide`):** The run sheet timeline only supports standard items (Song, Announcement, Scripture, Sermon, General). Operators cannot create ad-hoc custom slides with freeform multiline text, poems, quotes, or responsive readings.
3. **Rigid Schedule Behavior for Non-Preset:** Selecting "Jadwal Bebas (Non-Preset)" retains the rigid 8 Sabbath items instead of offering an empty slate where operators can build a customized liturgy from scratch.
4. **Missing Duty Roster Integration:** There is no integration with church personnel (`roster_people` and `service_duties`), requiring manual text typing for speakers/liturgists instead of selecting from a roster with instant predefined token preview.
5. **Disconnected Media Management:** Background assignment requires typing or hardcoded fixtures rather than an in-place media gallery drawer where operators can browse, search, and assign background images.

To fulfill the vision of `/new` as a true comprehensive visual prototype of the new application before backend database mutations are introduced, SPEC-49 delivers these missing workflows in full visual fidelity.

## Milestone Capability Coverage Matrix

| Milestone Feature | Status in `/new` | Evidence / Implementation Scope |
|---|:---:|---|
| **Workspace Shell & Preset Dropdown** | Inherited from SPEC-48 | Route `/new`, 5 preset options, date/time calculation, responsive 3-panel layout |
| **Run Sheet Timeline (8 Sabbath Items)** | Inherited from SPEC-48 | Reorderable timeline cards, color-coded badges, drag handles, add item dropdown |
| **Rundown Salin-Tempel & Auto-Parser** | Inherited from SPEC-48 | Tab "Teks Rundown Mentah", live parser, dynamic song suggestions |
| **Sticky 16:9 Canvas Preview & Filmstrip** | Inherited from SPEC-48 | 16:9 aspect ratio, slide filmstrip, previous/next, counter |
| **Quick Tools (Black Screen, Clear, Fullscreen)** | Inherited from SPEC-48 | B key black screen, C key clear text, fullscreen projector simulation |
| **Quick Scripture Lookup Modal (UC-13)** | Inherited from SPEC-48 | Instant verse search (TB2, KJV, BIS), overlay projection simulation |
| **Presenter Confidence Split Display (UC-11/12)** | Inherited from SPEC-48 | Operator split confidence monitor vs clean congregation view toggle |
| **In-Place Visual Canvas Designer Modal** | **Included in SPEC-49** | `MockupCanvasDesignerModal`: element bounding boxes, alignment, typography, colors, background |
| **Custom Slide (`custom_slide`) Item Type** | **Included in SPEC-49** | Timeline support, freeform multiline editor, custom badge, live canvas rendering |
| **Blank Slate Free Schedule Workflow** | **Included in SPEC-49** | Explicit clear timeline action for Non-Preset, empty state, `+ Tambah Item Pertama` |
| **Duty Roster Personnel Integration** | **Included in SPEC-49** | `MockupDutyRosterDrawer`: synthetic roster selection, instant `{sermon_speaker}` token hydration |
| **In-Place Media Gallery Asset Drawer** | **Included in SPEC-49** | `MockupMediaGalleryDrawer`: category filtering, asset preview, direct background assignment |
| **Persistent SQLite Schema Migrations** | Explicitly Deferred | Scheduled for post-prototype backend implementation (Fase 1/2 in roadmap) |
| **Offline Sync Schema Version Gate** | Explicitly Deferred | Scheduled for post-prototype backend sync implementation |
| **Permanent Duty Analytics & Archive** | Explicitly Deferred | Scheduled for post-prototype analytics phase (Fase 4 in roadmap) |

## Solution

Build and mount the complete suite of milestone workflows into the `/new` interactive prototype in `spa/src/pages/WorkspaceMockupPage.tsx` and `src/operator/workspace/`:

1. **In-Place Visual Canvas Designer Modal (`SPEC-49-01`):**
   - Provide "🎨 Ubah Tata Letak Kanvas" / "Buka Canvas Designer" triggers in the center contextual editor and the canvas preview header.
   - Open a modal drawer embedding an in-place visual designer:
     - Interactive visual preview of the slide elements (title, body/verse, subtitle, reference);
     - Bounding box alignment controls (Left, Center, Right, Top, Middle, Bottom);
     - Typography controls (font family selection, font size slider, line height, text color picker);
     - Background image selector with live preview update;
     - Explicit "Terapkan Perubahan" (saves to local state) and "Batal" (discards changes without updating preview).

2. **Custom Slide (`custom_slide`) Item Type & Blank Slate Free Schedule (`SPEC-49-02`):**
   - Add `🎨 Slide Bebas (Kanvas Kustom)` to the `+ Tambah Item` dropdown drawer.
   - Introduce `custom_slide` item type with customizable title, multiline content, custom subtitle, and dedicated canvas designer launch affordance.
   - Support true Blank Slate behavior when "Jadwal Bebas (Non-Preset)" is selected: prompt/toggle to clear the timeline and start from a clean slate where items can be added dynamically.

3. **Duty Roster Integration & Predefined Token Dynamic Binding (`SPEC-49-03`):**
   - In-place Duty Roster drawer in the workspace: select assigned personnel for sermon speaker, praise leader, scripture reader, and liturgist from a synthetic church roster fixture.
   - Strictly adhere to public repository rules by using fictional/synthetic identities (`Pdt. Yohanes Timotius (Sintetis)`, `Diaken Natanael Markus (Sintetis)`, `Sdr. Barnabas Lukas (Sintetis)`).
   - Instant token hydration: selecting a speaker updates the sermon card and live canvas token (`{sermon_speaker}`) instantly.
   - Quick "Tambah Pelayan Baru" in-place modal to register a new synthetic person to the roster without leaving the workspace.

4. **In-Place Media Gallery Asset Manager Drawer & End-to-End Smoke Tests (`SPEC-49-04`):**
   - In-place Media Gallery drawer: browse, search by category (Latar Belakang, Salib, Alam, Tekstur), preview high-resolution images, and assign directly to songs, custom slides, or general slides.
   - Upload simulation affordance with immediate gallery inclusion.
   - Comprehensive smoke test suite in `tests/smoke-spec-49.test.mjs` verifying all new milestone workflows with observable acceptance assertions.

## User Stories

1. As an operator, I want to click "Ubah Tata Letak Kanvas" on any slide and adjust text positioning, typography, and background in an in-place designer modal, so that I can explore visual presentation customization without leaving the schedule workspace (visual exploration for `UC-5`).
2. As a worship leader, I want to add a "Slide Bebas (Kanvas Kustom)" to the timeline with custom text and visual styling, so that I can present special announcements, quotes, or responsive readings (visual exploration for `UC-5`).
3. As a church secretary, I want to select "Jadwal Bebas (Non-Preset)" and build a service from a blank slate, so that I can assemble unique liturgies without deleting unwanted default items (visual exploration for `UC-5`).
4. As an operator, I want to select preachers and liturgists from a Duty Roster dropdown and have their names bind to slide tokens immediately, so that spelling errors are eliminated (visual exploration for `UC-5`).
5. As an operator, I want to browse the media gallery in an in-place drawer and pick background images for slides, so that visual assets can be reused effortlessly (visual exploration for `UC-5`).

## Implementation Decisions

1. **Self-Contained Local State Prototype (Zero DB Mutations):**
   - All new drawers (Canvas Designer, Duty Roster, Media Gallery) operate purely on local React state (`useState`, `useReducer`), ensuring rich interactivity with zero backend mutations or network side effects.
2. **Re-use Design Tokens:**
   - Adhere strictly to the existing Tailwind CSS tokens, dark/light themes, and Geist typography.
3. **Modular Component Architecture:**
   - Place new modular components in `src/operator/workspace/`:
     - `MockupCanvasDesignerModal.tsx`
     - `MockupDutyRosterDrawer.tsx`
     - `MockupMediaGalleryDrawer.tsx`

## Testing & Verification Decisions

- **Smoke Test Suite (`tests/smoke-spec-49.test.mjs`):**
  - Verify Canvas Designer opens, modifies element alignment/typography, and reflects in the live preview upon Apply, while Cancel discards edits.
  - Verify Custom Slide addition and Non-Preset blank slate clearing behavior.
  - Verify Duty Roster drawer selection updates sermon token.
  - Verify Media Gallery drawer opens, filters assets, and assigns background.
  - Register `test:smoke-spec-49` in `package.json`.

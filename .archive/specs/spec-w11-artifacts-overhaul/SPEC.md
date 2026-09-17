# SPEC — W11: Artifacts Overhaul (Main Spine, Song Sets, Announcement Sets)

## 1. Problem & Intent
The Artifact Registry deck composition and authoring surfaces currently suffer from:
1. Rigid single-slot placement: Song Sets and Announcement Sets cannot be inserted multiple times in the Main Spine due to 1:1 `spine_position` coupling and awkward marker cards.
2. Fragmented hierarchies in Song Sets (3 stacked forms) and Announcement Sets (nested list confusing slides with sets).
3. Canvas authoring friction: Text editing requires an external textarea, layer manipulation clutters sidebar panels, images render as gray placeholder boxes, and background changes cannot be triggered directly from the canvas.

Wave W11 delivers a unified overhaul across all three registry surfaces, matching the verified interactive prototype.

## 2. Tracer-Bullet Tickets
- **W11-01**: Backend Spine Model & Multiple Insertion (support multiple song set and announcement set placements in `artifact_templates`).
- **W11-02**: Canvas Core Modernization (`fabric.Textbox` inline editing, visual `FabricImage` rendering, direct Change Background).
- **W11-03**: Canvas Context Menu & Drag-to-Create (right-click z-index, duplicate, delete; drag area bounding box creation).
- **W11-04**: Main Spine UI Overhaul (New Slide dropdown-only placement, hover action controls, clone with numbered suffix, card-encapsulated rename).
- **W11-05**: Song Sets UI 2-Column Overhaul (auto-named New Song Set, hover delete, trio sub-layout switcher, 2/3 lyric guideline formula).
- **W11-06**: Announcement Sets UI 3-Tier Overhaul (Add Set, Set Dropdown selector, Slides in Set with hover actions, deprecation of marker card).

## 3. Architecture & Constraints
- AD-30: Go API remains the only always-on server; React SPA remains the UI.
- AD-31: Main spine is the authoritative sequence; song sets and announcement sets are dynamic references.
- AD-38: Direct inline canvas authoring, contextual right-click menu, and dedicated 2-column workspaces.

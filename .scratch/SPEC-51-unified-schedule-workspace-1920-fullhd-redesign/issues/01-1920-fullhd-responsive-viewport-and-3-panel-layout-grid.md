# 01: 1920 Full HD Responsive Viewport & 3-Panel Layout Grid Overhaul

**What to build:**
Re-architect the Unified Schedule Workspace root container and 3-panel layout grid with a primary design baseline of 1920px Full HD:
1. Workspace Viewport Baseline & Root Container:
   - Configure outer container with responsive tiers:
     - Root wrapper: `w-full max-w-[2560px] mx-auto px-4 2xl:px-8 py-3 flex flex-col gap-4`.
     - Target viewport: optimized for 1920×1080 display while gracefully scaling up to 2K/4K and adapting responsively on narrower screens (<1920px).
   - Viewport Height Constraint:
     - Dynamic viewport calculation: `h-[calc(100vh-175px)] min-h-[560px] 2xl:min-h-[700px] max-h-[1200px]`.
     - Ensure internal panel scrolling with custom subtle scrollbars, eliminating outer window double scrollbars on 1080p and 768p displays.
2. 3-Panel High-Density Proportion Restructuring:
   - **Left Panel (Run Sheet Timeline):**
     - Width allocation: `w-full lg:w-[320px] 2xl:w-[400px] shrink-0 h-full flex flex-col`.
     - Enhance timeline cards with explicit duration badges, hymn code tags (`SDAH 123 • Key D`), slide counts, and clear drag-and-drop indicator affordances.
   - **Center Panel (Contextual Editor):**
     - Fluid wide container: `flex-1 min-w-[450px] 2xl:min-w-[600px] max-w-[900px] h-full overflow-y-auto`.
     - Introduce dual-column layout for Song item editor: Left column for title, hymn number, key, background; Right column for verse selector pills and live lyrics text preview.
     - Optimize Announcement editor: visual thumbnail carousel strip with duration sliders and flyer upload dropzone.
     - Optimize Predefined Fields form: structured card layout with inline token syntax highlighting.
   - **Right Panel (Sticky Live Canvas Preview Container):**
     - Width allocation: `w-full lg:w-[440px] 2xl:w-[580px] shrink-0 h-full flex flex-col`.
     - Display expansive high-definition 16:9 canvas preview (~560px × 315px on 1920px, ~420px × 236px on <1920px) maintaining pristine aspect ratio.
     - Provide container anchor for quick projection tools and stage confidence switch (behavior governed in Ticket 03).
3. Sub-1280px Graceful Degradation:
   - On viewports < 1280px, layout gracefully reflows into a 2-column or tabbed stack with collapsible preview sheet, ensuring zero horizontal overflow or hidden buttons.

**Satisfies:** UC-5, UC-11, UC-12, FR-11, FR-32

**Touches:** operator, spa

**Blocked by:** none

**Status:** open

- [ ] Reconfigure root workspace container with 1920px Full HD baseline and adaptive viewport height (`h-[calc(100vh-175px)] min-h-[560px] 2xl:min-h-[700px]`).
- [ ] Restructure 3-panel grid with responsive proportions: Timeline (320px / 2xl:400px), fluid Editor (min-w 450px / 2xl:600-900px), and Canvas Preview (440px / 2xl:580px).
- [ ] Implement dual-column ergonomics for Song and Announcement contextual editors in the center panel.
- [ ] Implement sub-1280px responsive reflow preventing horizontal clipping.

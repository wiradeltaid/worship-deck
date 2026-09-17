# SPEC-17 — Artifacts Canvas Font Selector (45 Curated Fonts) & Two-Row Fixed Toolbar

## Problem Statement

The Artifacts canvas editor (`ArtifactEditor.tsx`) currently locks text elements to the default fallback font (`Arial`) with no font family picker interface. Furthermore, as features have expanded (color picker, size input, B/I/U toggles, alignments, line-height slider, text-shadow controls), the single-row properties toolbar (`h-11 min-h-[44px]`) has become congested. If a font picker is crammed into the same single line, controls overflow horizontally or wrap awkwardly on laptop viewports.

Moreover, operators and worship designers require a rich, curated palette of typography suitable for presentations, lyric projection, sermon titles, and PowerPoint export—spanning clean modern sans-serifs, dignified serifs, high-impact display headers, and elegant script/handwriting fonts, alongside universal system fonts that render natively across all PowerPoint installations.

Lastly, dynamically changing toolbar heights when switching between Text, Shape, Image, and None causes vertical layout shifts that push the canvas and deck sequence up and down. A locked, predictable two-row toolbar (`h-[88px] min-h-[88px] max-h-[88px]`) guarantees zero canvas jump regardless of selection state.

## Solution Architecture

1. **45-Font Curated Catalog (`src/lib/registry/font-catalog.ts`)**:
   - Establish a typed, grouped catalog of 45 high-utility presentation fonts:
     - **System Safe / PPTX Universal (10)**: Arial, Calibri, Aptos, Segoe UI, Verdana, Trebuchet MS, Tahoma, Georgia, Times New Roman, Garamond.
     - **Modern Sans-Serif (12)**: Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Nunito, Raleway, Oswald, Barlow Condensed, DM Sans, Work Sans.
     - **Dignified Serif (8)**: Merriweather, Playfair Display, Lora, Cinzel, Cormorant Garamond, PT Serif, EB Garamond, Baskervville.
     - **Bold Display & Title Impact (8)**: Bebas Neue, Anton, League Spartan, Righteous, Teko, Abril Fatface, Alfa Slab One, Russo One.
     - **Script & Handwriting (7)**: Great Vibes, Pacifico, Caveat, Dancing Script, Sacramento, Shadows Into Light, Satisfy.
   - Load web font stylesheets via Google Fonts with `display=swap` asynchronously in `spa/index.html` and `spa/projected.html`.
   - Export helper `getFontStack(fontFamily)` providing web-safe fallback chains for CSS rendering in `ArtifactSlide.tsx`.
   - Deduplicate `DEFAULT_FONT_FAMILY`: make `font-catalog.ts` the single source of truth, re-exported by `canvas-utils.ts` and `render-model.ts`.

2. **Fixed Height Two-Row Properties Toolbar (`h-[88px]` in `ArtifactEditor.tsx`)**:
   - Transform the element properties toolbar container into a fixed two-row panel:
     `rounded-lg bg-background border border-border text-xs h-[88px] min-h-[88px] max-h-[88px] p-2 flex flex-col justify-between shrink-0`.
   - **Row 1 (Primary Typography & Element Identity)**:
     - Element Kind Badge (`[TEXT]`, `[SHAPE]`, `[IMAGE]`, `[NONE]`).
     - Font Family Selector: grouped `<Select>` (`w-[180px] h-8 text-xs`) rendering all 5 categories with preview font-family styling (standard grouped shadcn select, not a searchable combobox).
     - Font Size input (`w-16 h-7 text-center`) + Font Color picker (`w-6 h-6`).
     - Bold, Italic, Underline buttons (`size="icon-sm"`).
     - Alignment buttons: Left, Center, Right (`size="icon-sm"`).
   - **Row 2 (Advanced Effects & Sliders)**:
     - Line Height button & slider (`0.8` to `2.4`).
     - Text Shadow toggle button & blur slider (`0` to `20`).
   - **State Containment (Non-Text Elements)**:
     - **Shape selected**: Row 1 renders Shape Fill color picker; Row 2 renders Shape properties indicator.
     - **Image selected**: Row 1 renders Image label and dimensions; Row 2 renders Object Fit (contain/cover) controls.
     - **None selected**: Row 1 renders *"Properties (None): Select element first"*; Row 2 renders keyboard shortcut hints (*"Tip: Del/Backspace to delete, Drag to move"*).
     - **Zero layout shift**: The toolbar height remains strictly 88px across all states, keeping the canvas position 100% stationary.

3. **Multi-Surface Synchronization & PPTX Export**:
   - `pptx-draw.ts`: `resolveFontFamily(style)` extracts the bare font family name (e.g. `'Inter'`, `'Montserrat'`) and assigns it to pptxgenjs `fontFace`.
   - `ArtifactSlide.tsx`: applies `fontFamily: getFontStack(element.style?.fontFamily)` for robust CSS fallback stacks in both web slideshow and projector views.
   - Server validator `validate_artifact.go` already permits `fontFamily` in `allowedStyleKeys`.

## Implementation Decisions

1. **Pre-work Baseline in Repo**:
   `src/lib/registry/font-catalog.ts` was seeded in commit `0add8e0`. Ticket `SPEC-17-01` completes the pre-work by wiring HTML `<link>` stylesheets in `spa/index.html` and `spa/projected.html`, deduplicating `DEFAULT_FONT_FAMILY` across `canvas-utils.ts` and `render-model.ts`, and adding unit test suite `tests/artifact-font-catalog.test.mjs`.
2. **Consolidated Web Font Loading**:
   Use a single consolidated Google Fonts CSS2 URL (`getGoogleFontsStylesheetUrl()`) with `display=swap` to avoid multiple render-blocking network roundtrips.
3. **Viewport & Grid Layout Stability**:
   Expanding the toolbar from 44px to 88px increases the right column by 44px. With `<aside>` configured as `lg:h-0 lg:min-h-full` (from commit `36dfb17`), the total column height is ~591px (58px header + 88px toolbar + 413px canvas + 32px padding/gap). Inside standard 1080p viewports (~920px usable window height), total page height remains ~750px, completely free of window scrollbars. Deck Sequence continues to stretch and align cleanly with the canvas bottom.
4. **TDD Old Assertion Replacement**:
   Test `SPEC-14-07 / BUG-25` in `tests/artifact-editor-layout.test.mjs` asserts `h-11 min-h-[44px] max-h-[44px]`. In Ticket `SPEC-17-02`, this assertion must be replaced with `h-[88px] min-h-[88px] max-h-[88px]` along with an absence guard for `h-11`, preventing test failures.

## Out of Scope

1. Custom TTF/OTF font file upload from local admin computer into registry database.
2. Dynamic server-side font subsetting engine.
3. Embedding raw binary font files into PPTX files (PowerPoint standard uses font name declarations mapped to OS font environments).
4. Searchable combobox input with arbitrary user typing (standard categorized `<Select>` with 5 optgroups provides curated safe choices).

## Tickets & Dependencies

- **SPEC-17-01**: 45-Font Catalog Embeds, Fallback Stacks, and Constant Deduplication. `blocked_by: []`.
- **SPEC-17-02**: Two-Row Fixed Toolbar (`h-[88px]`) with Font Family Grouped Dropdown in `ArtifactEditor.tsx`. `blocked_by: ["SPEC-17-01"]`.
- **SPEC-17-03**: PPTX Export & Projected Slideshow Font Synchronization with Automated Regressions Suite. `blocked_by: ["SPEC-17-02"]`.

## User Stories

1. As a Worship Leader/Admin, I want to choose from 45 popular presentation fonts across modern, serif, display, and script styles, so that our church slides match our visual theme.
2. As an Admin editing slides, I want the element properties toolbar to occupy a comfortable, fixed two-row layout that never jumps or shifts the canvas vertically when switching element selection.
3. As an Operator, I want exported PowerPoint decks to reflect the exact font family chosen in the canvas editor.

## Acceptance Criteria

1. Font family dropdown in `ArtifactEditor.tsx` contains 45 fonts grouped into 5 clear categories.
2. Changing font family immediately updates the active text element on the Fabric.js canvas in real-time.
3. The properties toolbar container maintains an exact fixed height `h-[88px] min-h-[88px] max-h-[88px]` across Text, Shape, Image, and None states with zero vertical canvas shift.
4. Exported PPTX presentations carry the selected font face.
5. All automated unit, layout, and regression tests pass without errors.

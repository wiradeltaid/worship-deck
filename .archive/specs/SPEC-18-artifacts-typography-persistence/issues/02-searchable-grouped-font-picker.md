# Ticket SPEC-18-02 — Searchable Grouped Font Family Selector with High-Contrast Headers

**Status:** ready-for-agent

## Description

Enhance the font family picker in `ArtifactEditor.tsx` with two key UX improvements:
1. High-contrast visual styling for the 5 category headers (`SelectLabel`) to provide clear visual boundaries between font styles.
2. An integrated search input filtering fonts in real time, while retaining category grouping (headers themselves are non-selectable and non-searchable).

## Requirements

1. **High-Contrast Category Headers**:
   - In `ArtifactEditor.tsx` font dropdown:
     Style category headers with distinct background and high contrast:
     ```tsx
     <SelectLabel className="bg-muted/90 px-2.5 py-1 text-foreground font-bold tracking-wide rounded-sm my-1 border-l-2 border-primary text-[11px] select-none">
       {FONT_CATEGORY_LABELS[category].en}
     </SelectLabel>
     ```
   - Ensure clear contrast in both light and dark themes.

2. **Searchable Font Dropdown / Popover**:
   - Implement an inline search input at the top of the font selection list:
     - Placeholder: `t('admin.artifacts.searchFonts')` (`"Search fonts..."` in EN, `"Cari font..."` in ID).
     - Add keys to `src/lib/i18n/keys.ts`, `catalogue-en.ts`, and `catalogue-id.ts`.
     - Value bound to local search state `fontSearchQuery`.
     - Key event handling: ensure typing in search input does not accidentally trigger Select typeahead or premature close (`e.stopPropagation()` on keydown/input as needed).
     - When the operator types a query (e.g. `"mon"`), dynamically filter the 45 fonts where `font.label.toLowerCase().includes(query)`.
     - Group filtered fonts under their respective categories. Only render category headers that have matching fonts.
     - When query is empty, render all 45 fonts under all 5 categories.
     - Selecting a font immediately calls `handleFontFamilyChange(family)`.

3. **Layout & Toolbar Stability**:
   - The properties toolbar container must remain strictly locked at `h-[88px] min-h-[88px] max-h-[88px]`.
   - The font trigger button width remains compact (`w-[180px] h-7 text-xs`).

4. **Automated Tests**:
   - Add tests in `tests/artifact-editor-layout.test.mjs` asserting presence of font search input and category header contrast styling.
   - Assert toolbar 88px height stability remains intact.

## Acceptance Criteria
- Category headers stand out distinctly with background color and border accents.
- Typing in the search input instantly filters the font list without breaking category headers.
- Selecting a filtered font updates the canvas text element immediately.

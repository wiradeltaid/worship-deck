# Ticket SPEC-19-01 — Searchable Font Dropdown Keyboard Isolation & Popper Positioning

**Status:** ready-for-agent

## Component
`registry` (`src/components/ui/select.tsx`, `src/components/admin/ArtifactEditor.tsx`)

## Dependencies
`blocked_by: []`

## Problem
During QA of SPEC-18-02 on `presenter-dev.bic.my.id`:
1. The search textfield inside the font family dropdown cannot be typed into (`textfield search font tidak bisa diketik`). Keystrokes are intercepted by Base UI Select's internal typeahead handler or focus is captured by options.
2. The dropdown popup renders far below the canvas instead of directly under the font family trigger button in the element properties toolbar.

## Baseline & Root Cause
1. Baseline: The search `<Input>` rendering, i18n keys (`admin.artifacts.searchFonts`), query state `fontSearchQuery`, and label filtering were introduced in SPEC-18-02.
2. In `src/components/ui/select.tsx`, `SelectContent` defaults to `alignItemWithTrigger = true`. Base UI aligns the selected item in the popup directly over the trigger button. When a font selected deep in the list (e.g. from the Display group) is active, Base UI offsets the entire popup downward across the screen below the canvas.
3. Base UI's `<SelectPrimitive.Popup>` captures keyboard and pointer events for typeahead navigation and modal focus. Typing in a child `<input>` fails because keystrokes are intercepted, Space triggers option selection, or clicking the input causes focus displacement unless event propagation (`keydown`, `keyup`, `pointerdown`) is thoroughly isolated.

## Requirements
1. Allow `SelectContent` in `src/components/ui/select.tsx` to pass through `alignItemWithTrigger={false}`, `side="bottom"`, `align="start"`, and `sideOffset={4}` to `SelectPrimitive.Positioner`.
2. In `ArtifactEditor.tsx`:
   - Pass `alignItemWithTrigger={false}`, `side="bottom"`, and `align="start"` to the font selector's `SelectContent`.
   - On the search input container, isolate pointer and keyboard events by stopping propagation for `onKeyDown`, `onKeyUp`, and `onPointerDown`.
   - Ensure the search input is focused immediately upon dropdown open without losing focus on click.
   - Retain search query reset on dropdown close (`onOpenChange`).

## Acceptance Criteria
- Font dropdown popup renders directly beneath the font selector button (`alignItemWithTrigger={false}`), even when the currently selected font is deep in the list (e.g. Display category).
- Operator can click and type any alphanumeric characters and spaces into the search box without triggering selection or closing the dropdown.
- The font list filters dynamically in real-time.
- Selecting a font applies it immediately to the canvas.
- Tests in `tests/artifact-editor-layout.test.mjs` assert that `alignItemWithTrigger={false}` is present on the font selector popup.

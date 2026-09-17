# Ticket SPEC-20-01 — Combobox Font Picker via Popover Primitive

**Status:** ready-for-agent

## Component
`registry` (`src/components/admin/ArtifactEditor.tsx`, `src/components/ui/popover.tsx`)

## Dependencies
`blocked_by: []`

## Problem
During QA of SPEC-19 on `presenter-dev.bic.my.id`:
1. When typing in the font family search field (e.g. typing "mont"), only the first character (e.g. "a", "l", "i") registers, or focus jumps immediately to the matching `<SelectItem>` in the list. Subsequent characters cannot be typed into the search box.
2. Root Cause: Base UI's `<SelectPrimitive.Popup>` and `<SelectPrimitive.List>` implement ARIA listbox typeahead behavior. When an alphanumeric key is pressed, Base UI intercepts the keypress natively to jump to options and immediately transfers focus to the focused `<SelectItem>`. Once focus leaves the input, subsequent typing lands on the select list instead of the search input. React's `e.stopPropagation()` does not stop Base UI's native capture listeners.

## Requirements
1. In `src/components/admin/ArtifactEditor.tsx`:
   - Replace the Base UI `<Select>` for Font Family with a combobox pattern based on `Popover` (`Popover`, `PopoverTrigger`, `PopoverContent` from `src/components/ui/popover.tsx`).
   - The trigger button must replicate the exact styling of a select trigger (`w-[180px] h-7 text-xs border border-input rounded-lg flex items-center justify-between px-2` with ChevronDown icon).
   - Display the current font label on the trigger button.
   - Configure `PopoverContent` with `side="bottom"`, `align="start"`, `sideOffset={4}`, and `className="max-h-72 w-[240px] p-0 flex flex-col overflow-hidden"`.
   - The search input inside `PopoverContent` must have full, uninterrupted keyboard focus (allowing spaces, backspaces, and continuous typing without focus theft or popover closure).
   - Filter fonts in real-time by label match against `fontSearchQuery` across categories (`system`, `sans`, `serif`, `display`, `script`).
   - Clicking any font item:
     - Calls `handleFontFamilyChange(f.family)`.
     - Closes the popover.
     - Resets or clears the search query upon popover close.
   - Ensure the search input auto-focuses when the popover opens.
2. In `tests/artifact-editor-layout.test.mjs`:
   - Refactor line 280: replace the assertion checking Base UI Select's `alignItemWithTrigger={false}` with checks asserting that `PopoverContent` configures `side="bottom"` and `align="start"` so the popup anchors neatly beneath the trigger.

## Acceptance Criteria
- Clicking the font selector opens the popover anchored directly beneath the trigger button.
- Typing in the search input allows full text input (including spacebar and backspace) without focus jumping or menu closing.
- Font list filters in real-time as characters are typed.
- Clicking a font in the list applies the font to the selected canvas element and closes the popover.
- Layout test in `tests/artifact-editor-layout.test.mjs` passes with updated Popover assertions.
- Automated tests in `tests/smoke-spec-20.test.mjs` verify popover combobox structure and event isolation.

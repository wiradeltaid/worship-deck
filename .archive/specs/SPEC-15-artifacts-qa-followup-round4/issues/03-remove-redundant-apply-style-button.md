# Ticket SPEC-15-03 — Remove Redundant "Apply Style" Button in Text Properties Toolbar (`BUG-28`)

**Status:** done

## Description

The text properties toolbar currently includes an "Apply Style" button (`ArtifactEditor.tsx:2602-2610` using translation key `admin.artifacts.applyStyle`).
All text properties (font family, font size, font color, bold, italic, underline, alignment, line-height, text shadow) now update the active Fabric canvas selection in real time as each input or button is manipulated.
An explicit "Apply" button is redundant, potentially confusing to operators who wonder if their real-time edits have taken effect, and unnecessarily occupies horizontal space in the fixed-height properties toolbar.

## Root Cause

`applyTextStyle` is called directly by the input handlers (e.g. `setFontSize`, `setFontColor`, `handleToggleBold`, `handleToggleItalic`, `handleToggleUnderline`, `handleSetAlign`, `handleLineHeightChange`, `handleToggleShadow`).
The trailing `<Button onClick={applyTextStyle}>Apply Style</Button>` is a leftover affordance from an earlier, non-realtime iteration of the editor.

## Proposed Solution

1. In `src/components/admin/ArtifactEditor.tsx`:
   - Remove the `<Button ... onClick={applyTextStyle}>` element from the properties toolbar.
   - Retain `applyTextStyle` as an internal helper if needed by other handlers, or streamline handlers that call it directly.
2. Verify that all 9 text property controls (font family, font size, color, bold, italic, underline, text align left/center/right, line height, and text shadow toggle + blur slider) continue to update the canvas selection immediately and save cleanly.

## Acceptance Criteria

- The "Apply Style" / "Apply Selection" button is absent from the text properties toolbar.
- Changing font family, font size, color, bold, italic, underline, alignment, line height, or text shadow immediately modifies the active selection on the canvas in real time.
- The properties toolbar maintains its stable `h-11 min-h-[44px] max-h-[44px]` height.
- Tests in `tests/artifact-editor-controls.test.mjs` verify the removal of the button and confirm real-time property application.

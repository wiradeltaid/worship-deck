# Issue 04 — Main Spine UI Overhaul

**Status:** done

## Summary
Satisfies UC-15 (FR-21, AD-38). Overhaul the Main Spine template list and slide details UI to match the verified prototype:
1. Region "New Slide" at top with full width: dropdown type selector (General, Song Sets, Announcement Sets) and "+ Add" button (no redundant shortcut pills).
2. Hover-only list actions: `[↑][↓][❐][🗑]` hidden by default, visible on row hover.
3. Clone button clones content with an auto-incremented `(Copy N)` label.
4. Drag-and-drop reordering for list items.
5. Slide name encapsulated in a Card region with consistent rename state machine (`[Rename][Reset]` ⇄ `[Cancel][Save]`).

## Implementation Details
- Update `src/components/admin/ArtifactEditor.tsx` template list rendering and rename header.
- Implement hover CSS / Tailwind classes for action buttons.
- Implement clone logic generating numbered copy label.

## Tests
- `tests/registry.test.mjs`
- `tests/sync-artifact-button.test.mjs`

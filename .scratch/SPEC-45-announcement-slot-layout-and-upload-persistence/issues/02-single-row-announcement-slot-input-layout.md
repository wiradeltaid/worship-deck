# 02: Single-Row Announcement Slot Input Layout

**What to build:**
Refactor the weekly announcement poster upload slots in both `CreateForm.tsx` and `EditForm.tsx` from a cramped 2-column grid (`sm:grid-cols-2`) into an orderly 1-item-per-row vertical layout, giving each poster slot ample width for file picking, link pasting, and thumbnail previewing.

**Blocked by:** 01 (Operator RunSheetPage Announcement Inserts Hydration Fix)

**Status:** closed

- [x] In `src/operator/CreateForm.tsx`, replace `<div className="grid gap-4 sm:grid-cols-2">` with a single-column layout (`space-y-4` or `flex flex-col gap-4`).
- [x] In `src/operator/EditForm.tsx`, replace `<div className="grid gap-4 sm:grid-cols-2">` with an identical single-column layout.
- [x] Preserve all slot labels (`Announcement Slot 1..4`), `data-slot` test attributes, and `ImageUploadField` event handlers.
- [x] Ensure responsive styling renders cleanly on both desktop and mobile viewports with no clipped controls or awkward horizontal squishing.
- [x] Human verification check: Inspect the form on a 1440px desktop, 1024px tablet, and 768px laptop screen. Verify that each slot extends across the card width with comfortable margins, controls remain unclipped, and no horizontal scroll is induced.

# 05: Dynamic Form Shell, In-Place Layout Customization, and Card Grouping Engine in React

**What to build:**
Refactor the service editor (`EditForm.tsx` and `CreateForm.tsx`) to enforce the fixed top shell layout (Rundown textarea on top-left, Live Slide Preview on top-right sticky panel) while dynamically rendering card groupings below, complete with specialized renderers for text, textarea, 3-column image fields (with preview, file/URL input, upload, and download), song sets, and announcement slots, an in-place "Kelola Layout Visual" / "Customize Layout" mode for administrators directly within the worship form view, and preserving frozen service layout snapshots and SPEC-45 announcement persistence.

**Blocked by:** SPEC-46-04

**Status:** done

- [x] Fetch form layout: for new services, fetch active layout from `GET /api/worship-form-layout`; for existing services, read the frozen snapshot from `service.layout_snapshot` (falling back to active layout if snapshot is absent).
- [x] Implement in-place **"Kelola Layout Visual" / "Customize Layout"** mode in `RunSheetPage.tsx`, `EditForm.tsx`, and `CreateForm.tsx` (gated to admin role):
  - Allows administrators to add groupings, reorder card groupings, add/remove slots, and trigger adaptive seeder directly in the live form context without navigating to separate settings menus.
- [x] Implement `DynamicFormBody` component that iterates over groupings and renders each as an individual `<Card>` with its assigned slots.
- [x] Implement specialized slot renderers:
  - `TextFieldRenderer`: renders `<Input>` with proportional visual width derived from `input_length` (`max-w-xs`, `max-w-md`, `w-full`) and enforces max character limit.
  - `TextAreaFieldRenderer`: renders `<Textarea>` with height derived from `initial_lines` (bounded 2..20 rows).
  - `ImageThreeColumnRenderer`: renders standardized 3-column layout:
    - Column 1: Image thumbnail preview.
    - Column 2: Choose file / paste image URL input.
    - Column 3: Upload button AND Download button (linking to the asset with download attribute).
  - `SongSetRowRenderer`: renders dynamic song set row with book selector, hymn number autocomplete, background selector, lyrics editor, and save-to-book button.
  - `AnnouncementSlotRenderer`: binds and renders single-row announcement slots (1..4) within any card grouping, formatted as full-width rows without `sm:grid-cols-2` to strictly uphold the SPEC-45 absence guard.
- [x] Explicitly pass and preserve `initialAnnouncementInserts` in `RunSheetPage.tsx` and `EditForm.tsx`, ensuring all 4 weekly upload slots round-trip without loss (SPEC-45 contract).
- [x] Implement non-destructive suggestion banners: when parsing a rundown, display an "Accept All" button and per-field accept badges for extracted text fields and song set assignments.
- [x] Ensure the fixed top invariants are preserved: Rundown Textarea stays fixed on top-left and Live Slide Preview stays fixed and sticky on top-right.
- [x] Add React component unit tests verifying dynamic card rendering, field value updates, in-place layout customization toggle, suggestion acceptance, and snapshot-based layout retrieval.

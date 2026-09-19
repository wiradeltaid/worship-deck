# 06: Admin Layout Builder, Predefined Fields Management, and Regression Guards

**What to build:**
Implement admin management interfaces under Settings for configuring card groupings, predefined fields, song set extraction regexes, and layout ordering; provide an interactive regex testing sandbox and an adaptive seeder button; and add comprehensive end-to-end smoke tests and absence guards with proof-of-failure verification ensuring zero regressions across legacy services, slide previews, and presentation deck generation.

**Blocked by:** SPEC-46-05

**Status:** done

- [x] Build Admin Layout Builder (`/admin/form-layout`):
  - Interface to create, edit, reorder, and delete card groupings via admin mutation APIs.
  - Interface to add, remove, and reorder slots within each grouping (predefined fields, song set entries, announcement slots).
- [x] Build Admin Predefined Fields Management (`/admin/predefined-fields`):
  - Interface to create and edit predefined fields (`shown_text`, immutable `variable_name`, `field_type`, `input_length`, `initial_lines`, `extraction_regex`). Form validation disallows regex when `field_type = 'image'`.
  - Interactive regex testing sandbox: paste sample rundown text and preview token matches in real time.
  - Action button "Seed Default Predefined Field" triggering the adaptive seeder and displaying an informative gap-filling report (`{ inserted, skipped, inactive_skipped }`).
- [x] Interface to configure per-entry extraction regexes for song set entries in `/admin/song-sets` or within the grouping slot manager.
- [x] Author comprehensive regression smoke tests and absence guards in `tests/smoke-spec-46.test.mjs` verifying:
  - Top-left rundown and top-right live preview invariants are strictly enforced in both create and edit forms.
  - In-place "Kelola Layout Visual" mode is accessible in worship new/edit for admins.
  - Zero regression on existing services: legacy services with historical snapshots generate 100% identical slide plan outputs.
  - End-to-end lifecycle: creating custom field -> regex extraction from rundown -> form persistence -> dynamic token hydration in live slide preview and presentation deck.
  - Prove absence guards by injecting the defects (e.g. hardcoded cards reappearing or arbitrary token crashing plan), observing RED, and reverting to GREEN.
- [x] Register `tests/smoke-spec-46.test.mjs` in `package.json` under `npm test`.

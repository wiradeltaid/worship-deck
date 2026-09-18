# 06: Announcement Weekly Image Placeholders and Afternoon Text Removal

**What to build:**
Remove the obsolete `afternoonProgram` text field across forms, schemas, and catalogs with backward-compatible migration, introduce up to 4 weekly announcement image upload slots in worship services, and implement a placeholder slide mechanism in announcement sets that dynamically renders an uploaded weekly image or omits the slide if no image is uploaded.

**Blocked by:** 04 (Worship Service Song Set Single-Row Input Layout)

**Status:** ready-for-agent

- [ ] Remove `afternoonProgram` text field from `WorshipFormFields`, `EditForm.tsx`, `CreateForm.tsx`, parser, and database mappings, ensuring pre-existing `services.afternoon_program` DB rows are read without errors and obsolete i18n keys are pruned.
- [ ] Provide 4 weekly announcement image upload slots (`announcementInserts` in `images_payload`) in the worship service editor.
- [ ] Announcement slide authoring in `announcement_set_slides` and `AnnouncementSetsPanel` supports designating a slide as a weekly placeholder bound to Slot 1 through 4.
- [ ] In `slide-plan.ts` (TypeScript) and Go plan builder, placeholder slides are evaluated against the service's `announcementInserts`: if the bound slot contains a valid image URL, the slide is rendered with that image background; if empty, whitespace, or missing, the slide is omitted from the plan.
- [ ] Executable Absence Guard: Prove test failure when an empty placeholder slide is injected into the plan output, verified by breaking the omission rule and reverting.
- [ ] Placeholder slides can be reused across multiple announcement sets (e.g. Break Announcements and Closing Announcements) and resolve the same weekly image upload.

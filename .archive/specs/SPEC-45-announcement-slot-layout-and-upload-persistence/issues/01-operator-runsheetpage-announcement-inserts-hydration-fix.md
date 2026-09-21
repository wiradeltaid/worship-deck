# 01: Operator RunSheetPage Announcement Inserts Hydration Fix

**What to build:**
Fix announcement poster upload persistence by passing `initialAnnouncementInserts` from `images_payload` into `EditForm` within `RunSheetPage.tsx`, preventing uploaded weekly announcement images from being dropped on page load or erased on subsequent service saves.

**Blocked by:** none

**Status:** closed

- [x] In `spa/src/pages/RunSheetPage.tsx`, extract `announcementInserts` from `svc.images_payload` and pass it to `<EditForm initialAnnouncementInserts={...} />`.
- [x] Ensure proper array type coercion so that null, undefined, or malformed entries safely fall back to an empty array (`Array.isArray(images.announcementInserts) ? images.announcementInserts : []`).
- [x] Verify that opening an existing service with uploaded announcement posters correctly displays all 4 poster preview cards and values.
- [x] Verify that saving from `EditForm` retains existing poster URLs in `PUT /api/services/{id}` without overwriting them with empty strings.
- [x] Human verification check: Open an existing service with announcement posters uploaded, verify that all 4 cards show their corresponding images or empty slots as configured, make an unrelated edit (e.g. sermon title), save, reload, and verify that all posters persist intact.

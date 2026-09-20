# 01: Top Application Header Navigation Labeling & Chrome Parity

**What to build:**
Update the navigation link in the top application header to clearly indicate the unified workspace prototype:
1. Header Navigation Label Update:
   - In `src/components/Header.tsx`, locate the top navigation item pointing to `/new`.
   - Change the button text from `Workspace` to `New Workspace Mockup`.
   - Maintain active route highlighting (`pathname === '/new'`), accessibility attributes (`aria-current`), and responsive mobile wrapping.
2. i18n and Global Chrome Alignment:
   - Audit `src/lib/i18n/` to ensure consistency in navigation definitions where applicable.
   - Verify that all breadcrumbs and header elements maintain visual balance on 1080p and 720p screens without horizontal overflow.

**Satisfies:** UC-5, FR-11

**Touches:** services

**Blocked by:** []

**Status:** open

- [ ] Update `/new` navigation link text in `src/components/Header.tsx` to `New Workspace Mockup`.
- [ ] Verify active route styling and responsive layout for mobile and desktop viewports.
- [ ] Confirm link resolves seamlessly to `/new` without console errors.

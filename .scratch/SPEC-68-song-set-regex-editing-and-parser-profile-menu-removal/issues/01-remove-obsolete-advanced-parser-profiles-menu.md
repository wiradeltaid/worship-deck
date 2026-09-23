# 01: Remove obsolete Advanced Parser Profiles menu from Card Groupings and Layout

**What to build:** In the Card Groupings & Layout administration panel (`src/components/admin/FormLayoutAdminPanel.tsx`), an obsolete "Advanced Parser Profiles" tab button and embedded sub-view remain visible. Following the consolidation of service intake onto dynamic predefined field and song set regexes, user-facing administration of macro parser profiles is retired from daily workflows. Strictly remove the tab button and embedded sub-view from the layout admin panel while leaving backend profile storage and endpoints untouched. Replace outdated positive assertions with an executable absence guard verified by defect injection.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Read `src/components/admin/FormLayoutAdminPanel.tsx` in full first.
- [ ] Remove the `'profiles'` tab identifier from `type AdminTab` state type definition.
- [ ] Remove the Tab 4 "Advanced Parser Profiles" button from the sub-tabs header.
- [ ] Remove the conditional view block rendering `<ParserProfilesPanel />` when `activeTab === 'profiles'`.
- [ ] Clean up unused `Sliders` icon and `ParserProfilesPanel` import in `FormLayoutAdminPanel.tsx`.
- [ ] Ensure backend endpoints (`/api/parser-profiles`) and database storage remain untouched for background date and legacy slide-plan generation.
- [ ] Replace the outdated positive assertion in `tests/smoke-spec-54.test.mjs` with an executable absence guard:
      (1) Assert `FormLayoutAdminPanel.tsx` source does NOT include `activeTab === 'profiles'` or `<ParserProfilesPanel`.
      (2) Prove the absence guard by defect injection: temporarily restore the reference, verify the test goes RED, then revert to GREEN.
- [ ] Verify the remaining three tabs (Card Groupings & Layout, Predefined Fields & Regex, Rundown Test Area & Sandbox) render and function smoothly.

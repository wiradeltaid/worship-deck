# 05: Admin UI: Parsing Profile Builder and Live Sandbox

**What to build:**
Deliver an interactive administration interface in Settings (`/admin/parsing`) featuring a structured rule builder for common synonyms/separators, an Advanced Regex tab with validation, and a sticky live sandbox for instant verification against sample rundown text.

**Blocked by:** 04 (Dynamic Song Sets 3-Pass Matching and Slot Omission)

**Status:** ready-for-agent

- [ ] Create `ParserProfilesPanel.tsx` in `src/components/admin/` with profile list, clone, rename, export, import, and set-as-default actions.
- [ ] Build split-pane layout: Left pane hosts the Rule Editor (tabs for Preprocess, Sections, Song Numbering, and Field Rules); Right pane hosts the Live Testing Sandbox.
- [ ] Structured rule form supports configuring label synonyms, separators (`:`, `-`), and target field bindings without manual regex authoring for 80% common cases.
- [ ] Advanced tab allows direct regex pattern editing with named capture group syntax, accompanied by instant pattern validation and ReDoS / unsupported syntax linting on blur/save.
- [ ] Live Sandbox provides sample text textarea and renders live extracted token chips with tone badges, song set matching previews, and highlighted unmapped line warnings.
- [ ] All UI strings are properly localized in `keys.ts`, `catalogue-en.ts`, and `catalogue-id.ts`.

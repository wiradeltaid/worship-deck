# Issue SPEC-54-03 — Card Grouping Regex Integration, Live Rundown Test Area, and AJAX Smoothness

**Status:** ready-for-agent  
**Spec:** SPEC-54  
**Component:** hub  
**Satisfies:** [UC-2, UC-5, FR-11, FR-32]  
**Blocked by:** [SPEC-54-02]  
**Touches:** [artifacts, services]  

## Description

Integrate predefined field extraction regexes and an executable production-parity Rundown Parsing Test Area directly into `Card Groupings & Layout`, nest advanced parser profiles under an accessible sub-view, retire the redundant top-level `Rundown Parsing` tab in `RegistryAdmin.tsx`, and make all layout card and slot operations smooth via optimistic AJAX with error rollback.

## Key Changes

1. **Integrated Regex Configuration in `FormLayoutAdminPanel.tsx`:**
   - Display and allow inline editing of `extraction_regex` directly within the Predefined Fields and Card Slots section in `FormLayoutAdminPanel.tsx`.
   - Provide clear visual indicators for which fields have active extraction patterns.

2. **Executable Production-Parity Rundown Parsing Test Area:**
   - Add an integrated `Rundown Test Area` card with a Textarea and a `Test Parsing` action directly inside `FormLayoutAdminPanel.tsx`.
   - Parsing Engine Contract: The test area executes the exact same parsing rules and engine as production (`parseRundownWithProfile` from `src/lib/parser-rules.ts` and `matchSongSets` from `src/lib/song-set-matching.ts`).
   - Deterministic Result Schema:
     - Predefined Fields Extraction Table: lists all predefined fields in the active layout, showing field label, variable name, extracted value, and status (`matched` / `empty regex` / `unmatched`).
     - Song Set Extraction Table: lists active song set entries, showing slot variable, matched song title, number, book code, match kind (`label` / `positional`), and status (`matched` / `unfilled`).
     - Unmapped Lines Alert: displays any bulletin lines containing unparsed text or unrecognized hymns.

3. **Navigation Consolidation & Parser Profiles Disposition:**
   - In `src/components/admin/RegistryAdmin.tsx`, remove the top-level `Rundown Parsing` tab from the primary tab bar.
   - Retain full access to parser profiles by embedding `ParserProfilesPanel` as an `Advanced Parser Profiles` sub-view/drawer inside `Layout & Fields`, ensuring parser profiles remain completely manageable without top-level navigation clutter.

4. **Smooth Optimistic AJAX Interactions with Rollback:**
   - In `FormLayoutAdminPanel.tsx`, eliminate `setLoading(true)` on `handleMoveGrouping`, `handleMoveSlot`, `handleTransferSlot`, `handleDeleteGrouping`, and `handleAddSlot`.
   - Apply optimistic in-place state updates so cards and slots immediately animate to their new positions.
   - Run API persistence calls asynchronously in the background. If a network or server error occurs, display an actionable error toast and roll back state to the pre-mutation snapshot.

## Verification & Tests

- **Sandbox Parity Test:**
  - Verify that the Rundown Test Area correctly identifies matched fields, unmatched slots, and song set suggestions against identical fixtures used by the Go and TypeScript parsing engines.
- **Navigation & Sub-view Test:**
  - Verify that `RegistryAdmin.tsx` does NOT render the top-level `parsing` tab, and renders `ParserProfilesPanel` under the `Layout & Fields` advanced section.
- **Optimistic UI & Rollback Test:**
  - Unit test verifying that moving cards up/down does not trigger full-panel `loading` state, and properly restores previous card ordering on simulated API failure.

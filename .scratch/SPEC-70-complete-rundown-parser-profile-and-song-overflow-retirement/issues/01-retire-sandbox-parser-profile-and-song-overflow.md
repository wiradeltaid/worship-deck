# 01: Retire sandbox parser profile dependency and song overflow diagnostic banner

**What to build:** In `src/components/admin/FormLayoutAdminPanel.tsx` (the "Rundown Test Area & Sandbox" tab on `/admin/layout`), the test runner still fetches `GET /api/parser-profiles` to obtain `defaultProfile` and executes legacy `parseRundownWithProfile` and `matchSongSets`. When hymns in the rundown sample exceed legacy slot heuristics, it displays an alarming amber warning box: `Lagu Melebihi Slot (Overflow Songs)`. Update `FormLayoutAdminPanel.tsx` to completely remove `defaultProfile` state, eliminate `/api/parser-profiles` fetching, and evaluate song suggestions directly against configured `songSetEntries`' `extraction_regex` (parity with intake dynamic extraction). Define clear `unmappedLines` semantics where any line matching a predefined field, song set regex, or date/section pattern is mapped. Remove `overflowSongs` from state and remove the `Lagu Melebihi Slot` warning box. Additionally, delete the orphaned, unreferenced component `ParserProfilesPanel.tsx`. Add an exhaustive absence-guard mutation matrix in smoke tests and prove each guard via defect injection.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `src/components/admin/FormLayoutAdminPanel.tsx` in full.
- [x] In `src/components/admin/FormLayoutAdminPanel.tsx`:
      (1) Remove `defaultProfile` state (`const [defaultProfile, setDefaultProfile] = useState<any>(null)`).
      (2) Remove `fetch('/api/parser-profiles')` from `fetchLayout` and related state setters.
      (3) In `handleRunRundownTest`:
          - Replace calls to `parseRundownWithProfile` and `matchSongSets` with dynamic regex evaluation directly iterating `songSetEntries`.
          - For each entry with an `extraction_regex`, test the rundown lines, extracting hymn number and book code if matched.
          - Set `testResults.songs` status to `matched` or `unfilled` accordingly.
          - Track mapped line indices: mark lines matching any active Predefined Field, any active Song Set Entry, or date/section delimiters as mapped.
          - Output only truly unmapped lines into `testResults.unmappedLines`.
      (4) Remove `overflowSongs` property from `testResults` interface and state.
      (5) In the JSX render tree, remove the `<AlertTriangle /> Lagu Melebihi Slot (Overflow Songs):` warning block and its list items. Keep `unmappedLines` diagnostic helper intact.
- [x] Delete `ParserProfilesPanel.tsx`.
- [x] Add executable absence-guard mutation matrix in smoke tests:
      (1) Assert `FormLayoutAdminPanel.tsx` does NOT contain `Lagu Melebihi Slot`.
      (2) Assert `FormLayoutAdminPanel.tsx` does NOT contain `overflowSongs`.
      (3) Assert `FormLayoutAdminPanel.tsx` does NOT contain `/api/parser-profiles`.
      (4) Assert `ParserProfilesPanel.tsx` does not exist on disk.
      (5) Prove every absence guard via independent defect injection: temporarily re-introduce the strings / recreate file, assert the test fails RED, then restore clean state.
- [x] Add a regression test fixture with the user's reported bulletin lines (including SDAH #614, #316, #508, #671, #684, #476):
      (1) Assert matching song set slots populate with their corresponding hymn numbers.
      (2) Assert zero overflow warnings are emitted.
      (3) Assert non-matching lines populate into `unmappedLines`.

# Test Plan — SPEC-16 (Artifacts QA Follow-up Round 5)

## Overview

This test plan defines the automated test verification and TDD assertions for **SPEC-16** (mandate `DEC-018`).
It provides concrete, runnable test specifications for `wdi-autopilot` to follow test-first in a separate session without ambiguity or brittle regex pitfalls.

---

## Ticket SPEC-16-01: Deck Sequence Desktop Height Containment (`BUG-11` residual)

### Test Target
`src/components/admin/ArtifactEditor.tsx`

### Test Suite
`tests/artifact-editor-layout.test.mjs`

### Critical Instruction: Replace (Do Not Supplement) Existing Assertion
In `tests/artifact-editor-layout.test.mjs` (lines 63–66), there is currently an existing positive assertion from SPEC-15-02 that actively checks for `lg:max-h-none`:
```javascript
assert.ok(
  asideBlock.includes('flex flex-col flex-1 min-h-[220px] max-h-[calc(100vh-380px)] lg:max-h-none'),
  'Deck Sequence card inside aside must carry flex flex-col flex-1 min-h-[220px] max-h-[calc(100vh-380px)] lg:max-h-none'
);
```
**This assertion MUST BE REPLACED.** If an autopilot run merely adds an absence guard without replacing this string, the test suite will fail.

### Exact Test Assertions to Implement:

1. **Bounded Desktop Max-Height Assertion (Replacing Old Assertion)**:
   ```javascript
   assert.ok(
     asideBlock.includes('flex flex-col flex-1 min-h-[220px] max-h-[calc(100vh-380px)] lg:max-h-[calc(100vh-270px)]'),
     'Deck Sequence card inside aside must carry bounded desktop height lg:max-h-[calc(100vh-270px)]'
   );
   ```

2. **Absence Guard for Unconstrained Desktop Expansion (`lg:max-h-none`)**:
   ```javascript
   assert.ok(
     !asideBlock.includes('lg:max-h-none'),
     'Deck Sequence card must NOT carry lg:max-h-none, which causes indefinite expansion and page scrolling on desktop'
   );
   ```

3. **Internal Scrollability Preservation**:
   ```javascript
   assert.ok(
     code.includes('overflow-y-auto pr-1 flex-1 min-h-0'),
     'Deck sequence ul must retain flex-1 min-h-0 overflow-y-auto for internal card scrolling'
   );
   ```

4. **Negative Guard Proof**:
   ```javascript
   test('guard proof: lg:max-h-none presence fails unconstrained desktop absence-guard', () => {
     const defectiveCode = '<aside><div className="flex flex-col flex-1 min-h-[220px] max-h-[calc(100vh-380px)] lg:max-h-none"></div></aside>';
     assert.throws(() => {
       assert.ok(
         !defectiveCode.includes('lg:max-h-none'),
         'Deck Sequence card must NOT carry lg:max-h-none'
       );
     }, /Deck Sequence card must NOT carry lg:max-h-none/);
   });
   ```

---

## Ticket SPEC-16-02: Song Set Top Card Edit Header Compactness (`BUG-30`)

### Test Target
- `src/components/admin/SongSetEntriesPanel.tsx`
- `src/lib/i18n/catalogue-en.ts`
- `src/lib/i18n/catalogue-id.ts`

### Test Suite
`tests/operator-shadcn-guard.test.mjs`

### Robust Structural Slice Assertions (No Fragile Single-Line Regex):
The badge in `SongSetEntriesPanel.tsx` uses a multi-line template literal `className={`...`}`. Single-line regex expecting `className="..."` will fail. Instead, use structural slicing of the top card header:

1. **i18n Dictionary Assertions via `fs.readFileSync`**:
   ```javascript
   const catEnPath = path.join(ROOT, 'src', 'lib', 'i18n', 'catalogue-en.ts');
   const catIdPath = path.join(ROOT, 'src', 'lib', 'i18n', 'catalogue-id.ts');
   const enSource = readFileSync(catEnPath, 'utf8');
   const idSource = readFileSync(catIdPath, 'utf8');

   assert.ok(
     enSource.includes("'admin.songSets.editTitle': 'Edit Song Set'"),
     'catalogue-en must define concise Edit Song Set title'
   );
   assert.ok(
     idSource.includes("'admin.songSets.editTitle': 'Edit Set Lagu'"),
     'catalogue-id must translate editTitle to Indonesian Edit Set Lagu (fixing pre-existing untranslated text)'
   );
   assert.ok(
     !enSource.includes("'admin.songSets.editTitle': 'Edit Song Set: {title}'"),
     'catalogue-en must not include {title} placeholder'
   );
   assert.ok(
     !idSource.includes("'admin.songSets.editTitle': 'Edit Song Set: {title}'"),
     'catalogue-id must not include {title} placeholder'
   );
   ```

2. **Top Card Header Structural Containment**:
   ```javascript
   const panelPath = path.join(ROOT, 'src', 'components', 'admin', 'SongSetEntriesPanel.tsx');
   const code = readFileSync(panelPath, 'utf8');

   const topCardHeaderStart = code.indexOf('{/* New / Edit Song Set creation/edit panel');
   assert.ok(topCardHeaderStart !== -1, 'Must find top card header section');
   const topCardHeaderEnd = code.indexOf('{editingVarName ? (', topCardHeaderStart);
   assert.ok(topCardHeaderEnd !== -1, 'Must find start of edit form inputs');
   const topCardHeader = code.slice(topCardHeaderStart, topCardHeaderEnd);

   assert.ok(
     topCardHeader.includes('truncate') && topCardHeader.includes('min-w-0'),
     'Top form card header title span must carry truncate and min-w-0 to prevent multi-line wrapping'
   );
   assert.ok(
     topCardHeader.includes('shrink-0'),
     'Top form card badge must carry shrink-0 to prevent being compressed or wrapped'
   );
   assert.ok(
     !topCardHeader.includes(".replace('{title}'"),
     'Top form card title must not interpolate dynamic {title} string'
   );
   ```

3. **Negative Guard Proof**:
   ```javascript
   test('guard proof: header {title} interpolation fails absence-guard', () => {
     const defectiveCode = '{editingVarName ? t("admin.songSets.editTitle").replace("{title}", editingEntry?.title ?? "") : t("admin.songSets.createTitle")}';
     assert.throws(() => {
       assert.ok(
         !defectiveCode.includes(".replace('{title}'") && !defectiveCode.includes('.replace("{title}"'),
         'Top form card title must not interpolate dynamic {title} string'
       );
     }, /Top form card title must not interpolate dynamic \{title\} string/);
   });
   ```

---

## Execution Readiness Checklist for `wdi-autopilot`

- [x] Defect records logged in `.control/registry/defects.yaml` (`BUG-11` reopened, `BUG-30` created).
- [x] Mandate recorded in `.control/decisions/DEC-018-autopilot-mandate-artifacts-qa-followup-round5.md`.
- [x] Decision registered in `.control/registry/decisions.yaml` (`DEC-018`).
- [x] Spec folder created at `.scratch/SPEC-16-artifacts-qa-followup-round5/` with `SPEC.md`, `01-deck-sequence-desktop-canvas-bottom-containment.md`, and `02-song-set-top-card-edit-title-compact.md`.
- [x] Spec registered in `.control/registry/specs.yaml` (`SPEC-16` with independent unblocked tickets).
- [x] Test plan updated with explicit test replacement instructions, robust structural slice assertions, and absence proof guards.
- [x] Zero code changes committed to `src/`, `spa/`, `cmd/`, or `internal/` in this planning session.

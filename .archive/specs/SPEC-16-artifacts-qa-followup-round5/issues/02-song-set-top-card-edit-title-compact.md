# Ticket SPEC-16-02 — Song Set Top Form Card Compact Header Without Wrapping (`BUG-30`)

**Status:** ready

## Description

In SPEC-15-04, editing song set entries was moved from expanding list items into the top form card.
However, in manual QA Round 5, an issue was discovered when editing song sets with long names:
In `SongSetEntriesPanel.tsx`, the card header renders:
```tsx
{editingVarName
  ? t('admin.songSets.editTitle').replace('{title}', editingEntry?.title ?? '')
  : t('admin.songSets.createTitle')}
```
where `admin.songSets.editTitle` is `'Edit Song Set: {title}'` (EN) and `'Edit Song Set: {title}'` (ID).
When editing a song set with a long title like `Bible Talk Opening Song`, the resulting string `Edit Song Set: Bible Talk Opening Song` is 37 characters long.
Inside the 330px sidebar column, with the card's `p-3.5` padding and the `EDITING` badge (`text-[10px] ... px-1.5 py-0.5`) on the right side of the flex header, this long text wraps across 2 or 3 lines.
This multi-line wrapping expands the height of the top card (from ~132px up to ~160px+), shifting the entire "Configured Song Sets" list downwards when the edit icon is clicked.

## Root Cause & Pre-Existing Defects

1. **Header Text Length**: The header text appends the full dynamic `{title}` string (`Edit Song Set: {title}`), which is redundant because the full title is already displayed and editable in the large text input box directly below it.
2. **Missing Truncation & Shrink Containment**: The header `<span>` lacks `truncate min-w-0` and the badge lacks `shrink-0`, allowing the header text to wrap into multiple lines inside a flex container.
3. **Pre-Existing i18n Defect in `catalogue-id.ts`**: In `src/lib/i18n/catalogue-id.ts` (line 465), `admin.songSets.editTitle` is currently left in English (`'Edit Song Set: {title}'`). It has two defects simultaneously: it still contains `{title}` and is not translated into Indonesian (`'Edit Set Lagu'`).

## Proposed Solution

1. **Update i18n Dictionaries**:
   - In `src/lib/i18n/catalogue-en.ts`:
     Change `'admin.songSets.editTitle': 'Edit Song Set: {title}'` to:
     ```typescript
     'admin.songSets.editTitle': 'Edit Song Set',
     ```
   - In `src/lib/i18n/catalogue-id.ts`:
     Change `'admin.songSets.editTitle': 'Edit Song Set: {title}'` to:
     ```typescript
     'admin.songSets.editTitle': 'Edit Set Lagu',
     ```

2. **Update Component in `src/components/admin/SongSetEntriesPanel.tsx`**:
   - Remove `.replace('{title}', ...)` from the header rendering:
     ```tsx
     <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground truncate min-w-0 mr-2">
       {editingVarName
         ? t('admin.songSets.editTitle')
         : t('admin.songSets.createTitle')}
     </span>
     ```
   - Add `shrink-0` to the badge `<span>` (which uses a template literal for conditional classes, preserving existing `text-amber-600 dark:text-amber-400` styling):
     ```tsx
     <span
       className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${
         editingVarName
           ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
           : 'text-primary bg-primary/10 border-primary/20'
       }`}
     >
       {editingVarName ? t('admin.songSets.editingBadge') : t('admin.songSets.badge')}
     </span>
     ```
   - This ensures the header row remains strictly on a single row, keeping card height identical between create and edit states.

3. **Structural Test Assertions in `tests/operator-shadcn-guard.test.mjs` (NO FRAGILE REGEX)**:
   - **Do NOT use single-line regex that expects standard `className="..."` on the badge**, because the badge uses a multi-line template literal `className={`...`}`.
   - Instead, slice the top card header block and assert containment structurally:
     ```javascript
     const topCardHeaderStart = code.indexOf('{/* New / Edit Song Set creation/edit panel');
     const topCardHeaderEnd = code.indexOf('{editingVarName ? (', topCardHeaderStart);
     const topCardHeader = code.slice(topCardHeaderStart, topCardHeaderEnd);

     assert.ok(topCardHeader.includes('truncate'), 'Top card title span must carry truncate');
     assert.ok(topCardHeader.includes('min-w-0'), 'Top card title span must carry min-w-0');
     assert.ok(topCardHeader.includes('shrink-0'), 'Top card badge span must carry shrink-0');
     assert.ok(!topCardHeader.includes(".replace('{title}'"), 'Top card title must not interpolate dynamic {title}');
     ```
   - For i18n files, check with `fs.readFileSync`:
     ```javascript
     const enSource = fs.readFileSync(path.join(root, 'src', 'lib', 'i18n', 'catalogue-en.ts'), 'utf8');
     const idSource = fs.readFileSync(path.join(root, 'src', 'lib', 'i18n', 'catalogue-id.ts'), 'utf8');

     assert.ok(enSource.includes("'admin.songSets.editTitle': 'Edit Song Set'"));
     assert.ok(idSource.includes("'admin.songSets.editTitle': 'Edit Set Lagu'"));
     assert.ok(!enSource.includes("'admin.songSets.editTitle': 'Edit Song Set: {title}'"));
     assert.ok(!idSource.includes("'admin.songSets.editTitle': 'Edit Song Set: {title}'"));
     ```

## Acceptance Criteria

- Clicking the edit icon on any song set entry (regardless of title length) keeps the top form card header strictly on a single line.
- The top form card height remains stable between create mode and edit mode.
- The configured song sets list below maintains its vertical position with zero layout shift.
- Both EN and ID i18n dictionaries define concise titles without `{title}`, with correct Indonesian localization.
- Structural layout and i18n tests in `tests/operator-shadcn-guard.test.mjs` pass cleanly.

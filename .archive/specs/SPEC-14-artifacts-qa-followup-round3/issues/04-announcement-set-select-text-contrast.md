# 04: Announcement Set select value text contrast and active state (BUG-21 residual / SPEC-13-11)

**What to build:** Ensure the active Announcement Set label rendered in `<SelectValue>` inside `AnnouncementSetsPanel.tsx` displays immediately with primary text contrast (`text-foreground`) rather than appearing greyed out like a placeholder (`data-placeholder:text-muted-foreground`).

**Blocked by:** none

**Status:** open

**Done when:**
- On initial load of Announcement Sets, the selected set's title renders in crisp, primary foreground text color (`text-foreground`).
- The trigger element does not retain placeholder styling (`data-placeholder:text-muted-foreground`) when an active set is selected.
- Selecting different sets continues to display their names in primary contrast.

### Implementation Steps

- [ ] In `src/components/admin/AnnouncementSetsPanel.tsx` (~L547-567), inspect the `Select` and `SelectTrigger`:
  ```tsx
  <Select
    value={selectedSetId !== null ? String(selectedSetId) : undefined}
    onValueChange={(val) => {
      if (val) setSelectedSetId(Number(val));
    }}
    items={Object.fromEntries(sets.map((s) => [String(s.id), `${s.label} (${s.slideCount} slides)`]))}
  >
    <SelectTrigger className="w-full text-xs font-semibold h-8">
      <SelectValue placeholder={selectedSet ? `${selectedSet.label} (${selectedSet.slideCount} slides)` : 'Select set…'}>
        {selectedSet ? `${selectedSet.label} (${selectedSet.slideCount} slides)` : undefined}
      </SelectValue>
    </SelectTrigger>
  ```
- [ ] Observe that when `placeholder` is populated with the set's label, if Base UI's internal selection state has not matched the `value` during mount, the trigger displays `data-placeholder="true"`, causing CSS class `data-placeholder:text-muted-foreground` to grey out the text.
- [ ] Ensure `SelectValue` renders clean standard placeholder (`placeholder="Select set…"`) and that the controlled `value` correctly resolves to the active item in Base UI, or explicitly enforce `text-foreground` on the trigger text when `selectedSetId !== null`.
- [ ] If sets load asynchronously, ensure `selectedSetId` and `items` synchronize cleanly on mount without leaving `SelectPrimitive.Root` in an unmatched placeholder state.
- [ ] Add regression tests in `tests/announcement-sets.test.mjs` asserting that the active set trigger does not carry placeholder-muted styling when a valid set is loaded and selected.

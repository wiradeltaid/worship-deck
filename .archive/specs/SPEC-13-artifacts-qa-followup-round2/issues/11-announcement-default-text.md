# 11: Announcement Set's auto-selected slide shows its real text immediately

**What to build:** The first slide-in-set, already auto-selected on load, shows its actual text
content in the text field right away — not only after the admin triggers rename mode.

**Blocked by:** 10

**Status:** open

- [ ] Start with `wdi-systematic-debugging` — the text exists (this is not a data-loss bug), so the
      question is exactly where the auto-selected slide's content fails to reach the text-field
      state on initial load, and what rename mode does differently that makes it appear.
- [ ] Closes `BUG-21`: fix so the field shows the correct text the moment the first slide-in-set is
      auto-selected, with no further interaction needed.
- [ ] Guard the empty case: an Announcement Set with zero slides-in-set does not attempt to sync
      text from a non-existent slide (no-op, field stays empty because there is genuinely nothing
      to show — not because of the bug this ticket fixes).
- [ ] The regression is seen failing (empty field on load, correct text after triggering rename)
      against current code before the fix, then passing after.

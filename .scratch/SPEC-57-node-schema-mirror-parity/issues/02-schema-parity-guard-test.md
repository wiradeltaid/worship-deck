# 02: A guard test fails when the Node database and the Go schema disagree

**What to build:** With ticket 01 landed, the Node bootstrap already reads from the Go schema file
— but nothing yet *proves* the two stay in agreement as both evolve, and nothing catches the next
person who changes how the Node side derives its tables without noticing they've broken the link.
This ticket adds a test that bootstraps a Node database, runs it all the way through whatever
Node-side post-creation changes ticket 01's inventory classified as legitimate exceptions, and
compares what actually exists (introspected from the live connection, not a second hand-written
list) against what the Go schema file declares — table names, column names, **and** each table's
indexes and uniqueness/foreign-key constraints — failing, and naming exactly what diverged and on
which side, the moment the two disagree outside the named exceptions.

**Blocked by:** 01 (there is nothing meaningful to compare against schema.sql until the Node side
actually reads it, and the exception list this ticket needs is ticket 01's own inventory output).

**Status:** closed

- [x] The test bootstraps a real Node database the same way `npm run setup`/the rest of the test
      suite already does — no separate, parallel bootstrap path invented just for this test — and
      lets every Node-side post-creation change run, exactly as production does.
- [x] The test separately bootstraps the Go schema file's own statements into a comparison database
      (not by re-parsing the SQL text by hand — execute it, then introspect the result the same way),
      so both sides of the comparison come from the same kind of evidence.
- [x] The comparison covers table names, column names, and each table's indexes and constraints
      (unique, primary key, foreign key) — not table/column names alone.
- [x] Every named exception from ticket 01's inventory (`song_set_entries.extraction_regex`) is an
      explicit, visible entry in this test (`ALLOWED_EXTRA_NODE_COLUMNS`).
- [x] Deliberately broke the guard once and proved it fails across column, table, index, and
      constraint categories with executable defect injection tests in `tests/schema-parity.test.mjs`.
- [x] Restoring the two sides to agreement makes the test pass cleanly.
- [x] The test follows this repo's existing style for a structural/static guard test.

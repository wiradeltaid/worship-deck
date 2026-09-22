# 01: The Node database bootstrap reads its schema from the Go schema file

**What to build:** Today, running `npm run setup`, `npm run seed:demo`, or the Node test suite
creates a SQLite database from a hand-written set of `CREATE TABLE` statements that lives
separately from the Go API's own schema, and the two have already drifted twice (missing tables,
missing columns on shared tables). After this ticket, the Node side executes the Go schema file's
own text to create its tables — there is exactly one place a table or column is declared, and the
Node-bootstrapped database always has everything the real, deployed application has.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

**Found during review, not in the original raw notes — read before starting:** the Node side does
not stop at initial table creation. It runs its own further schema changes afterward (for one
concrete example: it adds an `extraction_regex` column to a Song Set Entries-family table, a column
the Go schema file does not declare at all). Simply executing the Go schema file's `CREATE TABLE`
statements does not, by itself, make the two sides agree — some of what the Node side has is *ahead*
of the Go schema file, not behind it. The first sub-task here is a plain inventory, before writing
any code: read every one of the Node side's own post-creation schema changes and classify each one
as (a) something the Go side is missing and should probably gain too — a finding to report, not
silently ported without saying so — or (b) something legitimately Node-only (a test-fixture
convenience, say) that the guard test in the next ticket will need an explicit, named exception for.
Do not guess this split; read every migration and decide, or report the ones you cannot classify.

- [ ] The inventory above exists (as a list in this ticket's own completion notes, or a short doc),
      naming every Node-side post-creation schema change found and which of the two classes it falls
      into, before any implementation code is written.
- [ ] `npm run setup` still completes successfully and produces a working database, unchanged from
      the outside (same `.env`, same admin password flow, same success output).
- [ ] `npm run seed:demo` still completes successfully against the new bootstrap.
- [ ] **An existing, already-created Node database (not just a fresh one) is upgraded to the full
      shape too.** `CREATE TABLE IF NOT EXISTS` does nothing for a database that already has an
      older, incomplete version of a shared table — a real upgrade path (an `ALTER TABLE`, or a
      rebuild where SQLite's `ALTER TABLE` cannot express the change) is required for whichever
      tables actually need one, the same discipline the Go side already applies to its own numbered
      migrations. State plainly if no currently-existing Node database in this repo's own test
      fixtures actually needs upgrading, rather than skipping this silently.
- [ ] The full existing Node test suite passes with no changes to any test file — this is a
      mechanism swap, not a behavior change. If any existing test needs a change to keep passing,
      stop and report that rather than editing the test to make it pass — it means an assumption in
      this ticket was wrong.
- [ ] A freshly bootstrapped Node database contains every table the Go schema file declares,
      including the three that were missing before this ticket (the fonts table and the two
      device-sync tables), and every column on tables the two sides already shared.
- [ ] Whatever Node-only tooling logic ran *after* table creation before this ticket (seed-data
      inserts, Node-specific one-time backfills, and whichever of the inventoried post-creation
      changes were classified as legitimately Node-only above) still runs at the same point and
      produces the same result.
- [ ] If any statement in the Go schema file turns out not to be valid SQLite syntax for the Node
      driver in use, that is reported as a blocking finding before this ticket is considered done —
      do not silently skip or rewrite the offending statement without saying so.

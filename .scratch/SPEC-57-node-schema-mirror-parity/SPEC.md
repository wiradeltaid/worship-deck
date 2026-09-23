# SPEC-57 — Node schema mirror parity

## Problem Statement

The Node-side database bootstrap (`src/lib/db`) hand-copies its own `CREATE TABLE` statements
instead of reading them from the Go API's schema. Whoever ships a new table on the Go side has no
signal that the Node side needs the same table — nothing fails, nothing warns, the two files simply
drift apart. That already happened twice: the Go schema gained `font_faces` when custom fonts
shipped, and gained `sync_state`/`sync_tombstones` when manual device sync shipped, and neither
commit touched the Node side. Anyone writing a Node-side test against those newer features today
gets a database that is missing tables the real, deployed application already has — and would not
find out until the test failed in some indirect, confusing way, if it failed at all.

## Solution

The Node-side bootstrap stops hand-maintaining its own copy of the schema and instead executes the
Go schema file directly, so there is exactly one place a table is declared. A guard test compares
what a freshly bootstrapped Node database actually contains against what the Go schema file
declares, so the next time someone adds a table or a column to one side without the other, that
test fails immediately in CI — not silently, weeks later, in whichever test happens to touch the
missing piece first.

## User Stories

1. As a developer adding a new table to the Go API, I want the Node test suite to automatically pick
   up that table, so that I don't have to remember a second file to edit.
2. As a developer running the Node test suite, I want the database it bootstraps to have every table
   and column the real, deployed Go application has, so that a test passing against the Node
   bootstrap means something about the real application.
3. As a developer who forgets to update the Node side after a Go-side schema change, I want a test to
   fail immediately naming what's missing, so that I find out in the same pull request instead of
   whenever someone else's test happens to notice.
4. As a maintainer reviewing this change, I want every currently-passing Node test to keep passing
   unchanged, so that this is a plumbing swap, not a behavior change.
5. As a maintainer, I want the Go side untouched, so that the direction of truth is unambiguous — Node
   follows Go, never the reverse.
6. As a developer running `npm run setup` or `npm run seed:demo`, I want them to keep working exactly
   as before, so that this change is invisible from the outside.
7. As a developer reading the codebase later, I want one obvious place that says "this is the schema,"
   so that a newcomer does not have to be told which of two files to trust.

## Implementation Decisions

- The Node-side bootstrap function's own `CREATE TABLE` statements are replaced with a read of the
  Go schema file's text, executed against the Node (`better-sqlite3`) connection at startup, the same
  moment the hand-written statements used to run. The Go schema file remains exactly what the Go API
  embeds and executes — it is read, never duplicated, never transformed into a second format that
  itself needs to be kept in sync.
- Anything the Node side does *after* table creation and that is genuinely Node-only tooling logic
  (seed-data insertion for `npm run seed:demo`, any Node-specific migration/backfill helper) is
  unaffected by this change and stays exactly where it is — this spec touches only the table/column
  *declaration* step, not what runs after it.
- If any SQL construct in the Go schema file is not valid for the SQLite build `better-sqlite3` uses
  (a Go-specific pragma, a syntax difference between the two SQLite bindings), that is a **blocking
  finding** to report before landing anything — this spec assumes standard `CREATE TABLE`/`CREATE
  INDEX` statements are portable between the two, and that assumption needs to be confirmed against
  the actual file, not asserted here.
- The guard test compares table names, column names, indexes, and constraints (unique, primary key,
  foreign key) from both "what the Go schema file declares" and "what the bootstrapped Node database
  actually contains" (via each database driver's own introspection — SQLite's own `sqlite_master`/
  `PRAGMA` family on a live connection, not a second hand-written parser of the SQL text) and fails
  naming exactly what diverged and on which side.
- **Found during review, before this spec was finalized:** the Node side runs its own schema changes
  *after* initial table creation (an example found: it adds a column to a Song Set Entries-family
  table that the Go schema file does not declare at all). This means the drift is not purely
  "Go ahead of Node" — some of it runs the other way. Before any code changes, every one of these
  Node-side post-creation changes is inventoried and classified as either a real gap the Go side
  should probably also close (reported, not silently ported), or a legitimate Node-only exception the
  guard test names explicitly. An already-existing Node database (not only a freshly created one)
  also needs an upgrade path to the reconciled shape — `CREATE TABLE IF NOT EXISTS` alone does
  nothing for a table that already exists in an older shape.

## Testing Decisions

- This is infrastructure, not user-facing behavior — the test surface is structural (do the two sides
  agree on shape), not behavioral (does a feature work), and a good test here names the specific
  table/column that diverged rather than a generic "schemas differ" failure.
- Every currently-passing test under `tests/` that calls into the Node bootstrap MUST keep passing
  with no changes to the test files themselves — this is the regression bar. A test needing a change
  to keep passing means this spec's "no behavior change" assumption was wrong, and that is reported,
  not silently patched around in the test.
- Prior art in this repo for a structural/static guard test (not a behavioral one): the existing test
  that asserts the Node PPTX worker never imports the SQLite database module, and the existing test
  that asserts no leftover framework-specific runtime pattern survives in the codebase. Both check
  "does the codebase have a shape" rather than "does a feature behave" — the new guard test follows
  that same shape rather than becoming an integration test of the whole application.

## Out of Scope

- Any change to the Go schema file itself — it is the source of truth and is not touched.
- Any change to what any table's columns mean or how any feature behaves.
- The other hand-mirrored file pair in this repo (a lyrics-processing module mirrored between Node
  and Go) — it already carries a documented mutual-update obligation and is not reported as drifted;
  fixing it is a separate concern from this spec.
- Migrating the Go side to generate its own client for the Node layer, or any other architectural
  change to how the two languages share logic beyond this one schema-declaration seam.

## Further Notes

This gap was found as a side effect of a documentation-reconciliation pass, not from a bug report —
nothing is currently broken in production or in CI; the Node test suite passes today because nothing
in it currently exercises the three tables or the extra columns Terra's investigation found. Two
independent read-only investigations (one in-session, one via an external CLI) agreed on the
diagnosis and the recommended direction before this spec was written; neither found a test that
depends on the current, incomplete Node schema shape, which is why this is scored as low-risk
despite touching a foundational piece of test infrastructure.

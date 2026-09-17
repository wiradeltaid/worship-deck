# brownfield — the as-built ground this wave stands on

Distilled from the code, not from the corpus. `.constitution/project/codebase-brownfield-guide.md` is born empty and records that this companion is promoted into it before the wave closes.

The `SDD` Evidence table already labels what is `[MISSING]`, `[PARTIAL]` and `verified`. This file adds what that table cannot carry: the file, the line, and the trap.

## Two different things are called a snapshot

| Name | What it is | Where |
|---|---|---|
| `RegistrySnapshot` (shipped) | `ReadonlyMap<string, StoredArtifactTemplate>` — the **live** registry assembled fresh for one plan build. Not durable, not per Service. | `src/lib/artifacts/registry-snapshot.ts:14` |
| `ServiceRegistrySnapshot` (`AD-16`) | The durable per-Service **freeze** on `DB_PATH`. Has no table yet. | `AD-16`; `.how/registry/05-model/data-model.md` keeps the row with `[MISSING]` |

`AD-16` calls this out itself as a naming caution. Story 1-2 builds the second one; conflating them, or extending the first to mean the second, is the failure this warning exists for.

## What the registry store does and does not export

`src/lib/registry/store.ts` exports `listArtifactSummaries`, `getArtifactTemplate`, `updateArtifactTemplate`, `resetArtifactTemplate`, `insertArtifactTemplateIfMissing`, `assertContiguousPositions`, `serializeTemplate`, `hashTemplatePayload`, and the two error classes. There is **no delete and no reorder**, at either layer.

`updateArtifactTemplate` never touches `position` — it selects `id, label, base_type, payload, updated_at` and writes those. So reorder is not hiding inside the shipped `PUT`, and this wave adds verbs rather than renaming one.

`src/app/api/admin/artifacts/` holds `route.ts` (GET list), `[id]/route.ts` (GET, PUT), and `[id]/reset/route.ts` (POST). Nothing else.

## `position` today

Column is `position INTEGER NOT NULL DEFAULT 0` (`src/lib/db/index.ts:500-508`). `assertContiguousPositions` (`store.ts:80`) pins the set to exactly `0..N-1` with no duplicate and no gap, and every read orders by it (`store.ts:62`, `registry-snapshot.ts`). `insertArtifactTemplateIfMissing` takes an explicit `position` and is the bootstrap's only writer of it.

The trap: `DEFAULT 0` means any insert that forgets `position` lands a duplicate zero, and `assertContiguousPositions` will then fail for the whole table rather than for that row. `OQ-31` records that today's SQL-delete proof path leaves gaps; the delete verb is what compacts them.

## The omit-and-log pattern `OQ-32` points Sync at

`loadRegistrySnapshot` (`registry-snapshot.ts:76`) is the specimen: `SELECT ... ORDER BY position`, `parseRow` each row, skip the ones that return `null`, and log the rejection as

```
[registry] template "<id>": persisted row rejected (stored payload is not a valid template); no layout is available: <reason>
```

Story 20.1 removed the read-time seed fallback here entirely, which is the half of `AD-17` already verified. Sync's corrupt-row behaviour copies this shape — same skip, same log with id and reason — rather than inventing a second posture.

## `assertStableAgainstSeed` opens on the seed and throws without one

`store.ts:129-133` starts with `getSeedTemplateById(incoming.id)`, which throws for an id the seed lacks. `AD-17` records this as **not yet closed**: `artifact_templates` has no per-row origin column, so a row with no seed origin cannot be validated against itself.

It is unreachable today only because there is no create verb — and create is a Non-goal of this wave, which is what keeps it unreachable. The moment a create verb ships, this is the first thing it hits. Do not route the delete or reorder verb through this function.

## The entry-key set is at three, not the six `AD-19` closes it at

`src/lib/registry/types.ts:11` — `ARTIFACT_ENTRY_KEYS = ['general', 'song-set', 'announcement']`. The four `songset-*` slot identities `AD-19` names are **not in the code yet** (the file marks them as Story 20.7's work); `kindOf` already accepts a `songset-*` prefix, but no such key is legal to persist.

Consequence for story 1-1: `UC-15`'s "delete a SongSet slot row" case can only be exercised against the single `song-set` entry key as things stand. Widening the set is a code-plus-tests change and not this wave's (`AD-19`, and the `SPEC` Non-goals).

## `announcement_items.service_id` is nullable

`src/lib/db/index.ts:421-428` — `service_id INTEGER` with `FOREIGN KEY ... ON DELETE CASCADE`, no `NOT NULL`. `AD-16` reasons about exactly this: both the shared-list and the per-Service-scoped readings are expressible against a nullable column, and it picks the scoped one. The corpus schedules no change to the column, which is why the `SPEC` carries this as `OQ-D` rather than as work.

## The `data_version` repair wipes a stale developer database

`src/lib/db/index.ts:275-300`: a database holding `artifact_templates` rows with no `data_version` key predates the counter, and the guard wipes those rows so the `AD-17` bootstrap reseeds the compacted shape at version 1. The comment records the licence — `AD-4` says no deployment exists yet, `AD-18` allows total replacement — and that **the licence expires at first deploy**. A schema change in this wave that needs to reach persisted rows after that point is a real migration, not a reseed.

## Tests are named, not globbed

`npm test` lists every file explicitly. A new test file that is not added to the `test` script in `package.json` never runs, and the suite still reports green. Both of this wave's test files must be added there. See `stack.md` for the rest of the test harness.

## `src/proxy.ts` is the authorization boundary

The `config.matcher` regex at `src/proxy.ts:101-123` is an allow-by-default-deny: anything the regex does not match is served with **no session check at all**. `/api/admin/artifacts/**` and any Service route are inside it. `tests/proxy-matcher.test.mjs` pins both halves, and `AD-5` requires a new exclusion to ship with its assertion in the same change set. Sync Artifact needs more than the matcher regardless: the Service route it lands on is gated for *any* signed-in account, so the route re-checks Admin in-process with `requireAdminSession` (`AD-16`, `AD-14`).

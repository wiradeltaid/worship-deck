# conventions — worship-presenter-web

Distilled from the code, not from the corpus. `.constitution/project/codebase-conventions-guide.md` is born empty and records that this companion is promoted into it before the wave closes. Every rule below is a pattern already ratified by shipped code; where a rule cites a file, that file is the specimen.

## API route shape

Every route under `src/app/api/**/route.ts` follows one order, and `src/app/api/admin/artifacts/[id]/route.ts` is the reference:

1. `const session = await requireAdminSession(request)` first, before reading params or body. `if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })`.
2. `const { id } = await context.params` — params is a `Promise` in this Next.js version, typed as `type RouteContext = { params: Promise<{ id: string }> }`.
3. Body validated shape-first: reject a non-object or an array with `400 Invalid JSON`; reject a missing or blank `updatedAt` with `400 updatedAt is required`.
4. Work inside `try`; map each known error class to its status in the `catch`, and end with a generic `500 Internal Server Error`.

The response body is `{ error: string }` plus the HTTP status — there is no richer envelope, and `.how/_platform/cross-cutting.md` marks that `[PARTIAL]` rather than aspirational. The status table there is the contract: `400` invalid input, `401` session absent, `403` role insufficient, `404` row absent, `409` `updated_at` precondition failed, `500` server failure with a generic client message.

**The client never sees an internal message.** A caught error is logged server-side with `console.error('<Verb>ing artifact template:', error)` — sentence-case, names the operation, passes the error as the second argument — and the client gets the generic string.

## Errors are classes, not status codes, below the route

`src/lib/registry/store.ts` throws `RegistryNotFoundError`, `RegistryStaleError`, and `RegistryValidationError` (the last from `src/lib/registry/validate.ts`). The store knows nothing about HTTP; the route maps class to status. A new failure mode gets a class in the library and a mapping line in the route — never a status code invented inside the store.

## Vocabulary lives in one exported list, and kinds are derived

`src/lib/registry/types.ts` is the pattern for every closed set: a `const` array `as const`, a type derived from it with `(typeof X)[number]`, and pure functions over it. Nothing persists a value that a function can derive — `kindOf(entryKey)` derives the kind from the entry key precisely so the kind never becomes a second persisted fact (`AD-19`).

Two functions, deliberately: `kindOf` throws on an unknown key and is for write paths; `kindChipLabel` returns `'unknown'` and is for render boundaries. Pick by which side of the boundary you are on.

## An enum value never reaches the screen raw

An entry key rendered into the DOM goes through its label function: `src/components/admin/ArtifactEditor.tsx:937,955,1002` render `[{kindChipLabel(item.baseType)}]`, never `item.baseType`. `src/lib/artifacts/preview-model.ts:103` records why — that path runs inside a render, where `kindOf`'s throw would take the tree down. The raw `songset-*` key reaches no human surface at all (`AD-19`).

Localisation is the same idea one layer up but **not yet swept**: `src/lib/i18n` has the machinery — `I18N_KEYS` as a closed `as const` list, `resolveString`, `catalogue-en.ts` / `catalogue-id.ts` — and exactly one consumer, `src/app/(operator)/admin/UiLocaleSettings.tsx` (Story 24.1's admin switcher block; `keys.ts` says Story 24.2 adds the sweep). So a new operator-facing string is not required to be catalogued yet, but a new one that *is* catalogued adds its key to `I18N_KEYS` and both catalogues in the same change.

## Database

- One synchronous `better-sqlite3` handle, memoized in `getDb()` (`src/lib/db/index.ts:382`). `journal_mode = WAL`, `busy_timeout = 5000`, `foreign_keys = ON`.
- Schema changes are `CREATE TABLE IF NOT EXISTS` in the `db.exec()` block on the `getDb` path, and nowhere else (`AD-9`).
- A statement is prepared inline at its use site with `db.prepare(...).get()` / `.all()` / `.run()`; there is no query-builder layer and no repository class.
- A raw row is converted through one `rowToStored`-style mapper before it leaves the store, so snake_case columns never travel into the app as-is.
- A value change that must reach rows already persisted is a versioned one-time migration under the single `data_version` in `settings`, never a re-seed (`AD-18`, `AD-21`, `AD-17`).

## Comments carry the reason, not the mechanism

The specimen is the `matcher` block in `src/proxy.ts`: it names why each exclusion exists, what is deliberately **not** excluded, and what a future reader must do in the same change set. `src/lib/db/index.ts:275-300` does the same for the `data_version` repair, including the developer-facing consequence. Match that density — a comment that restates the line below it is noise; a comment that records the decision the line encodes is the convention.

Where a decision is recorded elsewhere, cite it by id inline (`AD-17`, `OQ-24`, `BR-9`) rather than restating it.

## Naming

`.constitution/method/language-guide.md` owns naming. Two facts from this codebase: files under `src/lib/` are kebab-case (`registry-snapshot.ts`, `present-channel.ts`), and a type named for a corpus concept keeps the corpus spelling — which is why `RegistrySnapshot` in code and `ServiceRegistrySnapshot` in `AD-16` are two different things and must not be conflated (see `brownfield.md`).

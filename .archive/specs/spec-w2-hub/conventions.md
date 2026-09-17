# conventions — worship-presenter-web (W2)

Patterns already ratified by shipped code, plus the DEC-003 split this wave lands.

## Authorization boundary

The Go path matcher **is** the gate (`AD-5`). Anything it does not treat as gated is served with no session check. A new exclusion ships with its assertion in `internal/gate` tests **and** in `tests/proxy-matcher.test.mjs` until Next’s `src/proxy.ts` is deleted. The two lists must stay the same prefixes.

Gated JSON responses use `{ error: string }` and `Cache-Control: private, no-store` plus `Vary: Cookie`. `401` session absent, `403` role insufficient, `400` invalid input, `404` row absent, `500` generic client message with `console`/`log` of the real error server-side.

Session cookie: `auth_session`. HMAC-SHA256 over base64url payload, same fields as `src/lib/auth/session.ts` (`uid`, `role`, `sid`, `tv`, `exp`). Signature alone is not enough: re-check `accounts` and `revoked_sessions` in-process (`src/lib/auth/require.ts` is the specimen).

## PPTX worker

The child receives a finished plan JSON (stdin). It draws and exits. It MUST NOT import `getDb`, `src/lib/db`, `buildSlidePlan`, or `src/lib/settings.ts`. Transition is a field on the JSON, not a database read.

## Planner

`buildSlidePlan` / Go `BuildSlidePlan` is the only slide-order source (`AD-7`). Sequence is `artifact_templates.position` (or the AD-16 freeze), never source order in the handler table. A missing or invalid template row is omitted, not substituted from seed.

## Database

One process opens `DB_PATH` (`AD-4`). WAL, busy timeout, foreign keys on. Schema changes are `CREATE TABLE IF NOT EXISTS` on that open (`AD-9`). Do not run Next `getDb()` and the Go API against the same file at the same time.

## Naming

Go packages under `internal/` are lowercase. JSON field names on the wire stay camelCase to match as-built Hub contracts. Inventory **numbers** 1–33 do not change; Host is `api`.

## Tests

`package.json` `test` is an explicit filename list. Go tests live beside the package (`go test ./...`) and are also invoked from CI.

# stack — worship-presenter-web

Distilled from the code this wave builds on, not from the corpus. `.constitution/project/codebase-stack-guide.md` is born empty and records that this companion is promoted into it before the wave closes; until then that guide has no verification commands in it at all, which is why this file exists.

Every version below is `package.json` as read at wave open. **Read `package.json` rather than trusting a number here** if the two disagree — this file is a snapshot, `package.json` is the fact.

## Runtime and framework

| Thing | Value | Where it is fixed |
|---|---|---|
| Framework | Next.js `16.2.10`, App Router | `package.json`, `next.config.ts` |
| React | `19.2.4` | `package.json` |
| Language | TypeScript `^5`, `strict: true`, `noEmit` | `tsconfig.json` |
| Import alias | `@/*` → `./src/*` | `tsconfig.json` `paths` |
| Database | SQLite via `better-sqlite3` `^12.11.1`, synchronous API | `src/lib/db/index.ts` |
| Deck output | `pptxgenjs` `^4.0.1`; `jszip` for asset packing | `package.json` |
| Canvas editor | `fabric` `^6.6.1` | `AD-13` uncontrolled wrapper |
| UI | Tailwind `^4` via `@tailwindcss/postcss`, `shadcn`, `@base-ui/react`, `lucide-react`, `sonner`, `next-themes` | `package.json`, `postcss.config.mjs` |
| Node — CI | `22` | `.github/workflows/test.yml` |
| Node — this worktree | `v24.18.0` | `node -v` |

**This is not the Next.js in your training data.** `AGENTS.md` requires reading the relevant guide under `node_modules/next/dist/docs/` before writing code against a framework API, and heeding its deprecation notices.

## Commands, and the directory each runs from

All of these run from the repository root.

| Purpose | Command |
|---|---|
| Install exactly the lockfile | `npm ci` |
| Build | `npm run build` |
| Full test suite | `npm test` |
| One test file | `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/<name>.test.mjs` |
| Lint | `npm run lint` |
| Public-repo guard alone | `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/public-repo-guard.test.mjs` |
| Dev server | `npm run dev` |

`npm test` does **not** glob `tests/`. It names every file explicitly in the `test` script, so **a new test file is not run until it is added to that list** — adding the file alone leaves it silently uncollected. `.github/workflows/test.yml` runs `npm ci`, then `npm run build`, then `npm test`, in that order; the build is not optional, because `tests/auth-http.test.mjs` spawns the built server and throws without `.next`.

`.github/workflows/test.yml` is the only workflow in the repository. A green corpus-validation run elsewhere would be about documents, never code — build and test evidence comes from running the two commands above.

## How a test is written here

`node:test` plus `node:assert/strict`, no test framework. TypeScript under `src/` is loaded through `--experimental-strip-types` behind `tests/register-ts-resolve.mjs`, which registers `tests/ts-resolve-hook.mjs` so an extensionless or directory import resolves to `.ts`.

The shape every store-level test in `tests/` follows:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '<name>-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');          // BEFORE the dynamic import

const { getDb } = await import(pathToFileURL(path.join(root, 'src', 'lib', 'db', 'index.ts')).href);
```

Two rules that are easy to get wrong and cost the whole file:

- `DB_PATH` is set **before** the first dynamic import of `src/lib/db/index.ts`, which is where every test in `tests/` puts it. `getDb()` reads `process.env.DB_PATH` on its first call and memoizes the handle (`src/lib/db/index.ts:382-390`), defaulting to `process.cwd()/data.db` — so any assignment that lands after something has already called `getDb()` reaches nothing, and the test writes into the developer's real `data.db`. Setting it before the import is the habit that cannot get this wrong.
- `src/` is imported with `await import(pathToFileURL(...).href)` — a static `import` of a `.ts` path from a `.mjs` test does not resolve.

`tests/register-ts-resolve.mjs` also sets `WPW_USE_SHIPPED_REGISTRY=1`, so tests assert against the committed public seed and ignore any private `data/local/default-registry.json` on the machine. Do not defeat that.

A test asserting something is **absent** is worth nothing until it has been seen to fail: inject every form of the defect the guard claims to cover, watch it go red, then revert (`AGENTS.md`).

## Where this wave's code lives

| Concern | Path |
|---|---|
| Request gate and the authorization matcher | `src/proxy.ts` |
| Admin session re-check in a route | `requireAdminSession` from `@/lib/auth/require` |
| Startup DDL, the `data_version` counter, the `AD-17` bootstrap | `src/lib/db/index.ts` |
| Registry store (`LC-15`) | `src/lib/registry/store.ts` |
| Registry validation and its error class | `src/lib/registry/validate.ts` |
| Entry-key to kind derivation | `src/lib/registry/types.ts` |
| Live-registry map assembled per plan build | `src/lib/artifacts/registry-snapshot.ts` |
| Registry HTTP (`LC-11`) | `src/app/api/admin/artifacts/**/route.ts` |
| Admin Registry screen | `/admin/artifacts` |

`.work/` is committed scratch. It MUST NOT be imported by `src/`, and it is excluded when searching for code.

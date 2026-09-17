# stack — worship-presenter-web (W2)

Distilled from the code this wave builds on. `.constitution/project/codebase-stack-guide.md` is Draft; this companion is the verification list for the wave.

Every Node version below is `package.json` as read at wave open. **Read `package.json` rather than trusting a number here** if the two disagree.

## Runtime

| Thing | Value | Where it is fixed |
|---|---|---|
| Live API | Go, `cmd/api`, `modernc.org/sqlite` (no CGO) | AD-30, `go.mod` |
| Operator / projector UI | React SPA under `spa/` (Vite) | AD-24, AD-30 |
| Shared UI modules | `src/operator`, `src/projected`, `src/components` | `spa/vite.config.ts` alias `@` |
| PPTX draw | PptxGenJS `^4.0.1` in an on-demand Node child `workers/pptx/` | AD-30 |
| React | `19.2.4` | `package.json` |
| TypeScript | `^5`, `strict: true` | `tsconfig.json` |
| Import alias | `@/*` → `./src/*` | `tsconfig.json` |
| Node — CI | `22` | `.github/workflows/test.yml` |
| Node — this machine | `v24.18.0` | `node -v` |
| Go — this machine | `go1.26.5` | `go version` |

Do not add a Next.js route handler or App Router special file. The live path is Go `mux.HandleFunc` plus the Vite SPA.

## Commands (repository root)

| Purpose | Command |
|---|---|
| Install lockfile | `npm ci` |
| SPA production bundle | `npm run spa:build` |
| Full Node test list | `npm test` |
| One Node test file | `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/<name>.test.mjs` |
| Go tests | `go test ./cmd/... ./internal/...` |
| Public-repo guard | `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/public-repo-guard.test.mjs` |
| Go API (dev) | `go run ./cmd/api` with `DB_PATH`, `AUTH_SECRET`, `PORT` |

`npm test` does **not** glob `tests/`. A new `.mjs` file is silent until its name is appended to the `test` script in `package.json`.

`.github/workflows/test.yml` must run `go test ./cmd/... ./internal/...` in addition to `npm ci` / `npm run spa:build` / `npm test`.

## How a Node test is written here

`node:test` plus `node:assert/strict`. TypeScript under `src/` loads through `--experimental-strip-types` behind `tests/register-ts-resolve.mjs`.

Set `process.env.DB_PATH` to a temp file **before** the first dynamic import of `src/lib/db/index.ts`. Import `src/` with `await import(pathToFileURL(...).href)`.

`tests/register-ts-resolve.mjs` sets `WPW_USE_SHIPPED_REGISTRY=1`. Do not defeat that.

`--experimental-strip-types` forbids TypeScript constructor parameter properties.

A test asserting something is **absent** is worth nothing until it has been seen to fail: inject the defect, watch it go red, revert (`AGENTS.md`).

## Where this wave's code lives

| Concern | Path |
|---|---|
| Go process entry | `cmd/api/main.go` |
| AD-5 matcher | `internal/gate` (`tests/go-http-gate.test.mjs`) |
| Session HMAC | `internal/auth` — cookie name `auth_session`, same payload as `src/lib/auth/session.ts` |
| SQLite open / DDL | `internal/db` (AD-9). Node `getDb()` still bootstraps when a test creates the file first |
| Slide plan (LC-16) | `internal/plan` — Go, not a Node child |
| PPTX worker (LC-13) | `workers/pptx/draw.mjs` + `src/lib/pptx-draw.ts` |
| Node plan helper (tests / worker input) | `src/lib/slide-plan.ts` |

`.work/` MUST NOT be imported by `src/` or by the Go module.

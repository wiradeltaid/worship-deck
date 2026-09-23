---
type: structure
scope: codebase
verified: 2026-09-22
commit: ccfe1df
---

# Codebase Structure

Written and refreshed only by `wdi-init` intent `structure`, never by hand. Rules live in
`.constitution/method/structure-guide.md`. Naming: `.constitution/project/codebase-conventions-guide.md`.
Versions: `.constitution/project/codebase-stack-guide.md`.

## Verified

2026-09-22, derived from the tracked tree at `ccfe1df`. Post DEC-003 cutover (Go API + Vite SPA live;
Docker packaging retired), post DEC-004/DEC-005 (`data_version` 11), and post the offline-desktop /
manual-sync / PPTX-import work (SPEC-32…47).

## Top level

```text
worship-deck/
├── cmd/                       # Go entry points — cmd/api/ is the only one
├── internal/                  # Go application code — see the api container below
├── spa/                       # React SPA (Vite)
├── src/                       # shared React UI + PPTX worker modules
├── workers/                   # PPTX worker entry (Node child)
├── public/                    # static slide plates (`/assets/...`)
├── data/                      # committed seed corpora; not the live DB
├── docs/                      # public docs (overview, features, threat model) + docs/agents/ engine config
├── installer/                 # [tooling] Inno Setup source for the Windows desktop installer
├── scripts/                   # [tooling]
├── tests/                     # [tooling]
├── .archive/                  # closed spec folders, moved out of `.scratch/` at close (`wdi-prune-or-archive`)
├── .scratch/                  # active spec workspaces (SPEC.md, tickets), tracked in `specs.yaml`
├── .github/                   # CI
├── .agents/ · .claude/        # installed skills
├── .constitution/             # [docs] method/ kit + project/ room
├── .control/                  # [docs] control plane
├── .what/ · .how/             # [docs] corpus
├── .work/                     # committed scratch; emptied when a task closes
├── _bmad/                     # BMad installer
├── _bmad-output/              # BMad workspace (deferred-work)
├── .cursor/                   # editor rules
├── go.mod                     # Go module
├── package.json               # ★ Node version authority
└── AGENTS.md                  # ★ session entry
```

## Containers

Headings are the `built: true` containers in `components.yaml` (DEC-003).

### api

Go always-on process + SQLite. `built: true`. `cmd/api/` + `internal/`.

```text
cmd/api/                      # ★ main
internal/
├── gate/                     # ★ the one request gate — AD-5's authorization boundary
├── httpapi/                  # ★ JSON handlers + route table (server.go)
├── auth/                     # sessions, password hashing, lockout
├── db/                       # ★ startup DDL + numbered migrations (AD-9, AD-21)
├── plan/                     # ★ LC-16 planner + artifact validation
├── parse/                    # Rundown parsing
├── pptx/                     # worker invocation with a deadline; not the drawing
├── pptximport/                # PPTX import: font/typography extraction, smart-background detection
├── desktop/                  # single-instance lock, local port pick, browser launch (offline desktop mode)
└── scripture/                # verse lookup
```

**Flow:** Go gate → JSON handlers → SQLite `DB_PATH`. Plan stays in `api`; PPTX drawing is not this
container — `internal/pptx/` only execs the worker and bounds it with a timeout.

### spa

React SPA. `built: true`. `spa/` (Vite). Shared UI imported from `src/`.

```text
spa/src/
├── pages/                    # route shells — ★ App.tsx is the route table
├── projected/                # projected shell's own routes
├── lib/                      # SPA-only helpers (session, routing)
└── App.tsx                   # ★
src/components/               # shared UI (shadcn primitives under ui/)
src/operator/                 # ★ hub forms (CreateForm, EditForm) + presenter chrome
src/projected/                # room-facing clients — closed to operator chrome (AD-24)
src/lib/                      # shared modules: registry, artifacts, i18n, db, lyrics
```

**Flow:** browser → JSON `api` + session cookie. MUST NOT open SQLite (AD-30). The operator shell and
the projected shell are separate roots on purpose: AD-24 keeps room-facing surfaces closed to operator
chrome, and `src/projected/` is where that boundary is enforced.

### pptx-worker

On-demand Node child. `built: true`. `workers/pptx/` + `src/lib/pptx.ts`.

```text
workers/pptx/                 # child entry
src/lib/pptx.ts               # ★ PptxGenJS draw
```

**Flow:** `api` execs worker with a finished plan → PPTX file → exit. MUST NOT open SQLite.

## Libraries

None. `src/lib/` is not a separate artifact.

## Tooling

```text
scripts/
scripts/build-desktop.mjs          # ★ packages cmd/api + spa/dist into the desktop installer
tests/
tests/public-repo-guard.test.mjs   # ★ public-repo absence-guard
tests/no-nextjs-runtime.test.mjs   # ★ Next.js absence-guard
tests/no-docker-packaging.test.mjs # ★ Docker packaging absence-guard
tests/translator-guard.test.mjs    # ★ t() takes one argument, across src/ and spa/src/
tests/no-router-refresh-guard.test.mjs # ★ no route remount on an operator surface
tests/helpers/go-api.mjs           # ★ starts and reaps the Go API for every http suite
installer/worship-deck.iss         # ★ Inno Setup script `build-desktop.mjs` drives
```

Every suite is named explicitly in `package.json` `scripts.test`; the list does not glob, so a file
that is not registered never runs.

## Generated

| Path | Generated by |
| --- | --- |
| `.next/` (removed; gitignored if recreated) | retired Next.js App Router |
| `spa/dist/` (gitignored) | `npm run spa:build` |
| `.control/generated/` | `validate.py` / `timeline.py` |

## Findings

- Deploy is binary + systemd on VPS (dev) or LiveServer (prod target), not Docker Compose. A packaged
  Windows installer (`installer/`, `scripts/build-desktop.mjs`) is also published on tagged GitHub
  Releases as of `.github/workflows/release.yml`; no tag has been cut yet.
- `package.json` is the Node version authority; `go.mod` is the Go version authority.
- `.work/` is committed scratch, not a code area: `src/` MUST NOT import it and code searches exclude it.
- This refresh (2026-09-22) added five base folders absent from the prior map — `internal/` itself
  (previously implied only through `cmd/api/`), `docs/`, `installer/`, `.archive/`, `.scratch/` — and
  two `api`-container packages born since, `internal/desktop/` (offline desktop launcher) and
  `internal/pptximport/` (PPTX import font/typography extraction, smart-background detection).
- `src/lib/db/index.ts` is a hand-maintained TypeScript mirror of `internal/db/schema.sql`, used only
  by `npm run setup` / `seed:demo` and the Node test suite — not by the Go API or the PPTX worker. The
  two have drifted (tables and columns); tracked as SPEC-57, not fixed by this map.

---

★ = key file: entry point, wiring root, the single place a rule is enforced, or a file that must be
opened before behaviour in its folder can be changed.

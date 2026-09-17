---
id: SPEC-w2-hub
companions:
  - stack.md
  - conventions.md
  - brownfield.md
  - ../../../.what/hub/SRS-hub.md
  - ../../../.how/hub/SDD-hub.md
  - ../../../.how/hub/04-components/LC-13-pptx.md
  - ../../../.how/hub/04-components/LC-16-slide-plan.md
  - ../../../.how/_platform/ARCHITECTURE-SPINE.md
  - ../../../.how/_platform/c4-l2-containers.md
  - ../../../.how/_platform/inventory-api.md
  - ../../../.control/decisions/DEC-003-go-api-react-spa-pptx-worker.md
sources:
  - ../../../.what/_prd/offline-deck/prd.md
  - ../../../.what/_prd/operator-turn/prd.md
  - ../../../.control/registry/requirements.yaml
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.
>
> **Projection, not authorship.** This file projects `.what/hub/`, `.how/hub/` and `.how/_platform/ARCHITECTURE-SPINE.md` onto wave W2. It introduces no `FR`, `UC`, `BR` or `AD`. A gap found while building is landed in the corpus by the skill that owns that layer — never patched in here.

# W2 x Hub — FR-14: Go API, React SPA, on-demand PPTX worker

## Why

**A mandate to meet.** DEC-003 / AD-30 bind the live process split: the always-on server is Go, the Operator UI and projector are a React SPA, and PptxGenJS runs only as an on-demand Node child that draws a finished plan. `FR-14` / `UC-18` is the human-testable proof: an Operator still downloads a PPTX that presents offline. Today's Next.js process in `src/` is as-built, not the rule.

## Capabilities

- **CAP-5**
  - **intent:** Operator can download a PPTX that presents the Service without a network.
  - **success:** The `FR-14` proof of done, on the DEC-003 topology. `GET /api/services/[id]/pptx` is served by the Go API (inventory row 8, Host `api`). The Node child receives an already-finished plan, draws PPTX, and exits; it does not open SQLite (`AD-30`, `LC-13`). The slide order still comes from one planner in the Go process (`AD-7`, `LC-16`). Proven by `tests/pptx-worker.test.mjs` and `tests/pptx-go-http.test.mjs`.

`CAP-5` is allocated from `.control/registry/requirements.yaml`. No capability is minted here.

## Constraints

- The Go API is the only always-on server. Development MAY use a SPA bundler; it MUST NOT keep a Node application server as the live API (`AD-30`).
- SQLite opens in the Go process. Startup DDL lives on that open (`AD-9`). Do not run a second API process against the same file (`AD-4`).
- One request gate in the Go process; its matcher **is** the authorization boundary. A new exclusion ships with its assertion test in the same change set (`AD-5`). `/api/webhook` remains `WEBHOOK_SECRET` only.
- The PPTX worker MUST NOT import `getDb` / open SQLite / call `buildSlidePlan`. It draws `ArtifactInstance` rows already hydrated (`AD-12`, `AD-30`).
- `buildSlidePlan` remains the only slide-order source; after this wave it runs in Go (`AD-7`). Until the Go planner lands, Next.js as-built planner may not be the live HTTP path.
- Session cookie, 401/403 envelope, and `Cache-Control: private, no-store` on gated responses stay as `cross-cutting.md`.
- JSON paths and numbers in `inventory-api.md` do not change. Host is `api`; do not renumber.
- Public repository: no congregation data, `.env`, `data/local/`, `data/uploads/`, rendered slides or source decks in a tracked file.

## Non-goals

- Create/add Artifact Template (`AD-17` origin column) — later wave.
- Porting every Hub/Registry/Presenter JSON verb in this wave beyond what `GET .../pptx` and its gate/session need. Remaining routes stay as-built Next until a later wave, **except** they MUST NOT be the production always-on server once Go listens as the API.
- Replacing PptxGenJS with a Go PPTX library.
- Telegram / CAP-11 as this wave's handover.
- Changing FR/NFR wording.

## Success signal

An Operator signed in through the Go gate downloads `GET /api/services/{id}/pptx` and receives an OpenXML file. The Node process that drew it has exited and never opened SQLite. A laptop can present that file with no hub connectivity (`AD-1`).

## Assumptions

- OQ-35, OQ-36, OQ-37 as filed. Production image includes a Node binary only to exec the worker.
- Owner isolation override: this wave runs on `main` (same as W1). Orca worktree not used.

## Open Questions

None. Gaps that appear while building go to `wdi-question`, not here.

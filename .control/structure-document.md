---
type: structure
scope: document
verified: 2026-09-22
commit: ccfe1df
---

# Document Structure

Written and refreshed only by `wdi-init` intent `structure`, never by hand. Rules live in
`.constitution/method/structure-guide.md`. Placement test: `.constitution/method/document/corpus-guide.md`.

## Verified

2026-09-22, derived from the tracked tree at `ccfe1df`, honouring `.gitignore`. Drift closed in this
pass: `registry/requirements.yaml` and `registry/waves.yaml`, named in the prior map, do not exist —
`requirements.yaml` was split per-PRD (`requirements-rundown-to-service.yaml`,
`requirements-operator-turn.yaml`, `requirements-offline-deck.yaml`) and `waves.yaml` was renamed to
`specs.yaml` at some point after 2026-08-22, with neither rename reflected here until now.
`registry/goals.yaml` (BG rows) and `.control/reports/`, `.control/test-targets/` also existed on disk
and were absent from the map.

## Top level

```text
.constitution/                # how we work — populated (method/ + project/)
.control/                     # what currently holds — registries + maps
.what/                        # what was promised — brief, 3 PRD, 3 SRS
.how/                         # how it is built — spine, C4, 3 SDD deep
_bmad-output/                 # BMad workspace — deferred-work register
```

## Per layer

### `.constitution/`

```text
.constitution/
├── method/                   # kit — overwritten by update
│   ├── constitution.md       # Articles 3, 4, 6, 7
│   ├── document/
│   │   └── corpus-guide.md   # ★ placement
│   ├── scripts/              # validate.py · timeline.py · inventory.py
│   └── why/                  # Reference — does not bind
└── project/                  # this product — never overwritten
    ├── constitution.md       # ★ Articles 1, 2, 5
    ├── public-repository.md  # ★ public-repo gate
    ├── private-data.md
    ├── deployment.md
    └── codebase-*-guide.md
```

### `.control/`

```text
.control/
├── registry/
│   ├── index.yaml            # ★ product.name, mode, gates_passed
│   ├── components.yaml       # ★ PC · containers api/spa/pptx-worker · LC · owns
│   ├── goals.yaml            # BG rows
│   ├── requirements-*.yaml   # one per PRD initiative — FR/NFR, status: retired where withdrawn
│   ├── usecases.yaml
│   ├── specs.yaml            # ★ spec/ticket records, status, spec_reviewed traces (renamed from waves.yaml)
│   ├── decisions.yaml        # DEC index
│   ├── defects.yaml
│   └── risks.yaml
├── decisions/                # DEC-<n>-<slug>.md, one file per decision
├── questions/                # assumptions.md · blocking.md
├── memlog/                   # one per PC, plus spine.md
├── meetings/
├── reports/                  # archived retrospectives — RTR-<wave/spec>.md, manual acceptance checklists
├── test-targets/             # per-platform manual smoke-test checklist templates (`wdi-daily-what-to-test`)
├── generated/                # validate.py --generate; never hand-written
├── structure-document.md
├── structure-codebase.md
├── product-glossary.md
├── project-non-technical-log.md
└── wdi-method.yaml
```

### `.what/`

```text
.what/
├── _product-brief/           # ★ brief.md
├── _prd/
│   ├── rundown-to-service/
│   ├── offline-deck/
│   └── operator-turn/
├── business-rules.md
├── hub/
├── presenter/
└── registry/
```

### `.how/`

```text
.how/
├── _platform/
│   ├── ARCHITECTURE-SPINE.md # ★
│   ├── design-system.md
│   ├── c4-l1-system-context.md
│   ├── c4-l2-containers.md
│   ├── c4-l3-api.md
│   ├── c4-l3-spa.md
│   └── inventory-*.md
├── hub/
├── presenter/
└── registry/
```

### `_bmad-output/`

Live BMad workspace. Work in progress; committed, not curated. Historical prior knowledge and early wave specifications have been retired/archived.

## Product Components

| Product Component | `.what/<pc>/` | `.how/<pc>/` | Slots split out |
| --- | --- | --- | --- |
| hub | SRS-hub.md | SDD-hub.md | 02-rules, 03-domain, 04-usecases, 05-scenarios; 02-contracts, 03-integrations, 04-components, 05-model, 06-flows |
| presenter | SRS-presenter.md | SDD-presenter.md | 02-rules, 03-domain, 04-usecases, 05-scenarios; 02-contracts, 04-components, 05-model |
| registry | SRS-registry.md | SDD-registry.md | 02-rules, 03-domain, 04-usecases, 05-scenarios; 02-contracts, 04-components, 05-model, 06-flows |

## Registries and generated

| File | State |
| --- | --- |
| `registry/index.yaml` | product.name WorshipDeck; `mode: deep`; `gates_passed: [G1, G2, G3, G4]` |
| `registry/components.yaml` | 3 PC `mode: deep`, containers `api` `spa` `pptx-worker`, LC-1…LC-20 + LC-23 (LC-21/22 retracted, folded into LC-11) |
| `registry/goals.yaml` | BG rows |
| `registry/requirements-*.yaml` | 3 files (one per PRD), FR-1…40 across them, `status: withdrawn` where retired |
| `registry/usecases.yaml` | UC-1…UC-32 |
| `registry/decisions.yaml` | DEC-001…058, all `applied` |
| `registry/specs.yaml` | 57 entries (W1…W11 retired ids kept, SPEC-1…57), 55 closed / 2 open |
| `generated/` | filled by `validate.py --generate` |

## Findings

- `.work/` exists at the repo root (committed scratch) and is not one of the five corpus roots. Purpose is stated in `AGENTS.md`; not unclaimed.
- `.scratch/` and `.archive/` are workspace, not corpus, roots — active and closed spec folders respectively (`corpus-guide.md`'s placement table names both); not listed under Top level above for that reason. See `structure-codebase.md` for their tree.
- `01-ux/` is absent on all three PCs; operator chrome tokens live in `.how/_platform/design-system.md` (DEC-001).
- `inventory.py` reads `cmd/api`, `spa/`, and shared `src/`; Host/Screen cells name DEC-003 containers.
- This refresh (2026-09-22) found `registry/requirements.yaml` and `registry/waves.yaml` — both named
  in the prior map — do not exist on disk; see Verified above for what replaced them. Corrected here
  rather than left standing, since a reader following this map to find FR/NFR or spec/ticket data
  would have landed on a nonexistent filename.
- DEC-003 retired container `web`; former `c4-l3-web.md` annotations live in `c4-l3-api.md` and `c4-l3-spa.md`.
- The `weekly-sabbath` PRD folder was withdrawn; history: `.control/memlog/prd-weekly-sabbath.md`.

---

★ = key document: single-copy, referenced from elsewhere, or the first thing a reader must find.

---
type: structure
scope: document
verified: 2026-08-22
commit: 052dcb6
---

# Document Structure

Written and refreshed only by `wdi-init` intent `structure`, never by hand. Rules live in
`.constitution/method/structure-guide.md`. Placement test: `.constitution/method/document/corpus-guide.md`.

## Verified

2026-08-22, derived from the tracked tree at `052dcb6`, honouring `.gitignore`. Drift closed in this
pass: `.control/decisions/` and `.control/meetings/` existed on disk and were absent from the map, and
the registry block listed five of its eight files — `waves.yaml` among the missing, which is the file
every wave record lives in.

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
│   ├── requirements.yaml     # FR/NFR, with status: retired where withdrawn
│   ├── usecases.yaml
│   ├── waves.yaml            # ★ wave records, stories, spec_reviewed traces
│   ├── decisions.yaml        # DEC index
│   ├── defects.yaml
│   └── risks.yaml
├── decisions/                # DEC-<n>-<slug>.md, one file per decision
├── questions/                # assumptions.md · blocking.md
├── memlog/                   # one per PC, plus spine.md
├── meetings/
├── generated/                # validate.py --generate; never hand-written
├── structure-document.md
├── structure-codebase.md
├── product-glossary.md
├── project-non-technical-log.md
└── wdi-method.yaml
```

`reports/` does not exist yet — it is born by the first archived retrospective (`RTR-<wave>.md`).

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
| `registry/index.yaml` | product.name Worship Presenter Web; `mode: deep`; `gates_passed: [G1, G2, G3, G4]` |
| `registry/components.yaml` | 3 PC `mode: deep`, containers `api` `spa` `pptx-worker`, LC-1…LC-16 |
| `registry/requirements.yaml` | BG · CAP · FR-1…28 · NFR · UJ |
| `registry/usecases.yaml` | UC-1…UC-23 |
| `registry/decisions.yaml` | DEC-001, DEC-002 applied; DEC-003 course-correction |
| `registry/waves.yaml` | W1 closed |
| `generated/` | filled by `validate.py --generate` |

## Findings

- `.work/` exists at the repo root (committed scratch) and is not one of the five corpus roots. Purpose is stated in `AGENTS.md`; not unclaimed.
- `01-ux/` is absent on all three PCs; operator chrome tokens live in `.how/_platform/design-system.md` (DEC-001).
- `inventory.py` reads `cmd/api`, `spa/`, and shared `src/`; Host/Screen cells name DEC-003 containers.
- DEC-003 retired container `web`; former `c4-l3-web.md` annotations live in `c4-l3-api.md` and `c4-l3-spa.md`.
- The `weekly-sabbath` PRD folder was withdrawn; history: `.control/memlog/prd-weekly-sabbath.md`.

---

★ = key document: single-copy, referenced from elsewhere, or the first thing a reader must find.

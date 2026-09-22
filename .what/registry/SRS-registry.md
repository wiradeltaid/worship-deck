---
type: srs
component: registry
status: draft
created: 2026-08-18
updated: 2026-08-20
satisfies: [FR-4, FR-5, FR-6, FR-20, FR-21, FR-29, FR-30, FR-31]
reviewed:
  date: '2026-09-23'
  sha: '840014f763d92094bb911b3c09f9fc53e4ef2aa3'
  lenses: [structure, prose, edge-case-hunter]
  note: 'Re-review of the delta since 840014f: a corpus-vs-code reconciliation pass closed all four Assumptions (OQ-24, OQ-15, OQ-14, OQ-32), each confirmed true against the actual code (see .control/questions/answered.md) — Assumptions and Open Items both cleared. No promise or FR changed.'
---

# SRS — Registry

## Decision Summary · [G3]

Registry owns Deck layout, order, and all announcement/flyer composition (Announcement Sets, DEC-004). Weekly content stays on the Service (Hub). A Snapshot protects a Service that has already been reviewed.

## Why · [G3]

Changing the worship order must not wait for a deploy, and must not overwrite a Service already reviewed on Friday.

## Actor Register · [G3]

| Actor | Who they are | What they may do |
| --- | --- | --- |
| Admin | Structure editor | Layout, order, add, rename, delete, Sync Artifact, Manual Device Sync to a second instance (UC-32, experimental) |
| Operator | Sees the result | Sees the Deck matching the payload; does not edit Registry |

## UC Catalogue · [G3]

UC Catalogue — see `.control/registry/usecases.yaml`, rows where `component: registry`.

## Constraints · [G3]

Not per-church configuration. Source: brief Scope Out; glossary Artifact Registry (one Registry, not per-church). AD-14 admin-only global templates.

Two surfaces: the Artifact Registry owns order, labels, layout, and announcement/flyer composition (each Announcement Set is its own ordered list of General slides, DEC-004); Hub owns weekly values only — song numbers/books/backgrounds per song-set entry, lyric overrides, names, verses, Family/Youth text and photos. Hub does not compose or reorder any announcement list any more (FR-3 retired). Neither surface does the other's job.

## Non-Goals · [G3]

- Fill weekly payload — Hub.
- Live control — Presenter.

## Prerequisite · [G3]

Predefined Field catalog is Admin-authored (DEC-058) — expanding it is an Admin action, not a code change, though the canvas validator's actual recognition of a newly Admin-created key is not yet wired to that table (SPEC-56). An unrecognised `{token}` never blocks generation (FR-30) — it renders empty and is flagged at save time, not at generate time.

## Success Signal · [G3]

A deleted entry stays deleted after restart. An old Service does not change until Sync.

## Assumptions, Risks, and To Be Confirmed · [G3]

### Assumptions

— (OQ-24, OQ-15, OQ-14, OQ-32 all closed 2026-09-23, confirmed true against code; see `.control/questions/answered.md`.)

### Risks

A Registry edit that makes lyrics unreadable (NFR-3).

### To Be Confirmed

—

## Gate Checklist · [G3]

★ UC titles are user sentences: yes. critical 2/7.

## Design Reference · [G3]

`.how/registry/SDD-registry.md`

## Slots

`mode: deep`. Rules: `02-rules/rules-registry.md` (BR-8…BR-13; BR-11 retired, superseded by DEC-004). Domain: `03-domain/domain-model.md`, `state-machines.md`, `deck-frame.md`. Flows: `04-usecases/UC-14-edit-layout.md` (amended DEC-004), `UC-15-reorder-and-delete.md` (critical, amended DEC-004), `UC-16-sync-artifact.md` (amended DEC-004), `UC-20-deck-matches-payload.md`, `UC-24-song-set-entries.md`, `UC-25-background-library.md`, `UC-32-manual-device-sync.md` (critical, experimental). Branches: `05-scenarios/SCN-5-delete-survives-restart.md`.

## Open Items

—

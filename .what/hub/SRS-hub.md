---
type: srs
component: hub
status: draft
created: 2026-08-18
updated: 2026-08-22
satisfies: [FR-1, FR-2, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14, FR-17, FR-18, FR-23, FR-24, FR-25, FR-27, FR-28, FR-32, FR-34]
reviewed:
  date: '2026-09-22'
  sha: 'e1558cc2a77eba95aa127700f639dc50a2c9fe15'
  lenses: [structure, prose, edge-case-hunter]
  note: 'Re-review of the delta since 6281284: the Actor Register row for Admin gained two new grants (UC-30 Rundown Parser Profiles, UC-31 Form Layout) backfilled by wdi-product/wdi-blueprint after SPEC-44/46 shipped them with no FR or UC of their own. The UC Catalogue pointer to usecases.yaml needs no edit — it already includes UC-30/31 by construction. Edge-case-hunter checked the new FR-36/FR-37 proof text (requirements-rundown-to-service.yaml, requirements-operator-turn.yaml) against the corresponding contract files (09-rundown-parser-profiles.md, 10-form-layout.md) for consistency — no contradiction found. Zero findings.'
---

# SRS — Hub

## Decision Summary · [G3]

Hub is the Operator's door: sign in, create a Service from this week's Rundown, list, Run-Sheet, edit, generate, download PPTX, accounts, language settings. **Not announcements** — composing them moved to the Artifact Registry when FR-3 was retired (DEC-004), which is why UC-21 below is struck through. This sentence listed them until 2026-08-22. Telegram via picoclaw (UC-1, UC-17) is last-phase intake, not this phase's handover.

## Why · [G3]

Without Hub, the multimedia turn falls back to one person assembling files. This component is the surface Operators call "the app".

## Actor Register · [G3]

| Actor | Who they are | What they may do |
| --- | --- | --- |
| Operator | Multimedia team | List, create, edit, generate, download, delete, Run-Sheet. **Not announcements** (FR-3 retired, DEC-004) |
| Events | Later: Rundown sender on Telegram | Not a Hub user this phase |
| Admin | Account and settings manager | Accounts, transitions, locale, Service form fields and layout (UC-31; UC-30 parser profiles retired per SPEC-70) |

## UC Catalogue · [G3]

UC Catalogue — see `.control/registry/usecases.yaml`, rows where `component: hub`.

UC-1 and UC-17 realise CAP-11 (Telegram, last phase). This phase's create path is UC-2.

UC-21's promise is withdrawn with FR-3: Hub no longer composes or reorders any announcement/flyer list — that is Registry UC-14 (edit a slide within an Announcement Set) and UC-15 (reorder/delete within it), per DEC-004. The one property of UC-21 that survives is asset reuse — a copied image shares one file by reference rather than a fresh upload each week — and it now lives on the Registry side, carried structurally by FR-21 (`offline-deck` PRD) rather than by anything Hub does.

## Constraints · [G3]

- Hub is not public — brief Constraints. Source: brief.
- Congregation data does not enter git — brief. Source: `.constitution/project/public-repository.md`.
- Create and edit share one field set and card order. Weekly values (hymn numbers, song books, backgrounds, names, verses, lyric corrections) are entered in Hub, not on the Artifact Registry. **Flyers are not among them any more** — they were until FR-3 was retired (DEC-004); an Announcement Set is authored structure in the Registry, and Hub only previews how it expands. Source: as-built forms; FR-27 · FR-11 · FR-32 · FR-34.

## Non-Goals · [G3]

- Assemble slide order — Registry.
- Projector / two-screen presenter — Presenter.
- Be a congregation website.

## Prerequisite · [G3]

Song Book is shipped. `WEBHOOK_SECRET` is for the later Telegram path (CAP-11, OQ-4).

## Success Signal · [G3]

Friday review ≤ 10 minutes; the Operator creates this week's Service in Hub without assembling PowerPoint.

## Assumptions, Risks, and To Be Confirmed · [G3]

### Assumptions

- OQ-17 — The Operator has this week's Rundown content in time to enter it in Hub. Wrong: no Service that week.
- OQ-2 — One church, one worship flow, for this product's scope. Wrong: Scope In is not enough.
- OQ-1 is parked on CAP-11 (Events parseable Rundown when Telegram ships).

### Risks

Payload holds photos and prayers until manual delete.

### To Be Confirmed

OQ-4 — When will the production host set `AUTH_SECRET`, `WEBHOOK_SECRET`, and a durable path for the database? External; not G3.

## Gate Checklist · [G3]

★ UC titles are user sentences: yes. ★ FR without a UC: FR-26 `no_uc`.

## Design Reference · [G3]

`.how/hub/SDD-hub.md`

## Slots

`mode: deep`. Rules: `02-rules/rules-hub.md`. Domain: `03-domain/domain-model.md`, `state-machines.md`. Full flow of each critical UC: `04-usecases/UC-1-events-send-rundown.md`, `UC-2-paste-rundown-hub.md`, `UC-5-edit-service-fields.md`, `UC-7-delete-service.md`, `UC-17-telegram-correction.md`, `UC-28-correct-song-lyrics.md`. Branches: `05-scenarios/SCN-1-unknown-hymn.md`, `SCN-2-save-conflict.md`, `SCN-3-correction-without-target.md`, `SCN-4-lyric-save-to-book-race.md`. Physical field names: `.how/hub/05-model/form-fields.md`.

## Open Items

OQ-17 · OQ-2 · OQ-4. OQ-6 answered (DEC-003). OQ-1 is parked on CAP-11. Taken and encoded here: OQ-20 (generate is not a payload edit; BR-4 is UC-5) · OQ-21 (no readable date → no row; named date with no Service rejects, no nearest-Sabbath fallback) · OQ-22 (unparseable Hub body with a date still saves what was readable; Telegram images attach or fail visibly) · OQ-23 (gone on re-read is UC-7 not-found; session expiry at save/delete rejects with no partial write).

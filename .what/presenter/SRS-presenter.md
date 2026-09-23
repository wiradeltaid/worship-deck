---
type: srs
component: presenter
status: draft
created: 2026-08-18
updated: 2026-08-22
satisfies: [FR-15, FR-16, FR-19, FR-22, FR-33, FR-35]
reviewed:
  date: '2026-09-23'
  sha: 'bc6c6949c0c1e63f5b57808653155579714999c2'
  lenses: [structure, prose]
  note: 'Re-review of the delta since bc6c694: a corpus-vs-code reconciliation pass found the Assumptions section still called plan identity "deferred" (AD-10) even though SDD-presenter.md already corrected this fact — an internal corpus contradiction, not merely stale wording. Closed OQ-5 and OQ-26 (split: two clauses confirmed shipped, two clauses reopened as OQ-60 with the exact remaining gap named). Assumptions and Open Items corrected to match. No promise or FR changed.'
---

# SRS — Presenter

## Decision Summary · [G3]

Presenter is the Sabbath turn in the browser: slideshow, two screens, on-demand verse. The offline guarantee remains PPTX (Hub UC-18).

## Why · [G3]

The Operator needs a control screen separate from what the Congregation sees. That is not Hub (prep) and not Registry (structure).

## Actor Register · [G3]

| Actor | Who they are | What they may do |
| --- | --- | --- |
| Operator | On-duty at the venue laptop | Slideshow, presenter, projector, verse |
| Congregation | Screen audience | Do not open this surface |

## UC Catalogue · [G3]

UC Catalogue — see `.control/registry/usecases.yaml`, rows where `component: presenter`.

## Constraints · [G3]

Operator Chrome does not reach the room screen. Source: AD-24 (adopted) in the spine.

A remote control device (UC-29, DEC-006) is an **input to this component, never a second controller**: it sends intents to the presenting client, and the presenting client stays the only sender the projector follows. The laptop-to-projector path MUST keep working with the remote closed, asleep, or off the network — the room screen never depends on connectivity (AD-37, and AD-1's offline guarantee behind it). Reaching a presenting client is a deliberate act, not a consequence of being signed in.

A live background switch (UC-27, DEC-004) changes what the projector shows for the current Verse/Reff slide only; it never rewrites the Service payload or the Registry, and it does not survive past this session the way a Sync Artifact does — the next generate still resolves the background through the normal order (weekly choice → global default → blank).

## Non-Goals · [G3]

- Edit weekly payload — Hub.
- Change slide order live — brief Scope Out.
- Offline guarantee — Hub FR-14.

## Prerequisite · [G3]

A Service already exists. Verse overlay (FR-19) requires the two-screen presenter (FR-16).

## Success Signal · [G3]

Projector shows only slides. Blank does not itself shift Deck position. Slideshow order matches the Deck/PPTX. A verse overlay leaves the Service payload unchanged.

## Assumptions, Risks, and To Be Confirmed · [G3]

### Assumptions

PPTX remains the offline guarantee; the browser slideshow is best-effort after one Service is loaded (AD-1, OQ-5 closed 2026-09-23).

Blank covers an open overlay; unblank reveals that overlay if it is still open. Reload of control or projector resends index, overlay, and blank.

Plan identity travels on every shared-state message on the presenter channel — shipped (AD-10, OQ-26 closed 2026-09-23). Empty verse reference fails closed (SCN-4). Lookup timeout and no-projector-refuse-lookup remain open (OQ-60). A missing Service returns to Hub as UC-11; a present Service with an empty plan does not redirect the same way (OQ-60).

### Risks

Slideshow is mistaken for the Sabbath guarantee.

### To Be Confirmed

—

## Gate Checklist · [G3]

★ UC titles are user sentences: yes.

## Design Reference · [G3]

`.how/presenter/SDD-presenter.md`

## Slots

`mode: deep`. No `critical` UC. Rules: `02-rules/rules-presenter.md`. Domain: `03-domain/domain-model.md`, `state-machines.md`. Component flows: `04-usecases/UC-11-fullscreen-slideshow.md`, `UC-12-two-screen-presenter.md`, `UC-13-on-demand-verse.md`, `UC-27-live-background-switch.md`. Branches: `05-scenarios/SCN-4-verse-lookup-failed.md`, `SCN-6-remote-drops-mid-service.md`.

## Open Items

OQ-60

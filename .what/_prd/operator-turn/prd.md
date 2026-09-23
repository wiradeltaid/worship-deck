---
title: "Operator Turn"
initiative: operator-turn
status: draft
created: 2026-08-18
updated: 2026-08-20
---

# PRD: Operator Turn

> **This is the working PRD.** It cites requirement ids instead of repeating their text, so §3 lists
> `FR`/`NFR` by id, and there is no Glossary, Non-Goals, Open Questions, or Assumptions Index section
> here — each of those facts has its own home.
>
> **To read or hand over one complete, self-contained document, run `/wdi-report render prd`.**
> It writes `.what-rendered/_prd/operator-turn/prd.md` with the capabilities, the requirement
> statements and proofs of done, the glossary terms this PRD uses, the non-goals, and the open
> questions filled in from their own homes. That file is regenerated, never hand-edited.

## Revision History

| Date | What changed | Why | Releases affected |
|---|---|---|---|
| 2026-08-18 | This initiative was born from the `weekly-sabbath` split. Area: logged-in Hub, Friday review, Run-Sheet, slideshow/presenter, on-demand verse, accounts, two language axes. FR-8…11, FR-13, FR-15…19, FR-22…25, FR-28. | A reader looking for “Friday review” or “projector screen” does not open the generate PRD. | as-built |
| 2026-08-20 | The Hub form's weekly song fields now track whatever song-set list Admin has configured in the Registry, not a fixed four (FR-32). FR-23's promise is confirmed and sharpened: a song-set entry may pick its own Song Book, or fall back to the Admin-set global default, and more than one book may be in use in the same Service. Two new promises: the Operator may change the live Verse/Reff background during the service itself (FR-33), and the Operator may edit a song's lyrics for one Service only, with a separate explicit action to save the correction back to the Song Book (FR-34). | Owner ratified DEC-004: song-set count, song-book choice, live background, and lyric correction all became things the Operator or Admin does at the weekly/live layer, not fixed at the code layer. | as-built · later |
| 2026-08-22 | One new promise: the Operator may control the presenting laptop from a second signed-in device — a phone — and see the same presenter view there (FR-35). The remote is additive: connecting is a deliberate step rather than a consequence of being signed in, and the laptop keeps driving the room screen when the phone is absent, asleep, or off the network. | Owner asked for the projection to be remotable from a phone, and chose the shape when offered two: the phone is a remote **for the laptop**, not a second thing the projector follows. The rejected alternative — a phone that drives the projector with the laptop off — would have made the room screen depend on connectivity, which the product's own offline guarantee is built to avoid. | later |
| 2026-09-22 | FR-37 added: Admin configures the Hub form's fields and their grouping through named Predefined Fields and Form Layouts, not a code change. SPEC-46 cited FR-20/FR-21/FR-32 for traceability, but none of them states this specific promise; this row makes it explicit to match the built behaviour. A related architecture claim — that a new Predefined Field key is a code change (AD-19/AD-32) — no longer holds either; see DEC-058. | `wdi-reconcile` found the shipped feature had no `FR` stating its own promise, no `UC`, and no G4 depth anywhere in the corpus — the gate sequence was skipped under an autopilot mandate. This row closes the G2 half of that gap. | as-built |

## 1. Why This Initiative

<!-- wdi-upgrade 0.6.1: sentences duplicated word-for-word in the brief's Why were removed; the
     rest is left here under this comment because deciding which paraphrases are copies of the
     brief's narrative, versus this initiative's own delta, is the owner's call — not this pass's. -->

Anyone on the rotation can review on Friday in ≤ 10 minutes and present on Sabbath, without assembling 68 slides. Logged-in Hub. In-browser Presenter is a complement; the guarantee remains the PPTX in the `offline-deck` PRD.

## 2. Target User

Primary: **Operator**. Secondary: Admin (accounts, `ui_locale`, default corpus).

### 2.1 Jobs To Be Done

- Friday review: match data, edit, regenerate, download.
- Sabbath: presenter view; on-demand verse if the speaker asks.
- Admin: per-person accounts; interface language; default corpus.

### 2.2 Non-Users

Events while *sending* a Rundown. The congregation.

### 2.3 Key User Journeys

- **UJ-2.** Friday review ≤ 10 minutes.
- **UJ-3.** Late song swap, regenerate ≤ 5 minutes.
- **UJ-4.** Presenting — PPTX (guarantee, other PRD) or browser presenter (complement).

## 3. Features

### 3.1 Hub

**Capability:** CAP-3 — serves BG-2.

**Realizes:** FR-8, FR-9, FR-10

### 3.2 Edit and regenerate

**Capability:** CAP-4 — serves BG-2.

**Realizes:** FR-11, FR-13, FR-28, FR-32, FR-34, FR-37

### 3.3 Run-Sheet

**Capability:** CAP-7 — serves BG-2.

**Realizes:** FR-17

### 3.4 Slideshow and Presenter

**Capability:** CAP-6 — serves BG-2.

**Realizes:** FR-15, FR-16, FR-19, FR-33, FR-35

### 3.5 Accounts

**Capability:** CAP-8 — serves BG-2.

**Realizes:** FR-18

### 3.6 Corpus and two language axes

**Capability:** CAP-10 — serves BG-2.

**Realizes:** FR-22, FR-23, FR-24, FR-25

## 4. MVP Scope

### 4.2 Out of Scope for MVP

- Not a public site.
- Not `projection_locale`.
- Not a materials CMS.

## 5. Success Metrics

13 consecutive Sabbaths (brief). Friday review ≤ 10 minutes. The turn ≠ the person who can do PowerPoint.

## 6. Cross-Cutting NFRs

NFR-6 binds FR-18. NFR-5 is visible on Hub edit if the parser fails.

## 7. Constraints and Guardrails

The Hub is by account. No other delta beyond the brief.

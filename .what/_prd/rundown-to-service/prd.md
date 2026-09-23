---
title: "Rundown to Service"
initiative: rundown-to-service
status: draft
created: 2026-08-18
updated: 2026-08-20
---

# PRD: Rundown to Service

> **This is the working PRD.** It cites requirement ids instead of repeating their text, so §3 lists
> `FR`/`NFR` by id, and there is no Glossary, Non-Goals, Open Questions, or Assumptions Index section
> here — each of those facts has its own home.
>
> **To read or hand over one complete, self-contained document, run `/wdi-report render prd`.**
> It writes `.what-rendered/_prd/rundown-to-service/prd.md` with the capabilities, the requirement
> statements and proofs of done, the glossary terms this PRD uses, the non-goals, and the open
> questions filled in from their own homes. That file is regenerated, never hand-edited.

## Revision History

| Date | What changed | Why | Releases affected |
|---|---|---|---|
| 2026-08-18 | This initiative was born. The `weekly-sabbath` folder was withdrawn: too global — one PRD for the whole product. This area only promises that a **Rundown becomes a Service**. FR-1, FR-2, FR-3, FR-12, FR-27. IDs were not restarted. | BIMA pattern: one PRD per functional area a reader would look for, not per product. | as-built |
| 2026-08-19 | Current intake is the Operator in Hub (FR-27), not Events on Telegram. Hymn resolve and the announcement list stay. Telegram via picoclaw (FR-1, FR-12) remains in this PRD as the last-phase capability, not a second PRD. | Web is cheaper and easier to stabilize first; Events are skipped this phase; `FR-N` must not move between PRDs. | as-built · later |
| 2026-08-20 | FR-3 is retired. Hub no longer manages an announcement list at all — composing, ordering, and deleting announcement content now happens only in the Artifact Registry (`offline-deck` FR-21), as N independent Announcement Sets Admin authors directly. The part of FR-3 that mattered to the Operator — that the same flyer image is not re-uploaded every week — is kept as a promise, just moved: FR-21 promises copied images share one file by reference, so an Announcement Set built once keeps working week after week without a fresh upload. | Owner ratified DEC-004: an Announcement row expanding "the whole live Hub list" was void; membership and order are Admin-authored structure, not a weekly Hub list the Operator maintains. | as-built · later |
| 2026-09-22 | FR-36 added: Admin configures the Rundown parser through named profiles instead of a code change. SPEC-44 cited FR-1/FR-2/FR-27/FR-32 for traceability, but none of them states this specific promise; this row makes it explicit to match the built behaviour. | `wdi-reconcile` found the shipped feature had no `FR` stating its own promise, no `UC`, and no G4 depth anywhere in the corpus — the gate sequence was skipped under an autopilot mandate. This row closes the G2 half of that gap. | as-built |

## 1. Why This Initiative

<!-- wdi-upgrade 0.6.1: sentences duplicated word-for-word in the brief's Why were removed; the
     rest is left here under this comment because deciding which paraphrases are copies of the
     brief's narrative, versus this initiative's own delta, is the owner's call — not this pass's. -->

The Operator logs into Hub, enters a Rundown, and gets one dated Service with lyrics resolved from the Song Book — not typed, not copied from last week's file. Later, Events send that Rundown on Telegram and picoclaw fills the same Service; that path is last-phase, not this work.

## 2. Target User

Primary in this area: **Operator**. Secondary (later): Events.

### 2.1 Jobs To Be Done

- Operator: log in, create this week's Service from a Rundown paste or form, see hymn titles resolved from numbers.
- Later — Events: send a Rundown and images like an ordinary chat; get a hymn-title read-back; correct a song without opening Hub.

### 2.2 Non-Users

The congregation. An Admin who edits the Registry. The Operator while *presenting* (that is `operator-turn`). Events **this phase** — they do not hand over a Rundown yet.

### 2.3 Key User Journeys

- **UJ-5. Operator creates a Service in Hub.** Log in; paste or fill a Rundown; a dated Service is stored; hymn numbers show titles from the Song Book.
- **UJ-1. Events send a Rundown on Telegram.** Later. Paste text and images; picoclaw interprets; the Service is stored; a hymn-title read-back returns to the chat.

## 3. Features

### 3.1 Hub form — this phase

**Capability:** CAP-1 — serves BG-1.

**Description:** The Operator creates a Service in Hub. Lyric resolve is in the API (FR-2), not a web search. Realizes UJ-5.

**Realizes:** FR-27, FR-2, FR-36 (FR-3 retired 2026-08-20 — see Revision History; its Operator-facing promise moved to `offline-deck` FR-21)

### 3.2 Telegram intake — last phase

**Capability:** CAP-11 — serves BG-1.

**Description:** picoclaw interprets the Rundown and calls the API. Not this phase's work. Realizes UJ-1.

**Realizes:** FR-1, FR-12

## 4. MVP Scope

### 4.2 Out of Scope for MVP

- Not Deck generate, not PPTX download.
- Not presenter, not accounts.
- Not a song-search engine / Song Book upload.
- Not Events using Hub this phase.
- Not announcement composition — that is `offline-deck`'s Artifact Registry, Admin-only (FR-3 retired).

## 5. Success Metrics

The Operator creates the week's Service in Hub without assembling PowerPoint. A wrong hymn number is visible on the form before Friday. Events are not required for a Service to exist.

Counter-metric: treating the existing webhook as this phase's handover path.

## 6. Cross-Cutting NFRs

**NFR-5** (failure is visible) binds FR-27 and FR-2 this phase, and FR-1 when CAP-11 ships. Other NFRs belong to the area that enforces them.

## 7. Constraints and Guardrails

Current intake is the logged-in Hub. Telegram and picoclaw MUST NOT be scheduled as this phase's work. Lyrics only from the shipped Song Book.

---
title: "Offline Deck"
initiative: offline-deck
status: draft
created: 2026-08-18
updated: 2026-08-20
---

# PRD: Offline Deck

> **This is the working PRD.** It cites requirement ids instead of repeating their text, so §3 lists
> `FR`/`NFR` by id, and there is no Glossary, Non-Goals, Open Questions, or Assumptions Index section
> here — each of those facts has its own home.
>
> **To read or hand over one complete, self-contained document, run `/wdi-report render prd`.**
> It writes `.what-rendered/_prd/offline-deck/prd.md` with the capabilities, the requirement
> statements and proofs of done, the glossary terms this PRD uses, the non-goals, and the open
> questions filled in from their own homes. That file is regenerated, never hand-edited.

## Revision History

| Date | What changed | Why | Releases affected |
|---|---|---|---|
| 2026-08-18 | This initiative was born from the `weekly-sabbath` split. Area: assemble the Deck, download PPTX, file retention, Artifact Registry. FR-4…7, FR-14, FR-20, FR-21, FR-26. | A reader looking for “the Sabbath file” or “change slide order” does not open the intake PRD. | as-built |
| 2026-08-19 | FR-5 proof names the shipped lyric join and chorus repeat. FR-21 proof names that each Announcement registry row expands the whole live list and that repeats are intended. | Those rules lived only in a G5-era spec; a later wave must project them, not invent them. | as-built · later |
| 2026-08-20 | FR-21 no longer promises that an Announcement row expands the whole live Hub list. The Registry spine may now carry any number of independent Announcement Sets, each its own authored slide sequence Admin composes directly in the Registry; copied images share one file by reference so deleting a slide never deletes an asset still used elsewhere. FR-20's shared Title/Verse/Reff trio is confirmed to cover every song-set entry, however many Admin defines — there is no fixed count of song-set rows any more. Three new promises are born: Admin defines the song-set list itself here (FR-29), an unrecognised `{token}` in authored text never stops a Deck from generating (FR-30), and Admin now maintains an image-only background library with one global default for the blank Verse/Reff canvas (FR-31). | Owner ratified DEC-004: Announcement composition and the song-set count both moved from a Hub-owned, code-fixed shape to Admin-authored structure inside the Artifact Registry. | as-built · later |
| 2026-09-22 | Three promises backfilled to match shipped behaviour. FR-38 makes explicit that FR-31's background library (SPEC-39/40) is one shared image store also serving Announcement Sets, not backgrounds alone — no new table, an existing promise widened. FR-39 makes explicit a promise SPEC-32 shipped and cited only against FR-20's general layout promise: Admin installs custom fonts, embedded into PPTX. A new capability, Manual Device Sync (CAP-12), promises Admin can push/pull Services and Registry assets between two WorshipDeck instances on demand (FR-40, SPEC-47) — stated as **experimental**, since only same-instance exchange is confirmed working (`docs/threat-model.md` §3.7). | `wdi-reconcile` found each of the three had shipped citing only an adjacent FR or none, never a statement of its own specific promise. This row closes the G2 half of that gap; FR-40's wording does not overclaim what is verified. | as-built |

## 1. Why This Initiative

<!-- wdi-upgrade 0.6.1: sentences duplicated word-for-word in the brief's Why were removed; the
     rest is left here under this comment because deciding which paraphrases are copies of the
     brief's narrative, versus this initiative's own delta, is the owner's call — not this pass's. -->

A Deck is no longer a copy of last week's file. It is generated from the frame plus the Service payload, can be downloaded, and presents without venue internet. An Admin changes layout and order without waiting for a deploy — structure, not this week's content.

## 2. Target User

Primary: **Operator** (downloads). Secondary: **Admin** (Registry).

### 2.1 Jobs To Be Done

- Operator: have a complete PPTX on the laptop before Sabbath.
- Admin: change slide layout/order; a Service already reviewed does not change underneath them.

### 2.3 Key User Journeys

Does not add a new UJ. UJ-4 (brief) for *presenting* the PPTX; UJ-2 for the review that uses this file.

## 3. Features

### 3.1 Assemble Deck

**Capability:** CAP-2 — serves BG-1.

**Realizes:** FR-4, FR-5, FR-6, FR-7

### 3.2 Offline PPTX

**Capability:** CAP-5 — serves BG-3.

**Realizes:** FR-14, FR-26

### 3.3 Artifact Registry

**Capability:** CAP-9 — serves BG-1.

**Realizes:** FR-20, FR-21, FR-29, FR-30, FR-31, FR-38, FR-39

### 3.4 Manual Device Sync — experimental

**Capability:** CAP-12 — serves BG-3.

**Description:** Not the offline PPTX guarantee (FR-14) and not a replacement for it — a second, independent path for keeping a backup instance current. Genuinely cross-machine operation is unverified; see `docs/threat-model.md` §3.7 before relying on it.

**Realizes:** FR-40

## 4. MVP Scope

### 4.2 Out of Scope for MVP

- Browser slideshow as an offline *guarantee* (that is best-effort in `operator-turn`).

## 5. Success Metrics

Song swap + generate + download ≤ 5 minutes. Zero leftover last-week metadata.

## 6. Cross-Cutting NFRs

NFR-1, NFR-2, NFR-3, NFR-4, NFR-7, NFR-8, NFR-9 — `enforced_by` in `requirements-offline-deck.yaml`.

## 7. Constraints and Guardrails

PPTX is the guarantee, not a fallback. Public repo: no congregation data in git. An image predefined field (e.g. a photo) stays its own slide element with its own box — it is never a token mixed into text. No other delta beyond the brief.

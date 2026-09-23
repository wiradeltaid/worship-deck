---
topic: PRD Offline Deck
artifact: .what/_prd/offline-deck/prd.md
updated: 2026-09-22T16:10
---

- (decision) Generate/PPTX/Registry area: FR-4..7, FR-14, FR-20, FR-21, FR-26.
- (event by user) Owner set policy.doc_language and doc_filename_language to English and overrode the language-guide default: existing corpus migrated. Markers [MISSING] [ASSUMED] [PARTIAL]; critical column yes/no. Filename slugs English (e.g. rundown-to-service, UC-7-delete-service).
- (event) Link repair after English slug migration: source-material paths expanded to prior-knowledge/; deferred-work citations now the archive file; Artifact reset route written in full; BMad custom config pins document_output_language English.
- (event by user) Owner held G2 for this PRD: offline-deck still stands.
- (event) wdi-product verify: promises unchanged after Hub-first recut. No bmad-prd update.
- (event) Landed lyric join/chorus (FR-5) and Announcement whole-list expansion (FR-21) from as-built code + owner-ratified spec CAP-7. No new FR ids.
- (change) Addendum wording: DEC-002 — W1 retires its prior-knowledge slice at close. Promise unchanged.
- (change) DEC-004 (accepted 2026-08-20): FR-21 rewritten — Announcement Sets are N independent Admin-authored sequences in the Registry, not a Hub-list expander; images share by reference. FR-20 confirmed for the shared trio at any song-set count. New FR-29 (song-set list), FR-30 (unknown token never blocks generation), FR-31 (background library + global default). No owner channel this run; Supplement S1-S13 is the answer key.
- (event) bmad-review equivalent pass (subagent) run against prd-guide.md: FR-29 proof reworded off implementation vocabulary ('variable name' -> 'name'); glossary alphabetical order fixed (PPTX before Predefined Field). owns: gap reported, not fixed here: components.yaml hub.owns still lists AnnouncementItem though FR-3 retired and registry.owns has no Announcement Set entity — routed to wdi-init/wdi-blueprint.
- (event by wdi-product) FR-38 (media library), FR-39 (custom fonts) added under existing CAP-9. New CAP-12 (Manual Device Sync, goal BG-3) + FR-40 added, worded to reflect only-verified-same-instance status (docs/threat-model.md 3.7), priority: should not must. Backfilled: SPEC-47 shipped all three under an autopilot mandate with no FR ever written. Landed in requirements-offline-deck.yaml, cited from prd.md 3.3/new 3.4, one Revision History row. Next: wdi-blueprint catalog intent adds the 3 UCs; wdi-component writes G4 depth for Registry.
- (event by wdi-product) Correction to the prior entry: FR-38 (media library) and FR-39 (fonts) are NOT SPEC-47 features — verified by tracing code: media-library routes share the exact same Go handlers as the pre-existing background-library routes (same background_library_images table, category column distinguishes background vs announcement, SPEC-39/40, well before SPEC-47); fonts date to SPEC-32 and already cited FR-20/UC-14 loosely. Corrected FR-38's text to describe it as widening FR-31, not a new independent capability; corrected the Revision History row and glossary (merged 'Media Library' into the Background Library glossary entry rather than a sibling entry). Only FR-40 (Manual Device Sync) is genuinely SPEC-47 with no prior FR of any kind.

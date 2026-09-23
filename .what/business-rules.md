# Cross-component rules

There are no extra `BR-N` rows. Rules that bind more than one PC are already `AD-N` in the spine; copying them here would make two versions.

| AD | Reach |
| --- | --- |
| AD-1 | Hub downloads PPTX; Presenter is not the offline guarantee |
| AD-5 | All routes and pages on `web` |
| AD-6 | Hub Service mutations and Registry / Sync writes |
| AD-7 | Hub generates, Registry structure, Presenter displays |
| AD-8 | Hub upload/announcements; Registry assets |
| AD-9 | Schema of all three PCs |
| AD-12 | Hub render (preview/PPTX) and Presenter |
| AD-23 | Hub settings and all display surfaces |
| AD-24 | Hub chrome vs Presenter screen |
| AD-26 | Presenter verses |
| AD-36 | Hub hymns / song-book bootstrap-once seed (superseded AD-25's hymn half, DEC-005, 2026-08-20) |

Rules that bind only one PC: `.what/<pc>/02-rules/`.

**BR-11 (Registry) is retired (DEC-004).** It used to reach Hub — an Announcement registry row expanded Hub's live announcement list, and Hub owned membership. Announcement composition moved entirely into the Registry as N independent Announcement Sets; Hub owns no announcement membership or ordering any more (FR-3 retired, superseded by FR-21). The rule that replaces it, BR-12, binds only Registry and lives at `.what/registry/02-rules/rules-registry.md` — there is no cross-component reach left to record here.

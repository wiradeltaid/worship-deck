# 04: Dynamic Song Sets 3-Pass Matching and Slot Omission

**What to build:**
Implement the 3-pass hybrid matching algorithm that maps parsed song candidates into configured song set entry slots with multi-book resolution, while ensuring that empty song slots in a slot family are omitted from the live presentation plan.

**Blocked by:** 03 (TypeScript Parser Engine Parity and Shared Golden Fixtures)

**Status:** ready-for-agent

- [ ] Implement Pass 1: match explicitly labeled song lines against song set entries configured with matching labels (e.g. "Opening Song", "Closing Song").
- [ ] Implement Pass 2: sequentially map unlabeled hymn/praise candidates into available slot family entries (e.g. `praise_song_1..5`) sorted by `song_set_entries.position`.
- [ ] Implement Pass 3: capture unassigned songs in `songOverflow` and unfilled slots in `songSlotsUnfilled` in the parser output diagnostics.
- [ ] Resolve song book codes from extracted prefix aliases (e.g. "Lagu" -> NKI, "KJ" -> KJ, "SDAH" -> SDAH) falling back to the configured global default song book.
- [ ] In `src/lib/slide-plan.ts` and `internal/plan/plan.go`, verify that song set entry slots without weekly inputs produce zero slides in both web presentation and PPTX generation (omission contract).
- [ ] Executable Absence Guard: inject an empty song slot into the plan output and prove test failure when the omission rule is broken.

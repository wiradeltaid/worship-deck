---
artifact: .control/decisions/DEC-065-daily-autopilot-mandate-parser-profile-retirement-and-song-set-extraction.md
---

# Autopilot Ledger — DEC-065

## Resume

- Iteration: 1
- Run branch: autopilot/DEC-065
- Stopped at: SPEC-70-01 completed; ready for SPEC-70-02
- Blocked: —
- Parked: —
- Next: SPEC-70-02 execution

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-065 for Complete Rundown Parser Profile Retirement and Section-Scoped Song Set Extraction (SPEC-70, SPEC-71) | waiting for interactive manual dispatch | low | .control/decisions/DEC-065-daily-autopilot-mandate-parser-profile-retirement-and-song-set-extraction.md |
| I-1 (SPEC-70-01) | FormLayoutAdminPanel.tsx | Retire sandbox defaultProfile state and /api/parser-profiles fetch, evaluate dynamic song regexes directly, delete orphaned ParserProfilesPanel.tsx, remove overflowSongs state and Lagu Melebihi Slot banner, verified by Terra peer review and physical defect injection absence guards | retaining misleading legacy parser profile state and alarming overflow banners in sandbox admin | medium | src/components/admin/FormLayoutAdminPanel.tsx, src/components/admin/ParserProfilesPanel.tsx, tests/smoke-spec-54.test.mjs, .scratch/SPEC-70-complete-rundown-parser-profile-and-song-overflow-retirement/issues/01-retire-sandbox-parser-profile-and-song-overflow.md |

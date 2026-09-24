---
artifact: .control/decisions/DEC-065-daily-autopilot-mandate-parser-profile-retirement-and-song-set-extraction.md
---

# Autopilot Ledger — DEC-065

## Resume

- Iteration: 2
- Run branch: autopilot/DEC-065
- Stopped at: SPEC-70 closed; ready for SPEC-71-01
- Blocked: —
- Parked: —
- Next: SPEC-71-01 execution

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-065 for Complete Rundown Parser Profile Retirement and Section-Scoped Song Set Extraction (SPEC-70, SPEC-71) | waiting for interactive manual dispatch | low | .control/decisions/DEC-065-daily-autopilot-mandate-parser-profile-retirement-and-song-set-extraction.md |
| I-1 (SPEC-70-01) | FormLayoutAdminPanel.tsx | Retire sandbox defaultProfile state and /api/parser-profiles fetch, evaluate dynamic song regexes directly, delete orphaned ParserProfilesPanel.tsx, remove overflowSongs state and Lagu Melebihi Slot banner, verified by Terra peer review and physical defect injection absence guards | retaining misleading legacy parser profile state and alarming overflow banners in sandbox admin | medium | src/components/admin/FormLayoutAdminPanel.tsx, src/components/admin/ParserProfilesPanel.tsx, tests/smoke-spec-54.test.mjs, .scratch/SPEC-70-complete-rundown-parser-profile-and-song-overflow-retirement/issues/01-retire-sandbox-parser-profile-and-song-overflow.md |
| I-2 (SPEC-70-02) | backend & client lib | Retire parser-profile routes and handlers in Go, decouple parser from database to static built-in liturgy, retire matchSongSets and songOverflow from TypeScript, update corpus to mark UC-30 and parser profile contracts retired, verified by Terra peer review | retaining dormant dead parser profile routes and 3-pass legacy algorithms | medium | internal/httpapi/server.go, internal/httpapi/parser_profiles.go, internal/httpapi/services.go, internal/httpapi/webhook.go, internal/parse/parser.go, internal/parse/profile.go, internal/parse/song_set_matching.go, src/lib/song-set-matching.ts, src/lib/parser-rules.ts, src/lib/parser.ts, .control/registry/usecases.yaml, .what/hub/SRS-hub.md, .how/hub/SDD-hub.md, .how/hub/02-contracts/09-rundown-parser-profiles.md, .how/hub/02-contracts/00-inventory.md, .how/_platform/inventory-api.md, tests/song-set-matching.test.mjs, tests/smoke-spec-44.test.mjs, tests/dynamic-field-extraction.test.mjs, .control/registry/specs.yaml |

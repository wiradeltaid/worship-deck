---
artifact: .control/decisions/DEC-063-daily-autopilot-mandate-song-set-regex-and-parser-menu.md
---

# Autopilot Ledger — DEC-063

## Resume

- Iteration: 1
- Run branch: autopilot/DEC-063
- Stopped at: Mandate DEC-063 completed — SPEC-68 delivered through G5 Release
- Blocked: —
- Parked: —
- Next: Maintainer review and merge of PR

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-063 for Song Set Regex Editing and Parser Profile Menu Removal (SPEC-68) | waiting for interactive manual dispatch | low | .control/decisions/DEC-063-daily-autopilot-mandate-song-set-regex-and-parser-menu.md |
| I-1 (SPEC-68-01) | FormLayoutAdminPanel.tsx & smoke-spec-54.test.mjs | Remove obsolete Advanced Parser Profiles menu tab and view while preserving backend profile endpoints/storage, verified by defect injection absence guard | keeping confusing retired parser profile UI | medium | src/components/admin/FormLayoutAdminPanel.tsx, tests/smoke-spec-54.test.mjs |
| I-1 (SPEC-68-02) | song_set_entries HTTP API & Admin UI | Serialize extraction_regex in song set entry list endpoints, support atomic PATCH/PUT/POST regex editing with client-side syntax validation and layout slot parity | keeping song set regex hidden and requiring non-atomic split API updates | high | internal/httpapi/song_set_entries.go, internal/httpapi/song_set_entries_test.go, src/components/admin/SongSetEntriesPanel.tsx, src/components/admin/FormLayoutAdminPanel.tsx, src/lib/parser-rules.ts, src/lib/song-set-matching.ts, tests/dynamic-field-extraction.test.mjs |

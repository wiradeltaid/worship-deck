---
artifact: .control/decisions/DEC-066-daily-autopilot-mandate-rundown-regex-sandbox-parity-unmapped-lines-pruning.md
---

# Autopilot Ledger — DEC-066

## Resume

- Iteration: 1
- Run branch: autopilot/DEC-066
- Stopped at: Mandate DEC-066 completed — SPEC-72 delivered through G5 Release
- Blocked: —
- Parked: —
- Next: Maintainer review and merge of PR

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-066 for Rundown Regex Sandbox Parity and Unmapped Lines Pruning (SPEC-72) | waiting for interactive manual dispatch | low | .control/decisions/DEC-066-daily-autopilot-mandate-rundown-regex-sandbox-parity-unmapped-lines-pruning.md |
| I-1 (SPEC-72-01) | FormLayoutAdminPanel.tsx & parser-rules.ts | Implement single regex evaluation parity with multiline dotall evaluation, stateful regex reset (lastIndex = 0), and capture token offset pinpointing via indices.groups.number and d flag, verified by Terra peer review | retaining line-by-line limitation and false "No match found" in sandbox | medium | src/components/admin/FormLayoutAdminPanel.tsx, src/lib/parser-rules.ts, tests/dynamic-field-extraction.test.mjs, .scratch/SPEC-72-rundown-regex-sandbox-parity-and-unmapped-lines-pruning/issues/01-sandbox-multiline-regex-evaluation-parity.md |
| I-2 (SPEC-72-02) | parser.go, services.go, parser-rules.ts | Normalize non-breaking spaces ( ) uniformly across Go and TS, and reconcile unmapped lines using exact SourceLine provenance and domain-scoped regex guarding against collisions with Room 614 or Attendance 614, verified by Go unit, Go HTTP API preview, and TS test suites | leaving successfully extracted song lines in unmappedLines warning banner or accidentally pruning unrelated lines | medium | internal/parse/parser.go, src/lib/parser-rules.ts, src/components/admin/FormLayoutAdminPanel.tsx, internal/parse/dynamic_extraction_test.go, internal/httpapi/services_field_values_test.go, tests/dynamic-field-extraction.test.mjs, .scratch/SPEC-72-rundown-regex-sandbox-parity-and-unmapped-lines-pruning/issues/02-prune-dynamically-mapped-lines-and-normalize-whitespace.md, .control/registry/specs.yaml |

## Smoke Test Results

- FR-32 (Dynamic Song Set Suggestions & Regex Extraction): PASS — multiline dotall regex evaluation works seamlessly in sandbox and intake without false unmapped line warnings.
- FR-36 (Parser Configuration & Sandbox Parity): PASS — regex evaluation sandbox exhibits 100% production parity with intake parser, cleanly pruning matched song and field lines while preserving truly unmapped lines and preventing collision with adversarial lines.

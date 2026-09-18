---
artifact: .control/decisions/DEC-045-daily-autopilot-mandate-continuous-engineering-routine.md
---

# Autopilot Ledger — DEC-045

## Resume

- Iteration: 1 (Final)
- Run branch: autopilot/DEC-045 (Draft PR #82: https://github.com/wiradeltaid/worship-presenter-web/pull/82)
- Stopped at: Done (Mandate DEC-045 closed: all 6 tickets of SPEC-44 delivered, tested, verified green, and live smoke-tested)
- Blocked: —
- Parked: —
- Next: Ready for maintainer final review and PR #82 squash-merge to main

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-045 for continuous engineering routine (SPEC-44) | waiting for interactive dispatch | low | .control/decisions/DEC-045-daily-autopilot-mandate-continuous-engineering-routine.md |
| I-0 (start) | memlog | Open Draft PR #82 for autopilot DEC-045 iteration 0 | holding unpushed branch | low | .control/memlog/autopilot-DEC-045.md |
| I-1 (SPEC-44-01) | internal/db & httpapi | Create rundown_parser_profiles SQLite table, seed immutable builtin-default profile, and implement admin CRUD + operator list endpoints | hardcoded compiled regex cascades | high | internal/db/migrate_parser_profiles.go, internal/httpapi/parser_profiles.go, internal/db/schema.sql |
| I-1 (SPEC-44-02) | internal/parse | Refactor Go rundown parsing to dynamically execute profile rules with named capture translation and multi-book hymn candidate extraction | monolithic compiled regexes | high | internal/parse/parser.go, internal/parse/profile.go, internal/parse/regex.go |
| I-1 (SPEC-44-03) | src/lib/parser.ts & golden | Implement TypeScript profile interpreter with inline flag handling, synthetic golden fixtures, and cross-engine parity testing | divergent client/server parsing behavior | high | src/lib/parser.ts, src/lib/parser-constants.ts, tests/fixtures/parser-profiles/, tests/parser-parity.test.mjs, internal/parse/parity_test.go |
| I-1 (SPEC-44-04) | song-set-matching & plan | Implement 3-pass hybrid song set matching (label match, positional slot family mapping, overflow/omission diagnostics) in Go and TS | manual re-typing of hymn numbers into song set cards | medium | internal/parse/song_set_matching.go, src/lib/song-set-matching.ts, tests/song-set-matching.test.mjs |
| I-1 (SPEC-44-05) | src/components/admin | Build ParserProfilesPanel with structured tabs, raw JSON editor, and sticky live testing sandbox in RegistryAdmin | administrative inability to configure or test custom liturgy rules | medium | src/components/admin/ParserProfilesPanel.tsx, src/components/admin/RegistryAdmin.tsx, src/lib/i18n/ |
| I-1 (SPEC-44-06) | operator forms & preview | Extend preview API to return songSetSuggestions/overflow/unmapped diagnostics, add profile indicator and suggestion accept actions in CreateForm and EditForm | rigid operator intake and unmapped data loss | high | internal/httpapi/services.go, src/operator/CreateForm.tsx, src/operator/EditForm.tsx, tests/smoke-spec-44.test.mjs |
| I-1 (live-test) | live smoke test | Author and execute live smoke tests verifying remote pairing, dynamic scripture typography scaling (<60cqh/8.5cqh/38cqh), multi-book parsing, and 3-pass matching (SPEC-43 & SPEC-44) | relying on unit tests alone without live execution proof | high | tests/manual-live-smoke-verification.mjs |
| I-1 (peer-review) | services & parser | Persist parser profile traceability on service create/update, validate full regex compilation on profile save, route webhook through default profile, and support hymn pattern flags (Terra & Composer review) | unpersisted profile selection, unvalidated regex saves, or webhook profile divergence | high | internal/httpapi/services.go, internal/httpapi/parser_profiles.go, internal/httpapi/webhook.go, internal/parse/parser.go, internal/parse/profile.go, src/operator/CreateForm.tsx, src/operator/EditForm.tsx |
| I-1 (finish) | closeout | Mark SPEC-44 status: closed in specs.yaml, DEC-045 status: applied in decisions.yaml, cancel recurring loop cron task 47b110bd, and run baseline validator generation | unclosed mandate/spec or dangling loop cron task | low | .control/registry/specs.yaml, .control/registry/decisions.yaml, .control/memlog/autopilot-DEC-045.md |

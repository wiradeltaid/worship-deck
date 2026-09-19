---
artifact: .control/decisions/DEC-048-daily-autopilot-mandate-continuous-engineering-routine.md
---

# Autopilot Ledger — DEC-048

## Resume

- Iteration: 1 (Done)
- Run branch: autopilot/DEC-048
- Stopped at: Delivered all 6 tickets of SPEC-47 through G5 Release
- Blocked: —
- Parked: —
- Next: Open Pull Request to development_branch (main)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-048 for continuous engineering routine (SPEC-47) | waiting for interactive dispatch | low | .control/decisions/DEC-048-daily-autopilot-mandate-continuous-engineering-routine.md |
| I-1 (SPEC-47-01) | internal/desktop & cmd/api | Implement standalone desktop launcher, Windows Named Mutex, dynamic loopback port scanner, and LocalAppData data dir resolution | hardcoded cwd storage and wildcard network binds | high | internal/desktop, cmd/api/main.go, cmd/api/desktop_test.go |
| I-1 (peer-review) | internal/desktop & cmd/api | Apply Terra review fixes: ValidateBindHost loopback guard, fail-closed mutex exit, raw-byte defect injection, and 0700/0600 permissions | potential firewall alerts, concurrent process races, and permissions leak | high | internal/desktop/port.go, cmd/api/main.go, internal/desktop/mutex_other.go, tests/smoke-spec-47.test.mjs |
| I-1 (SPEC-47-02) | internal/pptx & scripts | Implement ResolveNodeBinary with bundled portable node precedence, staging script with 19-package recursive closure, and external PATH='' E2E render test | requiring system Node.js on target machine or missing transitive packages | high | internal/pptx/worker.go, internal/pptx/worker_test.go, scripts/stage-portable-node.mjs, tests/smoke-spec-47.test.mjs |
| I-1 (SPEC-47-03) | installer & scripts | Author Inno Setup installer script with data preservation invariants, desktop build pipeline, and physical defect injections | accidental deletion of user data on upgrade/uninstall or running concurrent updates | high | installer/worship-presenter.iss, scripts/build-desktop.mjs, package.json, tests/smoke-spec-47.test.mjs |
| I-1 (SPEC-47-04) | internal/db & internal/httpapi | Implement pure Go UUIDv7 generator, global_id schema migration & backfill for 5 syncable tables, and atomic transactional delete with tombstones | autoincrement ID collisions offline and zombie record resurrections during sync | high | internal/db/uuidv7.go, internal/db/migrate_sync_identity.go, internal/httpapi/services.go, internal/httpapi/song_set_entries.go, tests/smoke-spec-47.test.mjs |
| I-1 (SPEC-47-05) | internal/httpapi & src/lib/sync | Implement bidirectional delta sync engine, BEGIN IMMEDIATE on dedicated sql.Conn, per-device idempotency, service_global_id FK resolution, and synchronized Presenter Liveness Guard | race conditions, zombie data, lost relationships, and live presentation disruption | high | internal/httpapi/sync.go, internal/httpapi/sync_test.go, internal/httpapi/remote.go, src/lib/sync/client.ts, tests/smoke-spec-47.test.mjs |
| I-1 (SPEC-47-06) | internal/httpapi & spa/src | Implement content-addressed SHA256 media sync with deduplication short-circuit and atomic temp files, and React AdminSyncPage with stable UUIDv7 device ID, on-demand Push/Pull, and interactive conflict modal | duplicate asset bandwidth waste and unhandled concurrent edit collisions | high | internal/httpapi/sync_assets.go, internal/httpapi/sync_assets_test.go, spa/src/pages/AdminSyncPage.tsx, spa/src/App.tsx, src/components/Header.tsx, tests/smoke-spec-47.test.mjs |

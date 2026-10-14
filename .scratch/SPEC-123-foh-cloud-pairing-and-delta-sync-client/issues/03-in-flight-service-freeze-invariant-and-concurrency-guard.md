# SPEC-123-03 — In-Flight Service Freeze Invariant & Concurrency Guard

**Satisfies:** [FR-16, FR-40, UC-12, UC-32]
**Blocked by:** ["SPEC-123-02"]
**Status:** open

## Summary
Enforce the Sunday In-Flight Service Freeze invariant protecting the live presentation from background sync mutations:
1. In `internal/httpapi/concurrency.go` & `sync.go` & `foh_sync.go`:
   - Integrate `TryAcquireSyncLock`:
     - When presenter mode is active (`isProjectorActive` / presentation session in progress), any incoming sync push or pull mutation MUST be immediately rejected with `HTTP 409 Conflict`.
     - Error payload:
       ```json
       {
         "error": "presenter_active",
         "message": "Panggung FOH sedang aktif menayangkan ibadah. Sinkronisasi dibekukan demi kestabilan layanan."
       }
       ```
   - Invariant: A running Sunday service can NEVER experience slide jumps, lyric overwrites, or schema lockups due to cloud sync execution.
2. In `internal/httpapi/sync_freeze_guard_test.go`:
   - Build automated defect-injection tests:
     - Activate mock presenter session.
     - Attempt to run sync -> prove request fails with 409 `presenter_active`.
     - Terminate presenter session.
     - Attempt to run sync -> prove lock is acquired cleanly and sync succeeds.

## Acceptance Criteria
- While a presentation is active, `POST /api/desktop/sync/pull-cloud` and `POST /api/sync/push` return `409 Conflict`.
- Defect injection test verifies red-to-green proof: mutates presenter lock state and observes exact rejection behavior.
- No live presentation session can be interrupted by cloud sync background execution.

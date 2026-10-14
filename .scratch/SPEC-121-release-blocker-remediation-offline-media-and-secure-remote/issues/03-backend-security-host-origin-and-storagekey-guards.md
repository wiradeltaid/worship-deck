# SPEC-121-03 — Backend Security Boundary: Host & Origin Validation, StorageKey Regex & Traversal Guard

**Satisfies:** [FR-35]
**Blocked by:** ["SPEC-121-02"]
**Status:** open

## Summary
Harden HTTP server boundaries against network-level and payload-level attacks in church Wi-Fi environments:
1. In `internal/httpapi/server.go`, add Host header validation against allowed loopback and church LAN IP patterns.
2. Enforce fail-closed Origin/Referer matching on all state-changing HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`) on gated endpoints to eliminate CSRF (rejecting requests with missing or unallowed origins unless same-origin/loopback).
3. In `internal/httpapi/media_playlist.go`, validate `storageKey` against canonical lowercase 64-hex SHA-256 regex `^[a-f0-9]{64}\.[a-z0-9]+$` on creation.
4. In `getMediaContent` and asset removal helpers, strictly verify that the resolved target path remains within `uploadsDir`, rejecting path traversal.

## Acceptance Criteria
- Requests with malicious or forged Host headers are rejected fail-closed.
- State-changing requests from untrusted or missing origins on gated endpoints are blocked fail-closed.
- Non-hex64 `storageKey` inputs are rejected with HTTP 400.
- Media content streaming strictly verifies path containment under `uploadsDir`.
- Automated regression tests verify all four security guards with defect injection proofs.

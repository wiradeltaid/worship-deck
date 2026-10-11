# SPEC-111-09 — End-to-End Verification, WebView2 Parity, and 5 Absence Guards

**Satisfies:** [UC-12, FR-16]
**Blocked by:** ["SPEC-111-08"]
**Status:** open

## Summary
Implement automated test suite in `tests/local-media-player.test.mjs` and browser/desktop integration test script verifying the complete two-tier media workflow, web/desktop parity, and five mandatory architectural absence guards with injected defect proofs.

## Key Responsibilities
1. **End-to-End Workflow Verification**:
   - Verify upload -> cloud playlist ingest -> conscious download -> local tab registration -> local-first playback -> fail-closed disconnect.
   - Dual test harness:
     - Deterministic Node unit test suite for absence guards and state reducers.
     - Browser and WebView2 integration verification script (covering Service Worker 206 range streaming, controller liveness, directory picker handle persistence, and OPFS fallback).
2. **Five Mandatory Absence Guards (Proven Red First)**:
   - **Guard 1 (Zero Auto-Download)**: Assert zero cloud content fetches occur without an explicit operator click.
   - **Guard 2 (Zero Filename Matching)**: Assert matching strictly compares SHA-256 and never matches by filename.
   - **Guard 3 (Service Worker Namespace Isolation)**: Assert Service Worker intercepts only `/local-media/` and passes all other routes untouched.
   - **Guard 4 (Directory Picker Disk Preservation)**: Assert unlinking/removing items in directory picker mode never deletes physical files on the operator's disk.
   - **Guard 5 (Server File Preservation on Unlink)**: Assert `DELETE /api/media/playlist/:id` unlinks the row and leaves the underlying physical file intact on server.
3. **Repo Guard Compliance**:
   - Ensure synthetic test fixtures are used; zero real media files committed.

## Acceptance Criteria
- Full test suite passes under Node test runner (`node --test tests/local-media-player.test.mjs`).
- Browser/desktop integration script verifies Range 206 streaming and controller reload recovery.
- All five absence guards proven red through defect injection before passing assertions.

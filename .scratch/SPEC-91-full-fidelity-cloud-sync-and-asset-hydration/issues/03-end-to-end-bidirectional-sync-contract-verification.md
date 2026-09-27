# 03: Two-Direction Round-Trip Contract & Absence Guard Verification

**What to build:** In `tests/sync-bidirectional-contract.test.mjs` and `package.json`:

1. **Two-Direction Round-Trip Test Oracle (`tests/sync-bidirectional-contract.test.mjs`)**:
   - Spin up two isolated mock instances (Instance A and Instance B) and a Mock Central Server.
   - Cycle 1 (A -> Server -> B):
     - Configure on Instance A:
       - Service with `hidden_slide_ids` and `emergency_patches`.
       - Uploaded images in Family of the Week, Youth of the Week, and Announcement Slides.
       - Custom Announcement Sets, Deck Sequence Templates, and Service Snapshots.
       - Custom Song Set Layout trio.
     - Execute push from Instance A to Server, then pull from Server to Instance B.
     - Assert on Instance B:
       - 100% of all database rows match canonical fixtures with zero omissions.
       - Physical asset files exist in `./data/uploads/` on Instance B and SHA-256 matches Instance A.
       - HTTP GET requests to `/api/uploads/<hash>.<ext>` on Instance B return HTTP 200 with valid content.
       - `hidden_slide_ids` and `emergency_patches` are fully preserved.
   - Cycle 2 (B -> Server -> A):
     - Modify and add new announcement sets, hide additional slides, and upload a new background image on Instance B.
     - Execute push from Instance B to Server, then pull from Server to Instance A.
     - Assert on Instance A:
       - The new changes and new asset binaries replicate back to Instance A with exact parity.
       - Deleted items reflect tombstones and are properly removed without orphaned child rows.

2. **Automated Test Registration (`package.json`)**:
   - Register `tests/sync-bidirectional-contract.test.mjs` in `package.json` under `"test"` and `"smoke:spec-91"`.
   - Verify that `npm run smoke:spec-91` executes all three test suites:
     - `tests/sync-full-fidelity-entities.test.mjs`
     - `tests/sync-asset-hydration.test.mjs`
     - `tests/sync-bidirectional-contract.test.mjs`
   - Confirm full test suite (`npm test` and `go test ./...`) executes with 100% clean green status.

Satisfies `FR-40`, `FR-21`.

**Blocked by:** 02

**Status:** open

- [ ] In `package.json`:
      - Add `tests/sync-bidirectional-contract.test.mjs` to `test` script and ensure `smoke:spec-91` runs all three test files.
- [ ] In `tests/sync-bidirectional-contract.test.mjs`:
      - Implement comprehensive two-direction round-trip contract tests with defect injection.
- [ ] Verify full test suite passes cleanly.

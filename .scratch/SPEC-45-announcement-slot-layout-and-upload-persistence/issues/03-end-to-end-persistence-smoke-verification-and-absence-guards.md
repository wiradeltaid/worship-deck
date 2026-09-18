# 03: End-to-End Persistence Smoke Verification and Absence Guards

**What to build:**
Author comprehensive regression smoke tests and executable absence guards in `tests/smoke-spec-45.test.mjs` and wire them into `package.json`'s `test` script, verifying that `RunSheetPage.tsx` hydrates `initialAnnouncementInserts`, `sm:grid-cols-2` is eliminated from announcement slot containers, and round-trip persistence of announcement posters is 100% verified.

**Blocked by:** 02 (Single-Row Announcement Slot Input Layout)

**Status:** ready-for-agent

- [ ] Author `tests/smoke-spec-45.test.mjs` testing:
  - Source AST/regex inspection of `spa/src/pages/RunSheetPage.tsx` verifying `initialAnnouncementInserts` prop is passed to `EditForm`.
  - Executable Absence Guard: Real-file disk defect-injection proof proving that introducing `sm:grid-cols-2` into announcement slot sections in `CreateForm.tsx` or `EditForm.tsx` triggers test failure.
  - Deterministic Round-Trip API persistence verification: test service creation with 4 distinct announcement poster URLs, verify `GET /api/services/{id}` returns all 4 URLs under `images_payload.announcementInserts`, and verify a subsequent `PUT /api/services/{id}` preserves all 4 URLs without data loss.
- [ ] Add `tests/smoke-spec-45.test.mjs` to `package.json`'s `test` script and create dedicated `smoke:spec-45` script.
- [ ] Verify test suite passes cleanly under `node --test tests/smoke-spec-45.test.mjs`.

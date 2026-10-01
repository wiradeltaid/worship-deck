# 04: OneDrive Connector Contract Verifications, Absence Guards, and Test Suite

**What to build:** In `tests/onedrive-connector.test.mjs` and `package.json`:

1. **Automated Verification Suite (`tests/onedrive-connector.test.mjs`)**:
   - Backend Contract & Isolation Tests:
     - Verify `GET /api/settings/onedrive` returns sanitized configuration without exposing `access_token` or `refresh_token`.
     - Multi-user isolation: Verify that User A's OneDrive connection and target folder configuration are completely isolated from User B's session.
     - Verify `POST /api/settings/onedrive` updates `sync_mode` (`ask`, `always`, `off`) and folder selections.
     - Verify PKCE single-use state/verifier lifecycle and authorization URL construction.
     - Verify `DELETE /api/settings/onedrive` clears user tokens while preserving global app integrity.
   - Graph Proxy & Upload Tests:
     - Verify `GET /api/settings/onedrive/folders` proxies Graph requests with proper headers and handles child counts and timestamps.
     - Verify `POST /api/services/:id/onedrive-upload` streams PPTX blob, respects `< 4MB` simple PUT vs `>= 4MB` chunked upload sessions, and handles retry on 401 refresh.
   - Run Sheet UI & Single-Blob Pipeline Tests:
     - Verify PPTX blob is generated once and shared between local download and OneDrive upload.
     - Verify word-wrap option (`wrap=true` vs `wrap=false`) is preserved across both local download and cloud upload.
     - Verify mode `ask` presents `OneDriveSyncPromptModal`.
     - Verify mode `always` initiates background upload without blocking local download.
     - Verify mode `off` bypasses cloud upload entirely.
     - Invariant test: Prove that an upload network failure does not abort or delete the local file download.
   - Internationalization & Accessibility Tests:
     - Verify all required dictionary keys exist in both English and Indonesian catalog files.
     - Verify modal dialogs include proper ARIA roles and keyboard trap/dismiss handling.

2. **Absence Guards & Defect Injection**:
   - Inject defect: omit token redaction in `GET /api/settings/onedrive` -> test must catch plaintext token leak and fail.
   - Inject defect: omit prompt in `ask` mode -> test must fail.
   - Inject defect: break single-blob reuse (triggering double PPTX fetch) -> test must fail.
   - Inject defect: cross-user session leakage -> test must fail.

3. **Package Registration**:
   - Register `tests/onedrive-connector.test.mjs` in `package.json` test scripts.

**Blocked by:** SPEC-95-03

**Status:** open

- [ ] Implement `tests/onedrive-connector.test.mjs` with full contract and absence guard coverage.
- [ ] Register test in `package.json`.
- [ ] Run test suite to verify all assertions pass.

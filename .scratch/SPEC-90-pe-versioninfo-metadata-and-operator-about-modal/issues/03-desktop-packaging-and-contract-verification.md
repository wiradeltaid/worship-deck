# 03: Desktop Packaging and Contract Verification

**What to build:** In `tests/desktop-about-contract.test.mjs`, `package.json`, and `scripts/build-desktop.mjs`:

1. **Deterministic Packaging Acceptance Criteria**:
   - `npm run prepare:desktop` exits 0.
   - `dist-desktop/worship-deck.exe` exists, and its PE FileVersion and CompanyName match `Wira Delta Indonesia`.
   - Staged legal files (`LICENSE`, `ATTRIBUTIONS.md`, `THIRD-PARTY-NOTICES`) exist in `{app}` staging.
   - Setup script `installer/worship-deck.iss` compiles or validates cleanly with `VersionInfo*` directives.

2. **Bounded Bounded Zero-Telemetry & Absence Guard (`tests/desktop-about-contract.test.mjs`)**:
   - Define exact bounded network rules:
     - No background polling or update checker code targeting `api/v1/update`, `latest.json`, or GitHub releases.
     - No third-party analytics or telemetry SDKs.
     - Permitted network calls: user-entered image URLs (SSRF-guarded), local database operations, and operator-initiated manual sync (`/admin/sync`).
   - Defect injection proof: verify that adding a mock update check endpoint or analytics tracker fails the test guard.

3. **Full Suite Registration & Verification (`package.json`)**:
   - Register `tests/desktop-about-contract.test.mjs` in `package.json` under `"test"` and `"smoke:spec-90"`.
   - Ensure full test suite (`npm test` and `go test ./...`) executes cleanly.

Satisfies `FR-40`.

**Blocked by:** 02

**Status:** open

- [ ] In `package.json`:
      - Add `tests/desktop-about-contract.test.mjs` to `test` and `smoke:spec-90` scripts.
- [ ] In `tests/desktop-about-contract.test.mjs`:
      - Implement end-to-end contract and bounded zero-telemetry absence guard tests with defect injection.
- [ ] In `scripts/build-desktop.mjs`:
      - Verify packaging pipeline integrity.
- [ ] Run full test suite and confirm clean green execution.

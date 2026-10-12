# SPEC-115-04 — Comprehensive Verification Suite, Pairing Guards, and Defect Injection Proofs

**Satisfies:** [UC-12, UC-29, FR-16, FR-35, FR-25]
**Blocked by:** ["SPEC-115-03"]
**Status:** closed

## Summary
Implement unit, integration, and executable defect injection absence guards covering QR code modal rendering, auto-claim parameter handling, surface isolation (remote audio mute, projector suppression, zero hardware enumeration, zero Cache API/IDB writes), media intent dispatching, and bilingual localization parity across `tests/remote-presenting-client.test.mjs`, `tests/remote-screen.test.mjs`, and `tests/bilingual-i18n-parity.test.mjs`.

## Key Responsibilities
1. **Remote Intent & Pairing Integration Tests (`tests/remote-presenting-client.test.mjs`)**:
   - Verify all new media intents (`media-play`, `media-pause`, `media-stop`, `media-fade`, `media-seek`, `media-toggle-project`, `media-select-item`) round-trip cleanly and execute on host handlers.
   - Verify auto-claim parameter extraction (`?service=1&code=123456`) triggers immediate claim without manual intervention and strips `?code=...` via `history.replaceState`.
   - Verify pairing rejection matrix: 60s timeout expiry, token replay rejection, 409 Conflict on second simultaneous remote controller.
2. **Surface Isolation Absence Guards & Defect Injection (`tests/remote-screen.test.mjs`)**:
   - Assert that `mode="remote"` strictly forces media volume to 0 / muted and suppresses local `BroadcastChannel` initialization.
   - Assert that `mode="remote"` never invokes `navigator.mediaDevices.enumerateDevices` or `getUserMedia`.
   - Assert that `mode="remote"` never writes to Cache API (`caches.open`) or IndexedDB.
   - Assert that durable mutation tools (Emergency Edit) are omitted or disabled in `mode="remote"`.
   - **Executable defect injection proofs**: prove that unmuting remote media audio, opening a projector channel, invoking hardware enumeration, or enabling Emergency Edit under `mode="remote"` fails the test suite.
3. **Bilingual i18n Parity (`tests/bilingual-i18n-parity.test.mjs`)**:
   - Verify 100% dictionary parity across all newly added QR pairing and remote console copy in English and Indonesian.
   - Defect injection proof: removing any remote QR string declaration fails the parity guard.

## Acceptance Criteria
- All tests in `tests/remote-presenting-client.test.mjs`, `tests/remote-screen.test.mjs`, and `tests/bilingual-i18n-parity.test.mjs` pass cleanly.
- Defect injection proofs prove red when mutations are applied and return cleanly to green.
- Go backend HTTP tests pass for all media intent types and reject invalid payloads.

## Comments

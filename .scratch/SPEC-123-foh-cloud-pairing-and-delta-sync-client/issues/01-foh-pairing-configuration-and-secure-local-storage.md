# SPEC-123-01 — FOH Pairing Configuration & Secure Local Storage

**Satisfies:** [FR-40, UC-32]
**Blocked by:** []
**Status:** closed

## Summary
Implement desktop pairing configuration model and secure local storage:
1. In `internal/desktop/pairing.go`:
   - Define `PairingConfig`:
     - `RemoteURL string` (`json:"remote_url"`)
     - `Token string` (`json:"token"`)
     - `ChurchName string` (`json:"church_name,omitempty"`)
     - `PairedAt time.Time` (`json:"paired_at"`)
     - `LastSyncedAt time.Time` (`json:"last_synced_at,omitempty"`)
   - Implement `LoadPairingConfig(dataDir string) (*PairingConfig, error)` reading from `filepath.Join(dataDir, "pairing.json")`.
   - Implement `SavePairingConfig(dataDir string, cfg *PairingConfig) error` writing with `0600` permissions (read/write only by user).
   - Implement `ClearPairingConfig(dataDir string) error` removing `pairing.json`.
   - Implement regex token format validator `ValidatePairingToken(token string) bool` matching `^foh_[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$`.
   - Implement `MaskToken(token string) string` returning safe preview (e.g. `foh_01J9...3f4a`).
2. In `internal/httpapi/pairing.go`:
   - Endpoint `GET /api/desktop/pairing`: returns pairing status `{ "paired": bool, "remote_url": string, "church_name": string, "last_synced_at": string, "token_masked": string }`.
   - Endpoint `POST /api/desktop/pairing`: accepts `{ "remote_url": string, "token": string }`, validates syntax, pings remote instance `/api/sync/status` with Bearer auth, captures church identity, saves to `pairing.json`, and returns success.
   - Endpoint `DELETE /api/desktop/pairing`: deletes `pairing.json` and resets pairing state.
3. In `tests/public-repo-guard.test.mjs`:
   - Update repository guard to explicitly forbid staging or committing `pairing.json` or `%LOCALAPPDATA%\WorshipDeck\` files.

## Acceptance Criteria
- Valid pairing token format `foh_<id>.<secret>` passes validation; malformed tokens are rejected with 400 Bad Request.
- `pairing.json` is stored strictly inside `dataDir` with `0600` file permissions.
- Token is masked in `GET /api/desktop/pairing` and never logged in plain text.
- `DELETE /api/desktop/pairing` cleanly deletes the file and returns paired=false.
- `public-repo-guard.test.mjs` verifies that `pairing.json` cannot be committed to git.
- Full test coverage in `internal/desktop/pairing_test.go` and `internal/httpapi/pairing_test.go`.

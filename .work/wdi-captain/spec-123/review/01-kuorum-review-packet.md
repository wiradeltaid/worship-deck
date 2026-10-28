Kamu reviewer READ-ONLY untuk repo worship-deck. Jangan mengubah berkas, jangan jalankan git atau shell tool.
Berdasarkan ringkasan diff dan kode di bawah, berikan review independen untuk commit 2753de41 melawan SPEC-123.
Keluaran wajib:
1. Verdict ringkas: PASS atau FAIL
2. Tabel temuan (No | Severity | File:line | Lensa | Masalah | Saran), hanya bila ada temuan nyata berbukti. Bila bersih, tulis "Nihil temuan, seluruh kontrak terpenuhi."
3. Catatan evaluasi ringkas sesuai lensa Anda.

---
# Rincian Diff Commit 2753de41 (SPEC-123)

1. internal/desktop/pairing.go:
- Model PairingConfig (version, cloud_url, tenant_id, church_name, device_id, token, paired_at).
- Token validation: regex `^foh_([A-Za-z0-9_-]{1,128})\.([A-Za-z0-9_-]{43})$`.
- Token masking: `foh_<id>.********`.
- SanitizeCloudURL: enforce HTTPS, port 443, allow HTTP loopback test, strip trailing slash, reject userinfo/query/fragment.
- Atomic SavePairingConfig: write to `.tmp_pairing_<nonce>.json` with 0600 permissions, atomic rename.
- ClearPairingConfig: deletes pairing.json safely.

2. internal/httpapi/pairing.go:
- `GET /api/desktop/pairing`: returns safe DTO with Cache-Control: no-store, token masked.
- `POST /api/desktop/pairing/test`: tests reachability via cloud /api/sync/status without saving.
- `POST /api/desktop/pairing`: validates token & URL, executes cloud handshake, atomically saves pairing.json.
- `DELETE /api/desktop/pairing`: unpairs device by removing pairing.json without touching local DB/media.

3. internal/httpapi/foh_sync.go:
- `POST /api/desktop/sync/pull-cloud`:
  - Enforces In-Flight Freeze: checks `globalRemoteHub.TryAcquireSyncLock()`. If locked, returns 409 Conflict with code `presenter_active` ("Sinkronisasi ditahan selama sesi presentasi.").
  - Loads pairing config. Returns 400 if unpaired.
  - Pulls delta from cloud `/api/sync/pull` outside SQLite transaction.
  - Media streaming: scans asset hashes, calls `/api/sync/assets/{hash}`, streams to `.tmp_{hash}_{nonce}`, computes incremental SHA-256 via io.TeeReader, verifies checksum, renames to final uploads/{hash}.{ext}. Deletes temp file on corruption/interruption.
  - Opens SQLite write transaction with `BEGIN IMMEDIATE` and `PRAGMA foreign_keys = ON`.
  - Ingests services, hymns, background_library_images, tombstones. Updates cursor in sync_state.
  - Commits transaction atomically. Updates last_synced_at.

4. UI React SPA:
- CloudPairingModal.tsx:
  - 2-stage gate: Connect button disabled until test connection succeeds and displays church name.
  - Disconnect button disabled when stage is live.
  - Synthetic placeholder: `https://gereja-anda.worshipdeck.org`.
- FohSyncIndicator.tsx:
  - 9 visual readiness states (S0-S6).
  - Sync button `[ ↓ Sinkronkan dari cloud ]` disabled during active presentation.
  - Role="status" for screen reader accessibility.

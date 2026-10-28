# Paket Audit Kuorum Reviewer & Ratifikasi Final (SPEC-123)

**Produk:** `worship-deck`  
**Commit SHA:** `2753de41` (branch: `task/SPEC-123-foh-cloud-pairing-and-delta-sync`)  
**Basis Perbandingan:** `main` (commit `e9b75227`)  
**Pelaksana:** `geminiflash`  
**Pengarah Arsitektur:** `sol-codex` (Mode: kernel `K1-01`..`K4-05`)  
**Pengarah Produk/UX:** `opus` (Mode: paket wording & 9-stage badge)  
**Dokumen Acuan:** `SPEC-123` (`.scratch/SPEC-123-foh-cloud-pairing-and-delta-sync-client/SPEC.md`), `ODR-019`

---

## Ringkasan Perubahan

1. **Penyimpanan Kredensial Aman (`internal/desktop/pairing.go`)**:
   - `PairingConfig` (version, cloud_url, tenant_id, church_name, device_id, token, paired_at).
   - Regex token `^foh_([A-Za-z0-9_-]{1,128})\.([A-Za-z0-9_-]{43})$`.
   - File permission `0600`, atomic replacement via temporary file `.tmp_pairing_<nonce>`.
   - Token masking `foh_<id>.********` untuk UI & logging.
2. **HTTP Endpoints Pairing (`internal/httpapi/pairing.go`)**:
   - `GET /api/desktop/pairing` (dengan `Cache-Control: no-store`).
   - `POST /api/desktop/pairing/test` (uji koneksi tanpa mengikat).
   - `POST /api/desktop/pairing` (handshake dan simpan config).
   - `DELETE /api/desktop/pairing` (unpair tanpa menghapus data lokal).
3. **Delta Sync Engine & Streaming Aset (`internal/httpapi/foh_sync.go`)**:
   - `POST /api/desktop/sync/pull-cloud` dengan `Authorization: Bearer <token>`.
   - Streaming unduhan media ke `.tmp_<hash>_<nonce>`, verifikasi hash SHA-256 on the fly, rename atomik.
   - Transaksi SQLite dengan `BEGIN IMMEDIATE` dan `foreign_keys=ON`.
4. **In-Flight Service Freeze Invariant Guard (`internal/httpapi/sync_freeze_guard_test.go`)**:
   - Mutual exclusion via `globalRemoteHub.TryAcquireSyncLock()`. Rejection `409 Conflict: presenter_active` ("Sinkronisasi ditahan selama sesi presentasi.").
5. **UI React SPA (`src/operator/pairing/CloudPairingModal.tsx` & `src/operator/sync/FohSyncIndicator.tsx`)**:
   - Modal pairing dengan gerbang 2-tahap (tombol Hubungkan baru aktif setelah Uji koneksi sukses).
   - Indikator 9-state dengan bukti konkret (jam sinkron + jumlah aset terverifikasi).
   - Tombol `[ ↓ Sinkronkan dari cloud ]`.

---

## Panduan Khusus per Reviewer

1. **Terra Codex (`terra-codex`)**:
   - Fokus: Kontrak Go, sistem berkas (atomic file writes, error handling, cleanups), dan isolasi koneksi SQLite.
2. **GLM-5.3 (`glm53`)**:
   - Fokus: Kepatuhan spesifikasi API, status HTTP (200, 400, 401, 409, 502), dan schema JSON request/response.
3. **DeepSeek V4 Pro (`deepseekpro`)**:
   - Fokus: Keamanan token handshake, proteksi secret tidak bocor, otentikasi Bearer, dan mitigasi SSRF / URL sanitization.


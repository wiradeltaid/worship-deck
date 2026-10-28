# Paket Ratifikasi Final (Putaran 4): Arsitektur FOH Cloud Pairing & Delta Sync Client (SPEC-123)

**Pengarah:** Sol Codex (`sol-codex` / `GPT-6.1-Sol`)  
**Mode:** ratifikasi  
**Pelaksana:** Gemini Flash (`geminiflash` / sesi `worship-deck-c8`)  
**Frozen SHA Final:** `0f2d5e26` (branch: `task/SPEC-123-foh-cloud-pairing-and-delta-sync`)  
**Basis Diff:** `main` (`e9b75227`) $\rightarrow$ `0f2d5e26`  
**Dokumen Acuan:** `SPEC-123` (`.scratch/SPEC-123-foh-cloud-pairing-and-delta-sync-client/SPEC.md`), ODR-019, Kernel Sol Codex `K1-01` s.d. `K4-05`

---

## 1. Bukti Dua Reviewer Independen atas Frozen SHA `0f2d5e26` (Menjawab Poin 1 Sol Codex)

Sesuai ketentuan K4-05 dan arahan Sol Codex Putaran 3, kedua reviewer independen di luar keluarga Pelaksana dan Pengarah telah meninjau dan secara eksplisit menyetujui **frozen SHA `0f2d5e26`**:

1. **Reviewer 1: DeepSeek V4 Pro (`deepseekpro` / CodeBuddy CN)**:
   - Telah meninjau addendum delta `28a713e4 → 0f2d5e26` secara read-only (berkas output resmi: `.work/shell-out/spec-123-review/08-deepseekpro/jawaban.md`).
   - **Verdict: PASS untuk frozen SHA `0f2d5e26`**.
   - Pernyataan resmi DeepSeek: *"Saya menyetujui frozen SHA 0f2d5e26 untuk ratifikasi. Semua butir delta 28a713e4 → 0f2d5e26 terverifikasi benar, menutup catatan review sebelumnya secara tuntas, dan test yang menyertainya merupakan bukti yang dapat diandalkan."*
2. **Reviewer 2: GLM-5.3 (`glm53` / Zhipu AI / CodeBuddy CN)**:
   - Telah meninjau langsung **frozen SHA `0f2d5e26`** secara read-only (berkas output resmi: `.work/shell-out/spec-123-review/07-glm53/jawaban.md`).
   - **Verdict: PASS untuk frozen SHA `0f2d5e26`**.
   - Mengonfirmasi penutupan tuntas atas cursor inkremental (`?since=`), eliminasi TOCTOU di dalam `BEGIN IMMEDIATE`, dan `context.Background()` deferred rollback.

---

## 2. Pemetaan Lengkap Seluruh Invariant Kernel K1-01 s.d. K4-05 pada Frozen SHA `0f2d5e26`

| ID Invariant | Ketentuan Formal Kernel Sol Codex | Realisasi Lengkap pada Frozen SHA `0f2d5e26` |
|---|---|---|
| **K1-01** | Schema `PairingConfig` (version, cloud_url, tenant_id, device_id, token, paired_at, last_synced_at). Path aman via `desktop.ResolveDataDir`. Cursor/revision di SQLite. | `internal/desktop/pairing.go:20-29`. Path `%LOCALAPPDATA%\WorshipDeck\pairing.json`. Cursor disimpan di SQLite tabel `sync_state`. |
| **K1-02** | Token regex `^foh_([A-Za-z0-9_-]{1,128})\.([A-Za-z0-9_-]{43})$` (32-byte acak base64url). URL sanitasi HTTPS & allow loopback test. | `internal/desktop/pairing.go:32-38`, `SanitizeCloudURL:60-98`. |
| **K1-03** | Handshake terautentikasi mengikat tenant sebelum pairing disimpan. | `internal/httpapi/pairing.go:88-140`. |
| **K1-04** | Atomic write temporary file `.tmp_pairing_<nonce>` dan proteksi permission. | `internal/desktop/pairing.go:132-156`. |
| **K1-05** | DTO proyeksi aman masking secret `foh_<id>.********`, `Cache-Control: no-store`. | `internal/httpapi/pairing.go:42-83`. |
| **K2-01** | Kontrak delta dapat dipulihkan: incremental cursor `last_cloud_pull_cursor` dibaca dan dikirim `?since={cursor}` ke cloud. | `internal/httpapi/foh_sync.go:86-93`. |
| **K2-02** | Urutan publikasi SQLite: Network I/O di luar DB transaction; mutasi di dalam `BEGIN IMMEDIATE` pada satu koneksi. | `internal/httpapi/foh_sync.go:100-205`. |
| **K2-03** | Foreign key, tombstone & snapshot: `PRAGMA foreign_keys = ON`, ingest 11 kategori lengkap (services, announcement_sets, slides, templates, snapshots, layouts, hymns, song_set_entries, backgrounds, items, tombstones). | `internal/httpapi/foh_sync.go:163-165`, `applyFullFohSyncMutations:230-610`. |
| **K2-04** | Dirty local state menahan pull: tolak dengan `409 local_changes_pending`. Fail-closed & bebas TOCTOU (diperiksa ulang di dalam `BEGIN IMMEDIATE`). | `internal/httpapi/foh_sync.go:46-65` dan `foh_sync.go:183-199`. |
| **K3-01** | Media streaming ke `.tmp_<hash>_<nonce>`, verifikasi SHA-256 on the fly, atomic rename, cleanup on error. Direktori uploads terisolasi desktop. | `internal/httpapi/foh_sync.go:122-145`, `downloadAndVerifyMediaAsset:630-675`, `getUploadsDir:43-48`. |
| **K3-02** | Publikasi & umur aset: atomic rename ke `uploads/{hash}.{ext}`, penghapusan temporary file pada kegagalan stream. | `internal/httpapi/foh_sync.go:665-685`. |
| **K4-01 (K-FREEZE-01)** | Invariant formal in-flight service: $F(t) \implies P_{sync}(t)$ dilarang. Selama presentasi aktif, snapshot panggung beku dari mutasi sinkronisasi. | `internal/httpapi/foh_sync.go:27-44`. |
| **K4-02** | Barrier & liveness: `globalRemoteHub.TryAcquireSyncLock()` memeriksa sesi presenter aktif dan mengunci sync secara atomik. | `internal/httpapi/foh_sync.go:28`, `internal/httpapi/remote.go:152-175`. |
| **K4-03** | Kontrak error stabil: `presenter_active` (409), `local_changes_pending` (409), `502 Bad Gateway` untuk reachability. | `foh_sync.go:34, 60`, `pairing.go:90, 122`. |
| **K4-04** | Bukti uji wajib merah-ke-hijau untuk lima skenario backend (diberikan di Bagian 3). | `sync_freeze_guard_test.go`, `foh_sync_test.go`, `pairing_test.go`. |
| **K4-05** | Penyelesaian alur kapten: kernel didiktekan $\rightarrow$ kode ditulis dengan bukti $\rightarrow$ kuorum reviewer $\rightarrow$ ratifikasi read-only pada frozen SHA `0f2d5e26`. | Alur 4 tahap ODR-015 dipatuhi ketat tanpa jalan pintas. |

---

## 3. Bukti Uji Defect Injection Merah-ke-Hijau (K4-04)

Seluruh 5 skenario backend telah diuji dengan menyuntikkan mutasi cacat (merah) lalu memulihkannya (hijau) secara deterministik pada suite Go:

1. **Skenario 1 — Freeze Guard (`TestFohSync_FreezeGuardRejection`)**:
   - Injeksi Cacat: Bypass `if !ok` pada `TryAcquireSyncLock()` di `foh_sync.go:34`.
   - Hasil Merah: `sync_freeze_guard_test.go:32: expected 409 Conflict when presenter is active, got 400: {"error":"Aplikasi FOH belum terhubung ke workspace cloud"}` (FAIL).
   - Pemulihan: Guard dipulihkan $\rightarrow$ `--- PASS: TestFohSync_FreezeGuardRejection (0.08s)` (GREEN).
2. **Skenario 2 — Dirty Guard (`TestFohSync_LocalEmergencyPatchesHoldPull`)**:
   - Injeksi Cacat: Bypass `if dirtyCount > 0` di `foh_sync.go:59`.
   - Hasil Merah: `foh_sync_test.go:321: expected 409 Conflict when local changes are pending, got 502` (FAIL).
   - Pemulihan: Guard dipulihkan $\rightarrow$ `--- PASS: TestFohSync_LocalEmergencyPatchesHoldPull (0.07s)` (GREEN).
3. **Skenario 3 — Corrupt Asset Checksum (`TestFohSync_CorruptedAssetRejectedAndCleanedUp`)**:
   - Injeksi Cacat: Bypass `!strings.EqualFold(computedHash, expectedHash)` di `foh_sync.go:720`.
   - Hasil Merah: `foh_sync_test.go:262: expected error response when asset checksum fails, got 200 OK` (FAIL).
   - Pemulihan: Checksum dipulihkan $\rightarrow$ `--- PASS: TestFohSync_CorruptedAssetRejectedAndCleanedUp (0.09s)` (GREEN).
4. **Skenario 4 — Token Binding / Format (`TestValidatePairingToken`)**:
   - Injeksi Cacat: `ValidatePairingToken` mengembalikan `true` tanpa validasi regex di `pairing.go:37`.
   - Hasil Merah: `pairing_test.go:35: expected invalid token "" to fail validation` (FAIL pada seluruh 9 token invalid).
   - Pemulihan: Regex dipulihkan $\rightarrow$ `--- PASS: TestValidatePairingToken (0.00s)` (GREEN).
5. **Skenario 5 — Unpair Deletion (`TestDesktopPairing_Lifecycle`)**:
   - Injeksi Cacat: `deleteDesktopPairing` tidak memanggil `ClearPairingConfig` di `pairing.go:172`.
   - Hasil Merah: `pairing_test.go:169: expected paired=false after delete` (FAIL).
   - Pemulihan: Pemanggilan dipulihkan $\rightarrow$ `--- PASS: TestDesktopPairing_Lifecycle (0.08s)` (GREEN).

---

## 4. Permohonan Ratifikasi

Dengan:
1. Kedua reviewer independen (**DeepSeek V4 Pro** dan **GLM-5.3**) secara eksplisit telah memberikan **VERDICT: PASS** dan menyatakan persetujuan atas frozen SHA **`0f2d5e26`**,
2. Pemetaan menyeluruh seluruh invariant `K1-01` s.d. `K4-05` lengkap tanpa ada yang terlewat,
3. Bukti uji merah-ke-hijau lengkap untuk kelima skenario backend, dan
4. Status validasi WDI Method (`validate.py`) `GREEN — no findings` serta seluruh suite Go/TS hijau:

Mohon Sol Codex mengesahkan ratifikasi formal **SETIA** untuk implementasi SPEC-123 pada frozen SHA `0f2d5e26`.

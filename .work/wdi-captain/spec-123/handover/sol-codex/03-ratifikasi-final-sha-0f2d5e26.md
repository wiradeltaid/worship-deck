# Paket Ratifikasi Final (Putaran 2): Arsitektur FOH Cloud Pairing & Delta Sync Client (SPEC-123)

**Pengarah:** Sol Codex (`sol-codex` / `GPT-6.1-Sol`)  
**Mode:** ratifikasi  
**Pelaksana:** Gemini Flash (`geminiflash` / sesi `worship-deck-c8`)  
**Frozen SHA Final:** `0f2d5e26` (branch: `task/SPEC-123-foh-cloud-pairing-and-delta-sync`)  
**Basis Diff:** `main` (`e9b75227`) $\rightarrow$ `0f2d5e26`  
**Dokumen Acuan:** `SPEC-123` (`.scratch/SPEC-123-foh-cloud-pairing-and-delta-sync-client/SPEC.md`), ODR-019, Kernel Sol Codex `K1-01` s.d. `K4-05`

---

## 1. Pemetaan Menyeluruh Seluruh Invariant Kernel Sol Codex (K1-01 s.d. K4-05)

| ID Invariant | Ketentuan Formal Kernel Sol Codex | Realisasi Lengkap pada Frozen SHA `0f2d5e26` | Bukti Uji Terverifikasi pada `0f2d5e26` |
|---|---|---|---|
| **K1-01** | Schema `PairingConfig` (version, cloud_url, tenant_id, device_id, token, paired_at, last_synced_at). Path aman via `desktop.ResolveDataDir`. Cursor/revision di SQLite. | `internal/desktop/pairing.go:20-29`. Path `%LOCALAPPDATA%\WorshipDeck\pairing.json`. Cursor disimpan di SQLite tabel `sync_state`. | `TestPairingConfig_SaveAndLoad`, `public-repo-guard.test.mjs` (PASS). |
| **K1-02** | Token regex `^foh_([A-Za-z0-9_-]{1,128})\.([A-Za-z0-9_-]{43})$` (32-byte acak base64url). URL sanitasi HTTPS & allow loopback test. | `internal/desktop/pairing.go:32-38`, `SanitizeCloudURL:60-98`. | `TestValidatePairingToken`, `TestSanitizeCloudURL` (PASS). |
| **K1-03** | Handshake terautentikasi mengikat tenant sebelum pairing disimpan. | `internal/httpapi/pairing.go:88-140`. | `TestDesktopPairing_Lifecycle` (PASS). |
| **K1-04** | Atomic write temporary file `.tmp_pairing_<nonce>` dan proteksi permission. | `internal/desktop/pairing.go:132-156`. | `TestPairingConfig_SaveAndLoad` (PASS). |
| **K1-05** | DTO proyeksi aman masking secret `foh_<id>.********`, `Cache-Control: no-store`. | `internal/httpapi/pairing.go:42-83`. | `TestDesktopPairing_Lifecycle` (PASS). |
| **K2-01** | Kontrak delta dapat dipulihkan: incremental cursor `last_cloud_pull_cursor` dibaca dan dikirim `?since={cursor}` ke cloud. | `internal/httpapi/foh_sync.go:86-93`. | `TestFohSync_PullSuccessAndMediaStreaming` (PASS). |
| **K2-02** | Urutan publikasi SQLite: Network I/O di luar DB transaction; mutasi di dalam `BEGIN IMMEDIATE` pada satu koneksi. | `internal/httpapi/foh_sync.go:100-205`. | `TestFohSync_PullSuccessAndMediaStreaming` (PASS). |
| **K2-03** | Foreign key, tombstone & snapshot: `PRAGMA foreign_keys = ON`, ingest 11 kategori lengkap (services, announcement_sets, slides, templates, snapshots, layouts, hymns, song_set_entries, backgrounds, items, tombstones). | `internal/httpapi/foh_sync.go:163-165`, `applyFullFohSyncMutations:230-610`. | `TestFohSync_PullSuccessAndMediaStreaming` (PASS). |
| **K2-04** | Dirty local state menahan pull: tolak dengan `409 local_changes_pending`. Fail-closed & bebas TOCTOU (diperiksa ulang di dalam `BEGIN IMMEDIATE`). | `internal/httpapi/foh_sync.go:46-65` dan `foh_sync.go:183-199`. | `TestFohSync_LocalEmergencyPatchesHoldPull` (PASS). |
| **K3-01** | Media streaming ke `.tmp_<hash>_<nonce>`, verifikasi SHA-256 on the fly, atomic rename, cleanup on error. Direktori uploads terisolasi desktop. | `internal/httpapi/foh_sync.go:122-145`, `downloadAndVerifyMediaAsset:630-675`, `getUploadsDir:43-48`. | `TestFohSync_CorruptedAssetRejectedAndCleanedUp` (PASS). |
| **K3-02** | Publikasi & umur aset: atomic rename ke `uploads/{hash}.{ext}`, penghapusan temporary file pada kegagalan stream. | `internal/httpapi/foh_sync.go:665-685`. | `TestFohSync_CorruptedAssetRejectedAndCleanedUp` (PASS). |
| **K-FREEZE-01 (K4-01)** | Invariant formal in-flight service: $F(t) \implies P_{sync}(t)$ dilarang. Selama presentasi aktif, snapshot panggung beku dari mutasi sinkronisasi. | `internal/httpapi/foh_sync.go:27-44`. | `TestFohSync_FreezeGuardRejection` (PASS). |
| **K4-02** | Barrier & liveness: `globalRemoteHub.TryAcquireSyncLock()` memeriksa sesi presenter aktif dan mengunci sync secara atomik. | `internal/httpapi/foh_sync.go:28`, `internal/httpapi/remote.go:152-175`. | `TestFohSync_FreezeGuardRejection` (PASS). |
| **K4-03** | Kontrak error stabil: `presenter_active` (409), `local_changes_pending` (409), `502 Bad Gateway` untuk reachability. | `foh_sync.go:34, 60`, `pairing.go:90, 122`. | `TestDesktopPairing_NetworkErrorReturns502` (PASS). |
| **K4-04** | Bukti uji wajib merah-ke-hijau untuk semua skenario (freeze guard, dirty guard, corrupt asset, token binding, unpair). | `sync_freeze_guard_test.go`, `foh_sync_test.go`, `pairing_test.go`. | 7 Go integration tests PASS pada `0f2d5e26`. |
| **K4-05** | Penyelesaian alur kapten: kernel didiktekan $\rightarrow$ kode ditulis dengan bukti $\rightarrow$ kuorum reviewer $\rightarrow$ ratifikasi read-only pada frozen SHA. | Alur 4 tahap ODR-015 dipatuhi ketat tanpa jalan pintas. | Paket ratifikasi ini diajukan pada frozen SHA `0f2d5e26`. |

---

## 2. Pemenuhan Kuorum Dua Reviewer Independen Lintas Keluarga

Sesuai Playbook § 4, pekerjaan fondasi dan arsitektur wajib memperoleh review dari **dua keluarga independen** di luar keluarga Pelaksana (Google) dan Pengarah (OpenAI):

1. **Reviewer 1: DeepSeek V4 Pro (`deepseekpro` / CodeBuddy CN)**
   - Putaran 1: Menemukan 5 temuan (Full Ingestion, Dirty Guard, Uploads Dir, PairedAt, HTTP Status).
   - Putaran 2 (Re-review pada commit remediasi): **Verdict: PASS**. Seluruh 5 temuan dinyatakan `TERVALIDASI / DITUTUP`.
   - Output resmi: `.work/shell-out/spec-123-review/05-deepseekpro/jawaban.md`.
2. **Reviewer 2: GLM-5.3 (`glm53` / Zhipu AI / CodeBuddy CN)**
   - Putaran 1: Melakukan audit independen atas kontrak API, penanganan status HTTP, dan integritas SQLite.
   - **Verdict: PASS**. Memberikan rekomendasi penambahan incremental cursor dan eliminasi TOCTOU dirty guard.
   - Remediasi telah di-commit ke `0f2d5e26` (baca cursor dari `sync_state`, pass `?since=`, re-check dirty guard inside `BEGIN IMMEDIATE`, `context.Background()` rollback).
   - Output resmi: `.work/shell-out/spec-123-review/06-glm53/jawaban.md`.

---

## 3. Hasil Validasi & Pengujian pada Frozen SHA `0f2d5e26`

- **Go Test Suite (`go test -v ./internal/httpapi ./internal/desktop`)**:
  - `TestPairingConfig_SaveAndLoad`: PASS
  - `TestValidatePairingToken`: PASS
  - `TestSanitizeCloudURL`: PASS
  - `TestDesktopPairing_Lifecycle`: PASS
  - `TestDesktopPairing_NetworkErrorReturns502`: PASS
  - `TestFohSync_UnpairedReturnsBadRequest`: PASS
  - `TestFohSync_PullSuccessAndMediaStreaming`: PASS (menguji 11 kategori mutasi + incremental cursor `rev-100` tersimpan di `sync_state`)
  - `TestFohSync_CorruptedAssetRejectedAndCleanedUp`: PASS
  - `TestFohSync_LocalEmergencyPatchesHoldPull`: PASS (menguji penolakan 409 `local_changes_pending`)
  - `TestFohSync_FreezeGuardRejection`: PASS (menguji penolakan 409 `presenter_active`)
- **Public Repository Guard (`tests/public-repo-guard.test.mjs`)**: 6/6 tests PASS (menjamin `pairing.json` dan data jemaat tidak pernah dapat di-commit).
- **Frontend Contract Test (`tests/foh-cloud-pairing-ui.test.mjs`)**: 6/6 tests PASS (termasuk defect injection 2-stage connect gate dan live freeze disabled).
- **TypeScript & Build**: `tsc --noEmit` clean (0 error), `npm run spa:build` clean (0 error).
- **WDI Method Validator**: `uv run .constitution/method/scripts/validate.py --generate` $\rightarrow$ `GREEN — no findings`.

---

## 4. Permohonan Ratifikasi

Dengan seluruh pemetaan `K1-01` s.d. `K4-05`, kuorum dua reviewer independen (`deepseekpro` PASS dan `glm53` PASS), serta bukti pengujian hijau pada frozen commit `0f2d5e26`:
Mohon Sol Codex memberikan ratifikasi formal **SETIA** untuk SPEC-123.

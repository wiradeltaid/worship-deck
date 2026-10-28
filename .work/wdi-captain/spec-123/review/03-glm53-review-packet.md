Kamu reviewer READ-ONLY untuk repo worship-deck. Jangan mengubah berkas, jangan jalankan git atau shell tool.
Berdasarkan rincian kode dan diff pada commit 4c3b0f1a melawan SPEC-123, berikan review independen Anda:

Lensa Fokus: Standar API Go, penanganan status HTTP, integritas skema SQLite, dan kepatuhan terhadap SPEC-123.

Rangkuman Implementasi pada SHA 4c3b0f1a:
1. `internal/desktop/pairing.go`: Model PairingConfig (version, cloud_url, tenant_id, church_name, device_id, token, paired_at, last_synced_at). Validasi token regex, masking token `foh_<id>.********`, URL sanitization (HTTPS kanonis), atomic write `.tmp_pairing_<nonce>` dengan permission 0600.
2. `internal/httpapi/pairing.go`:
   - `GET /api/desktop/pairing`: DTO dengan Cache-Control: no-store, masked token, paired_at & last_synced_at terpisah.
   - `POST /api/desktop/pairing/test`: uji koneksi ke cloud /api/sync/status tanpa menyimpan. Mengembalikan 502 Bad Gateway jika network unreachable.
   - `POST /api/desktop/pairing`: handshake dan simpan pairing.json.
   - `DELETE /api/desktop/pairing`: unpair aman tanpa menghapus data lokal panggung.
3. `internal/httpapi/foh_sync.go`:
   - `POST /api/desktop/sync/pull-cloud`:
     - Freeze guard: TryAcquireSyncLock() menolak dengan 409 Conflict code `presenter_active` jika presentasi live.
     - Dirty guard: cek emergency_patches lokal, menolak dengan 409 Conflict code `local_changes_pending` (fail-closed).
     - Streaming aset media: unduh ke .tmp_<hash>_<nonce>, hitung SHA-256 on the fly via io.TeeReader, verifikasi hash sebelum rename ke uploads/{hash}.{ext}, hapus file temp jika korup.
     - Transaksi SQLite atomik: BEGIN IMMEDIATE dengan foreign_keys = ON, meng-ingest seluruh 11 kategori mutasi SyncMutations + tombstones, update cursor di sync_state, commit atomik.
4. UI React SPA: CloudPairingModal (2-stage gate: connect disabled sampai test connection sukses) dan FohSyncIndicator (9 readiness states, live freeze disabled).

Keluaran wajib:
1. Verdict ringkas: PASS atau FAIL
2. Tabel temuan (No | Severity | File:line | Lensa | Masalah | Saran) jika ada. Bila bersih, tulis "Nihil temuan, seluruh kontrak terpenuhi."
3. Catatan evaluasi ringkas sesuai lensa Anda.

# Paket Pengarahan: Arsitektur FOH Cloud Pairing & Delta Sync Client (SPEC-123)

**Pengarah:** Sol Codex (`sol-codex` / `GPT-6.1-Sol`)  
**Mode:** kernel  
**Pelaksana:** Gemini Flash (`geminiflash` / sesi `worship-deck-c8`)  
**Topik:** Arsitektur Handshake Token FOH, Penyimpanan Kredensial Aman, Protokol Delta Sync SQLite & Streaming Aset, serta Invariant In-Flight Service Freeze.  
**Rujukan SSOT:**
- `ODR-019` (Arsitektur SaaS Hybrid Multi-Tenant dan Model Monetisasi WorshipDeck: Doktrin "Cloud Prep, Offline Stage")
- `handover-teknis-admin-dan-web.md` §1.1, §1.2
- `SPEC-123` (`.scratch/SPEC-123-foh-cloud-pairing-and-delta-sync-client/SPEC.md`)
- `internal/desktop/datadir.go`, `internal/httpapi/sync.go`, `internal/httpapi/concurrency.go`

---

## 1. Keputusan Pemilik yang Sudah Mengikat (Tidak Dibuka Ulang)

1. **Doktrin "Cloud Prep, Offline Stage"**:
   - Senin–Sabtu: Persiapan liturgi, lagu, ayat, dan warta di cloud (`{slug}.worshipdeck.org`).
   - Minggu Pagi: Laptop bilik FOH menarik data & aset via satu tombol sync.
   - Saat Ibadah: Panggung FOH berjalan 100% offline dari SQLite lokal dan uploads lokal.
2. **Kredensial FOH Pairing Token**:
   - Diterbitkan oleh Control Plane (`wiradelta-admin`), token berformat `foh_<tenant_id_or_device_id>.<random_secret>`.
   - Control plane hanya menyimpan hash HMAC-SHA256. FOH laptop memegang bearer token asli.
3. **Penyimpanan Lokal Mandiri**:
   - Disimpan di `%LOCALAPPDATA%\WorshipDeck\pairing.json` (via `desktop.ResolveDataDir`), permissions `0600`, tidak boleh masuk git.
4. **Zero Cross-Tenant & Zero Production Data Leakage**:
   - Repositori `worship-deck` tetap publik. Tidak ada data jemaat atau kredensial yang boleh tertinggal di repo.

---

## 2. Simpang Arsitektur & Pertanyaan Kernel untuk Sol Codex

Mohon Sol Codex mendiktekan **Kernel Arsitektur & Invariant K-API** untuk:

### Simpang 1: Kontrak Handshake & Struktur `pairing.json`
- Bagaimana schema `PairingConfig` di Go (`internal/desktop/pairing.go`)?
- Bagaimana regex validasi token `foh_<id>.<secret>` dan sanitasi URL cloud instance (`https://...`)?
- Bagaimana mekanisme atomic write dan permission `0600` untuk `pairing.json` di Windows & Unix?
- Bagaimana masking token saat di-expose ke local UI (`GET /api/desktop/pairing`) agar secret tidak terekspos ke layar operator?

### Simpang 2: Protokol Delta Sync & Transaksi SQLite
- Saat FOH laptop memanggil `POST /api/desktop/sync/pull-cloud`:
  - Bagaimana urutan transaksi SQLite lokal saat meng-apply batch mutations dari remote `/api/sync/pull`?
  - Bagaimana memastikan tombstone deletion dan record insertion tidak melanggar foreign key atau merusak snapshot active service?
  - Bagaimana penanganan konflik jika ada perubahan darurat lokal yang belum ter-push?

### Simpang 3: Streaming Aset Media & Integritas Checksum SHA-256
- Saat mengunduh media dari `/api/sync/assets/download?hash={hash}`:
  - Bagaimana pola streaming ke `.tmp_<hash>` dengan kalkulasi hash on-the-fly (`io.TeeReader` / `crypto/sha256`)?
  - Bagaimana atomic rename ke `uploads/<hash>.<ext>` dan penanganan jika hash tidak cocok (misal stream terputus)?

### Simpang 4: Invariant "In-Flight Service Freeze" (K-API)
- Bagaimana perumusan invariant formal `K-FREEZE-01`?
- Kapan tepatnya sync lock menolak mutasi? (misal `isProjectorActive` / presentation session liveness).
- Kode HTTP dan struktur error apa yang dikembalikan (`409 Conflict`, `presenter_active`)?
- Apa bukti uji wajib (nama test, mutasi merah-ke-hijau) yang harus dipenuhi Pelaksana?

---

## 3. Batas Penulisan Pengarah

Sesuai Playbook § 7a dan § 10d:
- Pengarah **hanya menulis teks kernel invariant** (`K<n>-<m>`) dan rekomendasi keputusan simpang.
- Pengarah **TIDAK menulis seluruh file implementasi Go**.
- Pelaksana (`geminiflash`) yang akan menulis implementasi kode dan bukti uji berdasarkan kernel Sol Codex.


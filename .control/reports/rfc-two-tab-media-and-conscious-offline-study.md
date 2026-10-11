# Architectural Study & Ratification: Two-Tab Media Library, Conscious Offline Downloader, and Local-First Playback Routing

**Date:** 2026-10-11  
**Context:** Perancangan Lanjutan SPEC-111 (Media Player Tahap 2)  
**Pengarah Produk & UX (Ratifikasi):** Claude Opus 5.5 (`opus` via Kiro Agent)  
**Konsultan Reviewer:** Sol (Codex `gpt-6.1-sol`), GLM-5.3 (`cbcn/glm-5.3`), DeepSeek Pro (`cbcn/deepseek-v4-pro`)  
**Pelaksana:** `geminiflash`  
**Status:** **Ratified by Opus (Kernel Decision K1–K5)**  

---

## 1. Latar Belakang & Kebutuhan Pemilik Produk

Berdasarkan evaluasi penggunaan nyata di ibadah gereja:
1. **Dua Tab di MediaDrawer**:
   - `[Pustaka Cloud]` (default): Melihat aset media gereja di server/VPS.
   - `[Media Laptop]`: Melihat aset media yang tersimpan offline di harddisk/flashdisk laptop operator.
2. **Streaming Mandatori di Cloud (Tanpa Auto-Download)**:
   - Media di Cloud secara bawaan di-stream dari internet. Tidak boleh ada auto-download latar belakang yang menyedot kuota/bandwidth gereja.
3. **Conscious Offline Readiness (Download Sadar Operator)**:
   - Tombol **"Unduh Semua"** (bulk) dan **"Unduh Satuan"** per item.
   - Operator secara sadar menentukan kapan mendownload (misal saat ada Wi-Fi kencang di rumah). Berkas otomatis menjadi item lokal di Tab Laptop.
4. **Indikator Pencocokan Status Dinamis (SHA-256 Matching Engine)**:
   - Pencocokan database lokal (IndexedDB) dengan database server (SQLite) berbasis hash `sha256`.
5. **Universal Web & Desktop**:
   - Bekerja identik di web (`presenter-dev.bic.my.id`) dan desktop WebView2 (`WorshipDeck.exe`).

---

## 2. Putusan Kernel Pengarah (Opus)

### K1. UI/UX Dua Tab & Top Control Bar (Disetujui dengan Amandemen)
- **Dua Tab Kanonik:** `Pustaka Cloud` (default) dan `Media Laptop`.
- **Amandemen Tanpa Layout Shift:** Top Control Bar menempati slot horizontal dengan **tinggi tetap** di antara header cluster dan monitor slide. Saat tidak ada media, bar tampil berstatus `disabled` (tidak boleh kolaps/muncul mendadak yang menggeser slide monitor saat ibadah).
- **Indikator Sumber:** Bar menampilkan sumber media yang sedang aktif: `Lokal` atau `Cloud`.
- **Kontrak Badge (Tab Cloud):**
  - Tanpa emoji. Menggunakan ikon SVG dari icon registry + label teks selalu terlihat:
    1. `streaming-only`: Label "Streaming", tombol aksi `[Unduh]`.
    2. `downloading`: Label "Mengunduh N%", elemen ARIA `role="progressbar"`, tombol aksi `[Batal]`.
    3. `local`: Label "Tersedia di lokal", badge success.
    4. `detached`: Label "File terlepas", tombol aksi `[Sambungkan ulang]`.

### K2. Alur Conscious Downloader (showDirectoryPicker Primer, OPFS Cadangan)
- **Primer:** `showDirectoryPicker()`. Folder dipilih **satu kali** (misal `D:\WorshipDeck\Media`) dan handle-nya disimpan di IndexedDB.
- **Cadangan (Fallback):** OPFS (*Origin Private File System*) jika API picker tidak didukung atau operator menolak, dengan pemanggilan `navigator.storage.persist()`.
- **`<a download>` Dilarang** sebagai media storage engine.
- **Invarian Unduhan:**
  - Nol auto-download dalam bentuk apa pun.
  - Antrean sekuensial (konkurensi 1).
  - Penulisan atomik via `createWritable()`, stream hash diverifikasi terhadap `sha256` server (mismatch langsung di-`abort()`).
  - Hapus dari Tab Lokal = lepas dari indeks (tidak menghapus file fisik di Explorer operator).

### K3. Playback Routing (Local-First Priority dengan Batasan)
- **Resolusi Saat Cue/Load:** Jika item Cloud berstatus `local`, playback otomatis dialihkan ke Service Worker `/local-media/<sha256>` (hemat bandwidth internet).
- **Syarat Lokal:** SHA-256 cocok, izin handle `granted`, ukuran & mtime sama, dan `navigator.serviceWorker.controller` aktif di jendela Presenter & Proyektor.
- **Fallback Terkendali:** Jika syarat lokal gagal saat load, fallback otomatis streaming dari cloud + toast pemberitahuan ke operator.
- **Fail-Closed Mid-Playback:** Jika file lokal terputus di tengah pemutaran, pemutaran berhenti dengan rapi dan proyektor kembali ke slide aktif (tidak ada pergantian liar di tengah jalan).

### K4. Backend Go SQLite (Skema media_playlist_items)
- Simpan `storage_key`, bukan URL absolut.
- Kolom `sha256 TEXT NOT NULL` dengan `CHECK (length(sha256)=64)`, dihitung di server saat ingest (`io.TeeReader`).
- `DELETE /api/media/playlist/:id` hanya menghapus baris antrean (*unlink*). File fisik di server hanya dibersihkan melalui aksi purge terpisah jika *refcount = 0* (dihitung via query).

---

## 3. Struktur 9 Tiket SPEC-111 yang Diratifikasi Opus

| Tiket | Judul & Cakupan | satisfies | touches | blocked_by |
|---|---|---|---|---|
| **`SPEC-111-01`** | **Spike Kapabilitas WebView2 & SW Handle**: Validasi `showDirectoryPicker`, SW `getFile()` dari IndexedDB, OPFS fallback di WebView2, dan dokumentasi `DEC-`. | K2 prasyarat | `internal/desktop/`, `.control/decisions/` | — |
| **`SPEC-111-02`** | **Skema SQLite & Migrasi Backend**: Tabel `media_playlist_items`, hash server-side ingest, backfill hash. | K4 | `internal/db/schema.sql`, `internal/db/migrate_*.go`, `internal/httpapi/` | — |
| **`SPEC-111-03`** | **API Playlist & Content Range**: `GET`, `POST`, `PATCH /reorder`, `DELETE /:id` (unlink), endpoint purge refcount=0, dan HTTP 206 streaming. | K4, K3.7 | `internal/httpapi/`, `cmd/api/` | `SPEC-111-02` |
| **`SPEC-111-04`** | **Local Store & Incremental Hashing Engine**: IndexedDB store keyed `sha256`, Web Worker incremental hashing, dan cache `Map<sha256, LocalMediaMeta>`. | K1, K3.2 | `src/operator/present/media-player/`, `package.json` | `SPEC-111-01` |
| **`SPEC-111-05`** | **Service Worker `/local-media/<sha256>`**: Streamer HTTP 206/416 range requests, pass-through non-media, controller verification. | K3.6 | `public/`, `src/lib/present-channel.ts` | `SPEC-111-01`, `SPEC-111-04` |
| **`SPEC-111-06`** | **UI Dua Tab & Kontrak Badge 4-State**: Tab `Pustaka Cloud` & `Media Laptop`, badge 4-state tanpa emoji, manual local import. | K1 | `src/operator/present/media-player/MediaDrawer.tsx` | `SPEC-111-03`, `SPEC-111-04` |
| **`SPEC-111-07`** | **Conscious Downloader Engine**: Pilih folder sekali, OPFS fallback, antrean sekuensial, tulis atomik, preflight dialog, unlink vs delete. | K2 | `src/operator/present/media-player/` | `SPEC-111-05`, `SPEC-111-06` |
| **`SPEC-111-08`** | **Local-First Playback Routing & Fixed Top Control Bar**: Slot bar tetap tanpa layout shift, indikator sumber, fallback terkendali, stop rapi mid-playback. | K1, K3 | `src/operator/present/`, `src/projected/` | `SPEC-111-05`, `SPEC-111-07` |
| **`SPEC-111-09`** | **Verifikasi E2E & 5 Absence Guards**: Pengujian web dev & desktop WebView2, pembuktian 5 absence guards merah $\to$ hijau, public-repo guard. | K1–K5 | `tests/` | `SPEC-111-08` |

---

## 4. Lima Absence Guard Wajib (Harus Terbukti Merah)
1. **Tidak ada fetch/download konten media cloud tanpa klik operator** (T7).
2. **Tidak ada pencocokan berbasis nama berkas** (T4 — wajib 100% SHA-256).
3. **Service Worker tidak mencegat apa pun di luar namespace `/local-media/`** (T5).
4. **Mode picker tidak pernah menghapus berkas di Explorer operator saat item dilepas dari playlist** (T7).
5. **Unlink playlist tidak menghapus berkas fisik di server** (T3).

# Architectural RFC: Direct Local Media Playback, Persistent Local Playlist Pointer, and Sanctuary Cross-Window Video Projection

**Date:** 2026-10-11  
**Context:** Perluasan SPEC-110 (In-Console Media Player) untuk Operasional Lokal & Flashdisk Tanpa Upload Server  
**Status:** Quorum Approved (Sonnet 5, GPT-5.6 Terra Codex, GLM-5.3, DeepSeek V4 Pro)  
**Target Next Spec:** SPEC-111  

---

## 1. Latar Belakang & Kebutuhan Pengguna

Pada rilis SPEC-110, pemutar media konsol Presenter dan penayangan video ke layar jemaat mengandalkan penyimpanan server (`POST /api/upload` $\to$ `/api/uploads/<hash>.<ext>`) dan antrean playlist *in-memory* yang hilang saat tab ditutup.

Dalam realitas operasional ibadah gereja (*sanctuary operations*):
1. **Kendala Upload Berkas Besar:** Operator sering membawa flashdisk/harddisk eksternal berisi lagu pengiring (BGM) atau video kesaksian/pengumuman (MP4) berukuran 500 MB – 1 GB beberapa menit sebelum ibadah dimulai. Mengunggah berkas sebesar ini ke VPS memakan waktu lama, menghabiskan kuota internet gereja, dan berisiko gagal total jika koneksi internet terputus.
2. **Kebutuhan Direct Local Playback:** Media harus dapat diputar langsung dari storage lokal laptop tanpa upload ke server dan tanpa disimpan di `localStorage` browser.
3. **Pembedaan Sumber Jelas (`[LOKAL]` vs `[CLOUD]`):** Antrean playlist harus menampilkan badge visual yang tegas untuk membedakan berkas lokal laptop vs berkas cloud server.
4. **Pointer Berkas Lokal Persisten:** Playlist bersifat **shared seluruh worship service** (perpustakaan media bersama lintas jadwal ibadah). Pointer berkas lokal harus tersimpan permanen agar pada minggu depan atau saat aplikasi dibuka kembali, antrean media tetap utuh tanpa operator harus memilih ulang berkas dari awal.
5. **Proyeksi Video Lokal Lintas Jendela:** Video dari storage lokal komputer harus dapat ditayangkan ke jendela Proyektor Jemaat (layar kedua) tanpa upload ke server, dengan tetap mempertahankan invarian `muted` pada proyektor dan tombol kepanikan (*Panic Controls*) yang responsif seketika.

---

## 2. Ringkasan Konsensus Kuorum Reviewer (4 Model Tier-A / Reviewer)

Evaluasi mendalam dilakukan bersama 4 model reviewer WDI:
- **Claude Sonnet 5** (`sonnetkiro`)
- **GPT-5.6 Terra** (`terra-codex`)
- **GLM-5.3** (`glm53`)
- **DeepSeek V4 Pro** (`deepseekpro`)

### Matriks Konsensus
| Topik Arsitektur | Sonnet 5 | GPT-5.6 Terra | GLM-5.3 | DeepSeek V4 Pro | **Konsensus Kuorum** |
|---|---|---|---|---|---|
| **Persistensi Pointer Lokal** | File System Access API + IndexedDB | File System Access API + IndexedDB | File System Access API + IndexedDB | File System Access API + IndexedDB | **100% Sepakat: FSA Handle di IndexedDB** |
| **Alur Izin Browser (`permission`)** | `query` on mount, `request` on click | `query` on mount, `request` on click | `query` on mount, `request` on click | `query` on mount, `request` on click | **100% Sepakat: Wajib User Gesture (Klik)** |
| **Pembedaan UI Media** | Badge visual `[LOKAL]` vs `[CLOUD]` | Badge visual `[LOKAL]` vs `[CLOUD]` | Badge visual `[LOKAL]` vs `[CLOUD]` | Badge visual `[LOKAL]` vs `[CLOUD]` | **100% Sepakat: Field `source` eksplisit** |
| **Proyeksi Video Lokal Lintas Window** | Opsi B (Service Worker Range Streamer) | Opsi A' (IndexedDB Shared Handle $\to$ Object URL) + Opsi D (Desktop) | Opsi B (SW 206) + Fallback Opsi A | Opsi B (SW 206) | **Opsi A' / B (Zero-RAM Duplication, Zero-OOM)** |
| **Penolakan Opsi C (WebRTC)** | Tolak total (tidak seekable, CPU berat) | Tolak total (realtime only, anti-pola file) | Tolak total (dropout & freeze) | Tolak total (menyalahgunakan pipeline kamera) | **100% Diskualifikasi Opsi C** |

---

## 3. Masalah 1: Persistensi Pointer Berkas Lokal di Browser Sandbox

### 3.1 Pilihan Teknologi: File System Access API + IndexedDB
`<input type="file">` standar HTML tidak mengizinkan penyimpanan path absolut OS dan objek `File` di dalamnya akan mati segera setelah tab ditutup.

**Solusi Arsitektur:**
1. Menggunakan **`window.showOpenFilePicker({ multiple: true, types: [...] })`** (didukung penuh oleh Google Chrome dan Microsoft Edge).
2. Objek **`FileSystemFileHandle`** yang dihasilkan disimpan langsung ke **IndexedDB** (`worship-deck-media`, object store `local-handles`). Browser Chromium mendukung *structured clone* untuk `FileSystemFileHandle` ke IndexedDB secara native.
3. Yang disimpan ke IndexedDB hanyalah **referensi handle OS dan metadata ringan** (`name`, `size`, `lastModified`, `mimeType`), **bukan binary data file**. Ini menjamin konsumsi storage browser tetap < 100 KB walau playlist memuat puluhan video berukuran gigabyte.

### 3.2 Siklus Hidup Otorisasi (Permission Lifecycle)
Browser Chromium memberlakukan aturan keamanan ketat: izin membaca berkas lokal dari handle yang disimpan di IndexedDB bisa kembali ke status `'prompt'` saat browser direstart, dan pemanggilan `requestPermission()` **WAJIB dipicu oleh user gesture (klik mouse operator)**, tidak boleh otomatis saat load (akan di-reject / throw).

**Alur Otorisasi Kanonik:**
```
1. App Mount / Tab Presenter Terbuka:
   - Ambil playlist dari IndexedDB.
   - Untuk setiap item bertipe source: 'local':
     - Jalankan: const status = await handle.queryPermission({ mode: 'read' });
     - Jika 'granted' --> item.availability = 'ready' (bisa langsung diputar).
     - Jika 'prompt'  --> item.availability = 'permission-required' (tampilkan badge [LOKAL · Klik untuk izinkan]).
     - Jika 'denied'  --> item.availability = 'permission-denied'.

2. Operator Mengklik Item / Tombol "Aktifkan":
   - Event onClick (User Gesture Aktif) memanggil:
     const res = await handle.requestPermission({ mode: 'read' });
   - Jika 'granted' --> handle.getFile() --> buat Object URL / SW attach --> putar.
   - Jika ditolak  --> tampilkan opsi "Hubungkan Ulang / Pilih Berkas".
```

### 3.3 Penanganan Stale Handle, Flashdisk Dicabut, & File Dipindahkan
- **Flashdisk Dicabut / File Dihapus:** `handle.getFile()` melempar `NotFoundError`. Sistem menandai item dengan status `missing-handle` tanpa menghapus baris dari playlist (agar urutan playlist tetap terjaga). UI menampilkan badge `[LOKAL · Berkas Tidak Ditemukan / Colok Flashdisk]`.
- **Aksi Re-Link:** Tombol "Hubungkan Ulang" membuka kembali `showOpenFilePicker`. Saat file yang cocok dipilih, handle di IndexedDB diperbarui pada `id` yang sama, sehingga urutan playlist dan referensi tidak rusak.
- **Fallback Browser Non-Chromium (Firefox/Safari):** Jika `window.showOpenFilePicker` tidak tersedia, tombol lokal beralih ke `<input type="file">` dengan status `session-only`. Playlist tetap menyimpan nama file, namun menampilkan catatan bahwa persistensi lokal membutuhkan Chrome/Edge atau aplikasi Desktop.

---

## 4. Masalah 2: Proyeksi Video Lokal ke Jendela Proyektor Jemaat

Jendela Presenter (Layar 1) dan Jendela Proyektor (Layar 2) adalah dua window dokumen terpisah yang sinkron melalui `BroadcastChannel('worship-deck-present')`.

### 4.1 Perbandingan Opsi Mekanisme Proyeksi
| Parameter | Opsi A: Literal postMessage Blob | Opsi A': Shared Handle via IndexedDB | Opsi B: Service Worker (HTTP 206) | Opsi C: WebRTC captureStream | Opsi D: Local Go Bridge (Desktop) |
|---|---|---|---|---|---|
| **Seeking 500 MB – 1 GB** | Rawan macet pada video besar | **Sangat Baik** (Native browser file seeking) | **Sangat Baik** (HTTP Range `Accept-Ranges`) | **Gagal** (Tidak bisa seek independen) | **Sangat Baik** (OS File Range Streaming) |
| **Konsumsi RAM** | **Bahaya OOM** (Duplikasi 1 GB di RAM) | **Rendah** (File pointer lokal OS) | **Nol / Minimal** (Streaming chunk 64–256 KB) | Tinggi (CPU/GPU encoding 1080p) | Rendah (Disk streaming) |
| **Kompleksitas Kode** | Rendah | **Rendah – Sedang** (Tanpa Service Worker) | Sedang – Tinggi (SW lifecycle & scope) | Sangat Tinggi (Signaling, ICE) | Rendah (Sudah ada di Go API) |
| **Ketahanan Reload Proyektor** | Buruk (Blob hilang, re-transfer) | **Baik** (Proyektor baca ulang handle dari IDB) | **Sangat Baik** (Proyektor re-fetch URL virtual) | Buruk (Koneksi putus total) | **Sangat Baik** (URL stabil) |
| **Kompatibilitas Dev Web** | Ya | **Ya (Chrome/Edge)** | **Ya (Chrome/Edge)** | Ya | **Tidak** (Hanya Desktop lokal) |

### 4.2 Rekomendasi Arsitektur Bertingkat (*Tiered Recommendation*)

Quorum menyepakati strategi bertingkat yang pragmatis dan fail-closed:

#### Tingkat 1: Browser Mode Web (Pilihan Utama: Opsi A' Didukung Opsi B)
- **Opsi A' (Shared IndexedDB Handle $\to$ Object URL per Window):**
  - Karena Presenter dan Proyektor berada pada **origin yang sama** (`https://presenter-dev.bic.my.id`), jendela Proyektor dapat membaca `FileSystemFileHandle` yang sama dari IndexedDB menggunakan `mediaId`.
  - Jendela Proyektor memanggil `handle.getFile()` dan membuat `URL.createObjectURL(file)` miliknya sendiri secara independen.
  - `<video>` Chromium melakukan disk-buffered range seeking langsung ke file OS tanpa menduplikasi data ke RAM JavaScript.
  - **Keuntungan:** Tidak memerlukan registrasi Service Worker baru, nol moving parts jaringan, dan implementasi selesai dalam hitungan jam.
- **Opsi B (Service Worker Range Streamer `/local-media/{id}`):**
  - Menjadi evolusi penguatan jika browser membatasi grant handle antar-jendela tanpa user interaction di tab kedua.
  - Service Worker mencegat `/local-media/{id}` dan melayani `206 Partial Content` via `file.slice()`.

#### Tingkat 2: Desktop Mode (WorshipDeck Windows / WebView2)
- Menggunakan **Opsi D (Local Go Bridge)**: Backend Go lokal di `127.0.0.1` mengekspos endpoint `/api/local-media/{token}` dengan HTTP Range streaming native dari path file Windows. Tidak dibatasi sandbox browser dan 100% offline.

---

## 5. Kontrak Data & Wire Protocol

### 5.1 Skema Playlist Global (`playlist-model.ts`)
```ts
export type MediaSource = 'local' | 'cloud';

export type LocalMediaAvailability =
  | 'ready'
  | 'permission-required'
  | 'missing-handle'
  | 'unsupported';

export interface PlaylistItem {
  id: string;
  name: string;
  source: MediaSource;          // Visual badge: [LOKAL] vs [CLOUD]
  type: 'audio' | 'video';
  duration?: number;
  size?: number;
  
  // Cloud-specific
  url?: string;                 // "/api/uploads/<hash>.<ext>"
  
  // Local-specific
  handleRefId?: string;         // Foreign key ke IndexedDB local-handles
  availability?: LocalMediaAvailability;
  lastModified?: number;
  mimeType?: string;
  
  status?: 'ready' | 'loading' | 'error';
  errorMessage?: string;
}
```

### 5.2 Protokol Wire Broadcast Channel (`present-channel.ts`)
```ts
export type ProjectedSource =
  | { kind: 'deck' }
  | { kind: 'guest'; guestSessionId: string }
  | {
      kind: 'media';
      mediaId: string;
      mediaUrl: string;        // Cloud: "/api/uploads/..."; Local A': "idb://<mediaId>"; Local B: "/local-media/<id>"
      source: 'local' | 'cloud';
      isPlaying: boolean;
      mediaTime: number;
      at: number;
      revision: number;
    };
```
- **Invarian Audio:** Tetap 100% dipatuhi. Audio hanya berbunyi di browser Presenter (jack audio mixer). Elemen `<video>` di Proyektor jemaat **wajib disetel `muted = true`** secara mutlak.
- **Invarian Kepanikan (*Panic Controls*):** Tombol Play/Pause, Fade Out (3 detik linear), Mute, dan Take Off Screen beroperasi lokal di sisi Presenter dan menyiarkan perubahan state seketika melalui `BroadcastChannel`.

---

## 6. Skenario Operasional Sanctuary & Mitigasi

1. **Flashdisk Dicabut Saat Video Sedang Tayang:**
   - Pembacaan byte video akan melempar error I/O (`MEDIA_ERR_SRC_NOT_SUPPORTED` atau `error event`).
   - Media engine presenter langsung mematikan pemutaran, menampilkan toast "Berkas media terputus", dan secara otomatis mengirim sinyal `{ kind: 'deck' }` sehingga proyektor jemaat **seketika kembali ke slide aktif** (tidak ada layar hitam atau video macet di hadapan jemaat).
2. **Reload Tab Proyektor di Tengah Tayangan:**
   - Saat jendela proyektor direload (F5), proyektor mengirim pesan `request-sync`.
   - Presenter menjawab dengan snapshot state aktif (`mediaId`, `mediaTime`, `isPlaying`). Proyektor mengambil handle dari IndexedDB, membuat Object URL, seek ke `mediaTime`, dan melanjutkan sinkronisasi tanpa interupsi pada presenter.
3. **Persistensi Playlist Antar-Minggu:**
   - Playlist disimpan di IndexedDB dengan key global `'worship-deck-global-media-playlist'`.
   - Seluruh service/ibadah mengakses perpustakaan yang sama. Operator cukup mengklik satu kali tombol "Hubungkan Akses Media" saat membuka aplikasi di hari Minggu untuk mengaktifkan seluruh lagu BGM/video lokal yang tersimpan dari minggu sebelumnya.

---

## 7. Rencana Tindak Lanjut (Menuju SPEC-111)

Dokumen RFC ini menjadi landasan resmi untuk perumusan spesifikasi fitur baru:
1. **Penerbitan Keputusan Mandat (DEC Baru):** Menerbitkan DEC untuk memperbarui batasan SPEC-110 § 3.1 agar mengizinkan FSA API + IndexedDB untuk berkas lokal.
2. **Penyusunan Spesifikasi SPEC-111:**
   - **SPEC-111-01:** Implementasi `LocalMediaRegistry` (IndexedDB handle storage & permission manager).
   - **SPEC-111-02:** Pembaruan UI Playlist (Badge `[LOKAL]` / `[CLOUD]`, tombol permission, uploader picker FSA).
   - **SPEC-111-03:** Sinkronisasi Proyektor Lintas Window via Shared Handle Object URL (Opsi A') dan Channel Invariants.
   - **SPEC-111-04:** Guard Test Suite & Verification (Injeksi defek izin, disconnect flashdisk, dan paritas seek).

# SPEC-111 — Direct Local Media Playback, Conscious Offline Downloader, and Two-Tab Media Library

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-23` (Transition Style Is One Value, Described Once, Consumed Identically) — governs media transition timing and enter/exit easing.
  - `AD-24` (Operator Chrome State Is Browser-Local, and Room-Facing Surface Is Closed to It) — Room display renders exclusively media content; operator chrome is never projected.
  - `AD-10` (presenter-authority BroadcastChannel, state-not-instruction, idempotent-on-the-wire) — governs presenter-authored `ProjectedSource.kind: 'media'` with `source: 'local' | 'cloud'`.
  - `AD-29` (The Projector Reports Its Own Liveness and Nothing Else, and One Predicate Decides It) — projector reports media status acknowledgment and error reasons.
- **Functional Requirements**:
  - `FR-16` (Two-Screen Presenter View in the Browser) — Presenter console maintains single authority over media projection and slide controls. Extended for two-tier media library per ratified Opus Kernel K1–K5.
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls and Projector Sync) — Extended to include persistent two-tier media library (server SQLite + local IndexedDB), conscious downloader, local-first playback priority, and fixed top control bar.
- **Components**: `presenter`
- **Touches**: `operator-present`, `projector-client`, `present-channel`, `uploads`

---

## 1. Problem Statement & User Need

In sanctuary operations, church operators frequently bring USB flash drives or external drives containing background music (MP3/WAV) or testimony/announcement videos (MP4/WebM) 500 MB – 1 GB shortly before service begins.

SPEC-110 introduced an in-console media player, but suffered from three critical operational gaps:
1. **Mandatory Remote Upload**: Media files had to be uploaded to the VPS backend via `POST /api/upload`, burning cellular/Wi-Fi bandwidth and failing completely if sanctuary internet is offline or slow.
2. **Ephemeral In-Memory Playlist**: Playlists were wiped upon tab reload (F5) or browser restart, forcing operators to re-upload or re-select files every service.
3. **Bottom Dock Ergonomic Hazard (Scroll Issue)**: The media dock was positioned at the bottom of the page container. When the slide list or rundown is long, the dock is pushed down below the fold, forcing operators to scroll to reach transport or panic controls.
4. **Lack of Conscious Offline Readiness**: Operators had no way to distinguish what media is in the cloud vs what is stored on the laptop, and no mechanism to download cloud media consciously in advance for guaranteed offline playback.

---

## 2. Ratified Architectural & UX Decisions (Opus Kernel K1–K4 & Absence Guards)

### 2.1 UI/UX Dua Tab & Top Control Bar (Kernel K1)
- **Dua Tab Kanonik di `MediaDrawer`**:
  - `Pustaka Cloud` (default): Menampilkan katalog media di server/cloud.
  - `Media Laptop`: Menampilkan media yang tersimpan offline di laptop operator (hasil download atau impor lokal).
- **Top Control Bar Tanpa Pergeseran Layar (Zero Layout Shift)**:
  - Bilah kontrol media ditempatkan di antara header cluster (di bawah `presenter-header-row-3`) dan monitor slide.
  - Menempati **slot dengan tinggi tetap (~44px)**. Saat belum ada media yang di-cue, bilah tampil dalam status `disabled`. Munculnya media tidak boleh menggeser monitor slide saat ibadah berlangsung.
  - Menampilkan **indikator sumber**: badge teks `Lokal` atau `Cloud` untuk item yang sedang diputar.
  - **Panic Controls & Focus Safety**: Carried forward from SPEC-110 and established presenter ergonomics (`HymnNumberAutocomplete`, `ScriptureRefAutocomplete`): Play/Pause, Fade Out (~3s linear attenuation), Mute, dan Take Off Screen beroperasi lokal pada konsol operator dengan `onMouseDown={(e) => e.preventDefault()}` agar penekanan tombol `Space` global tetap memajukan slide presentasi.
- **Kontrak 4 State Badge (Tab Cloud — Tanpa Emoji)**:
  Menggunakan ikon SVG dari icon registry ditambah label teks yang selalu terlihat:
  1. `streaming-only`: Label "Streaming", tombol aksi `[Unduh]`. (sha256 tidak ada di indeks lokal).
  2. `downloading`: Label "Mengunduh N%", elemen `role="progressbar"` + `aria-valuenow`, tombol aksi `[Batal]`.
  3. `local`: Label "Tersedia di lokal", badge success. (sha256 terverifikasi di indeks lokal).
  4. `detached`: Label "File terlepas", tombol aksi `[Sambungkan ulang]`. (Satu klik memulihkan seluruh folder).

### 2.2 Alur Conscious Downloader (Kernel K2)
- **Primer: `window.showDirectoryPicker()`**: Folder lokal (misal `D:\WorshipDeck\Media`) dipilih **satu kali saja**, dan handle folder disimpan di IndexedDB (`local-handles`).
- **Cadangan (Fallback): OPFS**: Digunakan jika API picker tidak didukung atau ditolak operator, dengan label jujur "Penyimpanan internal aplikasi" dan pemanggilan `navigator.storage.persist()`.
- **`<a download>` Dilarang** sebagai media storage engine.
- **Invarian Unduhan**:
  - **Nol auto-download**: Tidak ada prefetch atau auto-cache latar belakang tanpa klik eksplisit operator.
  - Antrean unduhan sekuensial (konkurensi 1).
  - Penulisan atomik via `createWritable()`, stream hash dihitung inkremental dan diverifikasi terhadap sha256 server (mismatch langsung di-`abort()`).
  - Hapus dari Tab Lokal = melepas dari indeks, tidak menghapus berkas fisik di disk Explorer operator.

### 2.3 Playback Routing: Local-First Priority (Kernel K3)
- **Resolusi Saat Cue/Load**: Jika item Cloud berstatus `local`, playback otomatis dialihkan ke Service Worker `/local-media/<sha256>` (menghemat bandwidth internet gereja).
- **Syarat Lokal**: sha256 ada di indeks lokal; izin handle `granted`; ukuran & mtime sama; dan `navigator.serviceWorker.controller` aktif di jendela presenter & proyektor.
- **Graceful Fallback**: Jika syarat lokal gagal saat cue, fallback otomatis ke cloud streaming + toast pemberitahuan ke operator.
- **Fail-Closed Mid-Playback**: Jika file lokal terputus di tengah pemutaran, pemutaran berhenti rapi dan proyektor kembali ke slide aktif (tidak ada layar hitam).
- **Audio Routing Invariant**: Laptop operator (mixer gereja) adalah satu-satunya kanal bersuara. Proyektor jemaat wajib `muted = true` 100%.

### 2.4 Backend Go SQLite (Kernel K4)
- Tabel baru: `media_playlist_items` di `internal/db/schema.sql` dan migrasi database:
  - `storage_key` (bukan URL absolut), `sha256 TEXT NOT NULL` (dihitung oleh server saat ingest via `io.TeeReader`), `size_bytes`, `duration_ms`, dan `order_key`.
- **Unlink vs Purge**: `DELETE /api/media/playlist/:id` secara bawaan hanya melepas baris (*unlink*). Pembersihan berkas fisik di server (*purge*) dipisahkan sebagai aksi eksplisit jika *refcount = 0* (dihitung via query lintas tabel).

---

## 3. Struktur 9 Tiket Linear SPEC-111

1. **`SPEC-111-01`**: *Spike Kapabilitas WebView2, Service Worker Handle, dan OPFS Fallback*
2. **`SPEC-111-02`**: *Skema SQLite & Migrasi Backend Go `media_playlist_items`*
3. **`SPEC-111-03`**: *API Playlist Backend, Content Range 206, dan Refcount Unlink*
4. **`SPEC-111-04`**: *Local Media Store, Web Worker Incremental Hashing, dan IndexedDB Index*
5. **`SPEC-111-05`**: *Service Worker Virtual Streamer `/local-media/<sha256>` & Channel Sync*
6. **`SPEC-111-06`**: *UI Dua Tab MediaDrawer, Kontrak Badge 4-State, dan Impor Manual*
7. **`SPEC-111-07`**: *Conscious Downloader Engine, Folder Handle, dan Atomic Writable Stream*
8. **`SPEC-111-08`**: *Local-First Playback Routing & Fixed Top Control Bar Ergonomics*
9. **`SPEC-111-09`**: *Verifikasi End-to-End, WebView2 Parity, dan 5 Absence Guards*

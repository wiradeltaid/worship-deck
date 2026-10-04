# Prompting Handover — Architectural, Safety, and Quality Review: SPEC-101 (Guest Speaker HDMI Video Capture Input)

Gunakan prompt di bawah ini ketika meminta review kepada masing-masing model (**DeepSeek Pro, GPT Sol, Qwen Max, GLM-5.3, Claude Opus**).

---

```markdown
Anda adalah Technical Lead & Principal Architect independen yang ditugaskan untuk melakukan adversarial review mendalam terhadap rancangan fitur baru di repositori **WorshipDeck** (aplikasi church presentation & staging suite berbasis React 19 + Go API + SQLite).

## Konteks Fitur: SPEC-101 (Guest Speaker HDMI Video Capture Input)
Gereja memiliki skenario di mana pembicara/pengkhotbah tamu membawa laptop sendiri untuk menampilkan slide/video khotbah. Gereja memiliki:
1. **UGREEN 50633A Wireless HDMI (Pair 1)**: Laptop WorshipDeck HDMI-Out ──► Proyektor Utama Gedung (sudah berjalan normal sebagai Layar 2 / Extended Monitor).
2. **UGREEN 50633A Wireless HDMI (Pair 2)**: Laptop Pengkhotbah (TX) ──► Receiver (RX) ──► USB HDMI Capture Card (UVC) dicolokkan ke port USB 3.0 Laptop Operator WorshipDeck.

Tim merancang **SPEC-101** agar WorshipDeck di browser operator dapat mendeteksi USB HDMI Capture Card tersebut, memberikan thumbnail preview bagi operator, dan mengizinkan operator mengalihkan layar proyektor jemaat (`ProjectorClient.tsx`) secara instan ke live feed pengkhotbah, serta beralih kembali ke slide liturgi saat khotbah selesai.

Dokumen spesifikasi dan tiket yang telah disusun:
- Spec: `.scratch/SPEC-101-guest-speaker-hdmi-video-capture-input/SPEC.md`
- Tiket 01: `.scratch/SPEC-101-guest-speaker-hdmi-video-capture-input/issues/01-capture-broker-device-enumeration-and-preview.md`
  (CaptureBroker hardware singleton, browser audio exclusion `audio: false`, frame readiness detection via `canplay`, consumer track cloning `track.clone()`, dan cleanup).
- Tiket 02: `.scratch/SPEC-101-guest-speaker-hdmi-video-capture-input/issues/02-presenter-guest-feed-controls-and-channel-state.md`
  (Presenter Header UI, device dropdown, operator preview thumbnail, signal badge 1080p, state machine `idle -> arming -> ready -> live -> revert -> disarm`, hotkey `G` dan `Escape`, ephemeral channel sync via `present-channel`).
- Tiket 03: `.scratch/SPEC-101-guest-speaker-hdmi-video-capture-input/issues/03-projector-media-bridge-fullscreen-rendering-and-fallback.md`
  (Same-origin opener media bridge via `window.opener`, contained fullscreen video `object-fit: contain; background: #000; z-30`, blank screen overlay occlusion `z-50`, authoritative hard fallback ke slide deck saat signal loss / `track.onended`).

Invarian arsitektur yang mengikat di WorshipDeck:
- **AD-1 (Sabbath Guarantee)**: Slide deck PPTX/DOM adalah Plan A; streaming media adalah Plan B yang harus bisa failover instan tanpa black screen freeze.
- **AD-10 (Single Presenter Sync Channel)**: BroadcastChannel membawa state semantik serializable (`projectedSource: 'deck' | 'guest'`, `guestSessionId`), TIDAK PERNAH membawa objek MediaStream atau binary buffers.
- **AD-24 (Room-Facing Surface Closed to Chrome)**: Layar proyektor jemaat steril dari kontrol operator, error toast teknis, atau device selector. Tombol Blank Screen (`B`) menutupi seluruh layar di `z-50`.
- **AD-29 (Presenter-Projector Liveness Handshake)**: Ping-pong heartbeat liveness proyektor tetap independen dari lifecycle video hardware.

---

## 6 Pertanyaan Kritis yang Wajib Anda Analisis & Jawab:

Mohon berikan evaluasi kritis, tanpa basa-basi, mencakup 6 pilar berikut:

### 1. Keamanan & Kelayakan Teknis (Safety & Feasibility)
- Apakah pendekatan `getUserMedia()` untuk USB Capture Card di lingkungan Windows/Chromium ini 100% realistis dan aman?
- Apakah ada potensi crash driver UVC, DirectShow/MediaFoundation deadlock, atau memory leak jika stream video berjalan terus-menerus selama ibadah (1.5 - 2 jam)?
- Apakah jaminan ketiadaan audio loop/howling sudah kedap hanya dengan `audio: false` di browser?
- Apakah secure context constraint (`localhost` vs LAN IP) akan menjadi jebakan fatal jika operator menggunakan laptop non-host?

### 2. Risiko Regresi terhadap Fitur & Fungsi yang Sudah Ada
- Apakah penambahan layer video di `ProjectorClient.tsx` berisiko merusak integrasi dual-monitor (`SPEC-99`), scripture overlay continuation (`SPEC-100`), atau layout canvas Fabric.js?
- Apakah sinkronisasi `present-channel` terancam desync jika operator melakukan navigasi slide saat live video sedang tayang?

### 3. Ketepatan Rancangan Arsitektur (Architectural Soundness)
- Apakah arsitektur **Single CaptureBroker (Operator) + Cloned Track Fan-out (`track.clone()`) + Same-Origin Opener Bridge (`window.opener`)** sudah merupakan pilihan paling optimal di browser, ataukah ada kelemahan struktural?
- Apa yang terjadi jika jendela proyektor direload oleh operator, atau dibuka secara terpisah tanpa `opener`? Apakah kontrak fail-closed ke slide deck sudah tepat?

### 4. Kelengkapan Test Case & Failure Modes
- Periksa daftar skenario uji pada Tiket 01, 02, dan 03. Edge case apa saja yang belum ter-cover?
  *(Misalnya: laptop pembicara sleep mid-sermon, kabel HDMI dicabut mendadak, pergantian resolusi 16:10 ke 16:9, re-arming saat stream masih live, atau popup proyektor ditutup paksa).*
- Apakah rencana pengujian unit & mock-nya cukup untuk menjamin keandalan saat hardware nyata dicolokkan?

### 5. Ketepatan Ergonomi & UI/UX Operator
- Evaluasi alur: `Pilih Device` -> `Arm` -> `Pre-warm Preview` -> `Switch to Live` -> `Revert/Panic Button` -> `Disarm`.
- Apakah alur ini cukup cepat dan aman bagi operator sukarelawan gereja di bawah tekanan waktu ibadah live? Apakah tombol Revert/Panic button sudah cukup responsif dan aman?

### 6. Ketepatan Desain & Analisa Keseluruhan
- Menurut Anda, apakah tim sebaiknya mengimplementasikan fitur native ini di WorshipDeck, ATAU justru merekomendasikan gereja tetap memakai **Hardware HDMI Switcher fisik (2x1)** di meja operator?
- Berikan skor kesiapan (1-10) dan daftar perbaikan mutlak (blocking items) yang wajib disempurnakan sebelum kode mulai ditulis.

Format Jawaban:
- **Ringkasan Eksekutif & Verdict** (Accept / Accept with Changes / Reject)
- **Analisis Mendalam per 6 Pertanyaan**
- **Daftar Celah / Blindspot yang Terlewatkan**
- **Rekomendasi Tindakan Nyata bagi Tim**
```

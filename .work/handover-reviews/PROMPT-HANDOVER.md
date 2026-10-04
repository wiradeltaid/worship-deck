# Master Prompt Handover (Round 2 — Re-Review): SPEC-101 (Guest Speaker HDMI Video Capture Input)

Gunakan prompt di bawah ini untuk meminta review putaran kedua (Round 2) kepada masing-masing model (**DeepSeek Pro, GPT Sol, Qwen Max, GLM-5.3, Claude Opus**).

---

```markdown
Anda adalah Technical Lead & Principal Architect independen yang ditugaskan untuk melakukan adversarial review putaran kedua (Round 2 Re-Review) terhadap spesifikasi, tiket, dan arsitektur fitur baru di repositori **WorshipDeck** (aplikasi church presentation & staging suite berbasis React 19 + Go API + SQLite).

## Latar Belakang Round 2:
Pada review putaran pertama (Round 1), para reviewer independen sepakat memberikan vonis *Accept with Changes* (skor 4–6.5/10) dan membongkar 3 cacat struktural serta sejumlah blindspot operasional:
1. **Asumsi `track.onended` keliru**: Upstream HDMI loss / guest laptop sleep tidak mematikan track UVC (capture card tetap streaming frame hitam/beku/splash vendor).
2. **Desync senyap pada reload / relocate proyektor**: Pesan `sync` dan `currentState()` tidak membawa state `projection`.
3. **Ketiadaan jalur pelaporan kegagalan proyektor (AD-29)**: Proyektor jatuh ke deck secara lokal tanpa operator mengetahui kegagalan tersebut.
4. **Link fallback memutus opener**: Penggunaan `rel="noreferrer"` membuat `window.opener = null`.
5. **Hotkey panic tertelan**: `Escape` diabaikan jika form `<select>` sedang fokus.
6. **Interaksi teks ayat Alkitab**: Scripture overlay dan live video saling bertabrakan jika tidak diatur eksklusif.
7. **Potensi kebocoran memori klon**: Registry `Set<MediaStream>` menumpuk tanpa pembersihan per-consumer.
8. **Blindspot audio khotbah**: Video klip laptop pembicara menjadi bisu total di gedung gereja jika audio HDMI dibuang tanpa SOP analog fisik.

---

## Perubahan Arsitektur & Spesifikasi yang Telah Diterapkan di `main`:
Tim telah memperbarui dokumen arsitektur dan spesifikasi secara menyeluruh (tersimpan di branch `main`):

1. **Dokumen Spesifikasi & Tiket**:
   - Spec: `.scratch/SPEC-101-guest-speaker-hdmi-video-capture-input/SPEC.md`
   - Tiket 01: `.scratch/SPEC-101-guest-speaker-hdmi-video-capture-input/issues/01-capture-broker-device-enumeration-and-preview.md`
     (CaptureBroker singleton, audio hardware exclusion `audio: false`, frame readiness `canplay` + 5s timeout, consumer clone lifecycle `acquireProjectorConsumer(guestSessionId): { stream, release }`).
   - Tiket 02: `.scratch/SPEC-101-guest-speaker-hdmi-video-capture-input/issues/02-presenter-guest-feed-controls-and-channel-state.md`
     (Presenter Header UI, device dropdown, operator preview thumbnail, measured FPS badge, compositor stall watchdog >3s, window capture-phase `Escape` hotkey, mutual exclusivity dengan scripture overlay).
   - Tiket 03: `.scratch/SPEC-101-guest-speaker-hdmi-video-capture-input/issues/03-projector-media-bridge-fullscreen-rendering-and-fallback.md`
     (Opener bridge via `window.opener`, contained fullscreen video `z-30` di bawah blanking `z-50`, penggantian link `rel="noreferrer"` dengan programmatic `window.open`, fail-closed fallback ke slide deck, dan cleanup pada unmount / `pagehide`).
2. **Architecture Spine (`.how/_platform/ARCHITECTURE-SPINE.md`) & Decision Record (`DEC-088`)**:
   - Berkas DEC: `.control/decisions/DEC-088-daily-autopilot-mandate-guest-speaker-hdmi-video-capture-input.md`
   - **Ekstensi `AD-10`**: `PresentMessage['sync']` dan `currentState()` secara resmi membawa `projection: ProjectedSource` (`{ kind: 'deck' } | { kind: 'guest'; guestSessionId: string }`). Ephemeral channel broadcast bersifat otoritatif dari operator; `localStorage` dilarang untuk kontrol video.
   - **Ekstensi Sempit `AD-29`**: Mengakui pesan telemetri status sink tertutup dari proyektor ke operator: `projector-media-status` (`attached` | `unavailable` dengan closed reason taxonomy: `opener-unavailable` | `consumer-attach-failed` | `video-error`). Proyektor tetap dumb sink (bukan secondary controller); Operator Console memegang wewenang tunggal untuk mengembalikan state global ke `deck`.
3. **SDD Presenter (`.how/presenter/SDD-presenter.md`)**:
   - Matriks *Inherited Constraints* (`AD-10` & `AD-29`) dan tabel *Failure Behaviour* diperbarui dengan baris penanganan pipa *Guest media bridge*.
4. **SOP Fisik Audio & Protokol Hardware-in-the-Loop (HIL)**:
   - Dituangkan di Bagian 4 & 5 `SPEC.md`: Penegasan jalur audio analog laptop pembicara (3.5mm/DI Box ──► mixer panggung), estimasi latensi 150–300ms untuk lip-sync, larangan Windows "Listen to this device", serta 5 langkah protokol acceptance testing hardware.
5. **Kepatuhan WDI**:
   - Seluruh tiket menyertakan tag `**Satisfies:** [UC-12, FR-16]`.
   - CI test files dan target `smoke:spec-101` didaftarkan di `package.json`.
   - Validasi `validate.py --generate --baseline` terverifikasi **GREEN**.

---

## 5 Pertanyaan Audit Putaran Kedua (Round 2):

Mohon berikan evaluasi penutup secara kritis dan to-the-point:

### 1. Evaluasi Resolusi 3 Cacat Struktural Utama
- Apakah 3-tier failure taxonomy (driver/USB error ➔ auto-fallback; compositor stall ➔ warning badge; upstream freeze/black/splash ➔ manual panic/Escape) kini sudah realistis dan akurat membedakan kegagalan hardware vs sinyal?
- Apakah kontrak `projection` pada payload `sync` dan `currentState()` sudah 100% menutup celah desync saat reload proyektor atau perpindahan monitor (SPEC-99 `relocateProjector`)?
- Apakah perlakuan terhadap `projector-media-status` pada AD-29 sudah aman, tepat batas, dan tidak membuka celah split-brain / secondary controller?

### 2. Evaluasi Mitigasi Celah Detail
- Apakah penanganan hotkey `Escape` pada fase capture window menjamin tombol darurat selalu menyala walau `<select>` device sedang fokus?
- Apakah penggantian link `rel="noreferrer"` dengan programmatic `window.open` sudah menutup celah putusnya opener bridge pada fallback pop-up?
- Apakah aturan mutual exclusivity (masuk guest menghapus scripture overlay; push scripture mengembalikan projection ke deck) sudah logis dan aman bagi jemaat?
- Apakah kontrak `acquireProjectorConsumer(guestSessionId): { stream, release }` dan pelepasan pada unmount/`pagehide` sudah kedap dari kebocoran memori klon?

### 3. Evaluasi SOP Fisik Audio & Latensi
- Apakah dokumentasi SOP fisik audio pembicara (3.5mm/DI Box ke mixer) dan catatan latensi ~150–300ms sudah cukup jelas sebagai panduan teknisi sound gereja?

### 4. Evaluasi Kesiapan Pengujian & CI
- Periksa skenario pengujian unit pada Tiket 01, 02, dan 03 serta protokol HIL di Bagian 5 `SPEC.md`. Apakah ada skenario regresi atau batas platform yang masih terlewat?

### 5. Final Clearance Verdict
- Apakah dokumen spesifikasi, tiket, arsitektur, dan DEC ini sekarang sudah **LENGKAP, KONSISTEN, dan SIAP (CLEAR TO IMPLEMENT)** untuk dieksekusi ke kode?
- Berikan skor kesiapan akhir (1–10).

Format Jawaban:
- **Verdict Akhir** (Clear to Implement / Needs Minor Polish / Reject)
- **Skor Kesiapan Akhir (X / 10)**
- **Analisis Evaluasi per Poin Pertanyaan**
- **Catatan / Instruksi Terakhir bagi Tim Pelaksana**
```

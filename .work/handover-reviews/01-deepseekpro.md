# Review Handover (Round 2): DeepSeek Pro (CommandCode / OpenCode)

**Tanggal:** 2026-10-04
**Target Fitur:** SPEC-101 (Guest Speaker HDMI Video Capture Input) — Round 2 Re-Review
**Status Review:** Pending Input Reviewer

---

## Verdict Akhir
**Needs Minor Polish**

## Skor Kesiapan Akhir
**8 / 10**

---

## Analisis Evaluasi per Poin Pertanyaan

### 1. Resolusi 3 Cacat Struktural Utama

**1a. 3-tier failure taxonomy — REALISTIS dan AKURAT.** Ini resolusi yang paling jujur secara rekayasa. Titik kuncinya tepat: kartu UVC vendor yang memancarkan splash "No Signal" *tetap memproduksi frame*, sehingga tier-1 (`track.onended`) dan tier-2 (compositor watchdog) sama-sama luput, dan hanya tier-3 (panic manual) yang menangkapnya. Spec dengan benar menolak pixel-inspection sebagai solusi — itu jawaban engineering yang benar, bukan penghindaran. Pembedaan hardware vs sinyal akurat.

**1b. Kontrak `projection` — menutup arah reload-proyektor, masih ada dua celah kecil.** Reload/relocate proyektor (`SPEC-99 relocateProjector`) benar-benar tertutup: `sync` + `currentState()` membawa `ProjectedSource`, proyektor re-acquire clone via `window.opener.__worshipDeckCaptureBroker`. Dua residu:
- **Reload jendela *operator*** (bukan proyektor) tidak diuji. `getUserMedia` tidak bertahan reload, state machine reset ke `idle` → `deck` (benar, fail-closed), tapi skenario ini absen dari HIL Bagian 5 maupun daftar unit test.
- **`acquireProjectorConsumer(guestSessionId)` tidak memvalidasi `guestSessionId`** terhadap sesi master yang hidup (Tiket 01 hanya meng-clone `masterVideoTrack` tanpa cek). ID basi/mismatch tetap mengembalikan stream valid, bukan `consumer-attach-failed`.

**1c. Perlakuan AD-29 — tepat batas, TAPI telemetri tidak idempoten.** Perluasan `projector-media-status` (`attached | unavailable` + closed reason taxonomy) benar-benar non-controlling dan tidak membuat proyektor jadi secondary controller. **Namun** ada celah split-brain sempit yang belum ditutup: `projector-media-status` bersifat *single-shot / fire-and-forget*, berbeda dengan ack liveness AD-29 yang "idempotent by construction". Jika pesan `unavailable` hilang di BroadcastChannel (delivery best-effort, konsisten dengan model AD-10), operator tetap `live` (preview tampak hidup karena master utuh) sementara proyektor sudah revert ke deck secara lokal — dan tidak ada *next message* yang self-heal karena proyektor tidak re-emit. Ini celah nyata yang perlu reconcile lewat `request-sync` atau re-emit.

### 2. Mitigasi Celah Detail

**2a. Hotkey Escape — teknik benar, presedensi belum didefinisikan.** Handler capture-phase (`addEventListener('keydown', …, { capture: true })`) adalah cara yang benar untuk menyalip `<select>` yang sedang fokus. Dua catatan: (1) handler harus `preventDefault()` agar dropdown `<select>` tidak *juga* ikut tertutup; (2) spec tidak menyatakan presedensi Escape terhadap handler Escape global yang sudah ada (blank / clear-scripture / exit-fullscreen) — harus ditetapkan agar "tombol darurat selalu menyala" tidak ambigu.

**2b. `noreferrer` → programmatic `window.open` — benar.** Ini menutup putusnya `window.opener`. Catatan kecil: selaraskan dengan jalur pembuka proyektor yang sudah ada (`PROJECTOR_FEATURES`, `PresenterOperator.tsx:103`) agar tidak ada dua mekanisme buka-jendela yang berbeda.

**2c. Mutual exclusivity — logis dan aman bagi jemaat.** Masuk guest menghapus scripture, push scripture mengembalikan ke deck: benar, karena teks ayat tidak boleh menimpa video langsung. Satu hal yang belum eksplisit: revert guest→deck **tidak** mengembalikan scripture yang sudah dihapus (dianggap hilang). Itu masuk akal, tapi harus dinyatakan agar tidak dibaca sebagai bug.

**2d. Kontrak `acquireProjectorConsumer` — kebocoran klon HANYA TERTUTUP SEBAGIAN.** `release()` pada unmount/`pagehide` menangani penutupan normal. **Namun** temuan Round-1 soal `Set<MediaStream>` menumpuk belum sepenuhnya beres: jika jendela proyektor *crash / ditutup paksa* (tombol X, OOM, kill), `pagehide`/unmount **tidak** dipanggil, clone tetap tertahan di `Set` operator selamanya karena clone adalah objek JS yang dipegang registry — tidak di-GC meski jendela mati. Tidak ada liveness hook untuk memangkas orphan. HIL Bagian 5 hanya mensimulasikan navigasi slide + "no browser crashes", bukan penutupan paksa proyektor saat live. Ini residu temuan Round-1 yang perlu mekanisme prune (mis. `track.onended` pada clone, atau referensi handle).

### 3. SOP Fisik Audio & Latensi

**Cukup jelas sebagai panduan teknisi.** Jalur 3.5mm/DI Box → mixer, larangan "Listen to this device", verifikasi perangkat playback Windows, dan arah latensi (audio analog *mendahului* video, bukan sebaliknya) semuanya dinyatakan benar. Dua tambahan opsional: (1) laptop guest USB-C-only tanpa jack 3.5mm butuh dongle; (2) ground-loop/hum ditangani DI Box secara implisit — bisa disebut eksplisit satu baris.

### 4. Kesiapan Pengujian & CI

**Defect CI konkret (terverifikasi):** ketiga file test (`capture-broker-device-enumeration`, `presenter-guest-feed-controls`, `projector-guest-media-bridge`) **sudah didaftarkan** di `scripts.test` (baris 17) dan `smoke:spec-101` (baris 18–19) `package.json`, **tetapi file-nya belum ada di disk** (tiket masih `open`). Saya verifikasi `node --test <file-hilang>` keluar status 0 dengan "tests 0" — artinya `smoke:spec-101` dan `npm test` saat ini **hijau tapi kosong** untuk SPEC-101. Ini melanggar konvensi Testing di ARCHITECTURE-SPINE (baris 335: "register the test file in the same change set") dan membuat gate CI membuktikan nol hal. Klaim "validate.py GREEN" benar tapi tidak sama dengan `npm test`.

**Skenario regresi / batas platform yang terlewat:**
- **`requestVideoFrameCallback`**: tidak semua WebView2/Chromium mendukung; perlu feature-detect dengan fallback `requestAnimationFrame`/timer. Aplikasi ini punya jalur desktop installer (SPEC-90/89), jadi ini batas platform nyata.
- **Throttling rVFC saat jendela operator di-background**: watchdog stall (>3s) akan false-positive "Signal Stalled" ketika tab operator tersembunyi sementara proyektor tetap menayangkan. Belum diakui.
- Reload jendela operator saat guest live (lihat 1b).
- Penutupan paksa jendela proyektor dalam soak test (lihat 2d).
- Pembedaan `track.onended` pada clone vs master dalam test bridge.

### 5. Final Clearance

Inti arsitektur **LENGKAP dan KONSISTEN**: ketiga cacat struktural Round-1 benar-benar terselesaikan (taxonomy 3-tier, kontrak `projection`, telemetri AD-29), dan ekstensi AD-10/AD-29 tertulis konsisten di tiga tempat (ARCHITECTURE-SPINE baris 115 & 262, DEC-088, SDD-presenter baris 64/72/90). Detail mitigasi (Escape, opener bridge, mutual exclusivity) secara desain benar. Sisanya **polish**, bukan keputusan arsitektur — sehingga bukan *Reject*, tapi juga belum pantas *Clear to Implement* tanpa menutup defect CI dan dua residu ketahanan.

Satu inkonsistensi traceability minor: AD-10 (baris 115) menambah invariant *"advancing slide index while in guest projection retains guest projection"* yang **tidak** dicakup test di tiket mana pun — harus didaftarkan.

---

## Catatan / Instruksi Terakhir bagi Tim Pelaksana

1. **Perbaiki gate CI yang kosong.** Commit ketiga file test (atau minimal skeleton) *bersamaan* dengan pendaftarannya, atau cabut entri `package.json` sampai implementasi. Jangan biarkan `smoke:spec-101` hijau-tanpa-test.
2. **Tutup kebocoran klon sepenuhnya.** Jadikan `release()` idempoten (aman double-call unmount+pagehide) dan tambah mekanisme prune orphan (mis. `track.onended` pada clone atau referensi handle) untuk penutupan paksa proyektor. Tambah skenario "abrupt close saat live" ke HIL soak.
3. **Buat `projector-media-status` bisa re-emit/idempoten** atau reconcile via `request-sync`, supaya `unavailable` yang hilang tidak meninggalkan operator `live` vs proyektor `deck`.
4. **Feature-detect `requestVideoFrameCallback`** dengan fallback rAF; sadari throttling saat operator window tersembunyi (jangan false-flag "Signal Stalled").
5. **Validasi `guestSessionId`** di `acquireProjectorConsumer`; kembalikan `consumer-attach-failed` pada ID basi.
6. **Tambahkan test** untuk: advance-slide-saat-guest-live mempertahankan projection; revert-to-deck tidak mengembalikan scripture; reload jendela operator; presedensi Escape terhadap handler Escape global.

# Review Handover (Round 2): Sol

**Tanggal:** 2026-10-04
**Target Fitur:** SPEC-101 (Guest Speaker HDMI Video Capture Input) — Round 2 Re-Review
**Reviewer:** Peran Sol yang diminta pemilik; host sesi Codex.
**Baseline:** `e9a6b16c96369a41c3ee3e350e3a07b2263a1bab`, branch lokal `main-2`; ref lokal `origin/main` menunjuk commit yang sama saat pemeriksaan. Tidak melakukan fetch.
**Status Review:** Selesai; clearance ditahan.

---

**Verdict Akhir: Reject — untuk clearance implementasi atas kontrak saat ini.**
**Skor Kesiapan Akhir: 6.5 / 10.**

Round 2 memperbaiki arah desain: satu pemilik capture, audio dikecualikan, projection masuk snapshot sync, dan sink dapat melaporkan kegagalan. Namun kontrak masih memungkinkan operator berstatus live ketika proyektor tidak menampilkan video, atau laporan jendela lama menjatuhkan proyeksi baru. Perbaikannya terbatas; pola CaptureBroker + opener bridge dapat dipertahankan.

Review mencakup SPEC, tiket 01–03, spine AD-10/AD-29, SDD Presenter, DEC-088, kode presenter/projector yang sudah ada, serta registrasi test. Hasil reviewer lain tidak dibaca. Ini review individual, bukan stamp formal `wdi-review`, ratifikasi DEC, atau hasil HIL. Routing terkait: `review-gate`, invariant `spine`/`sdd-inti`; rekomendasi kapten Sol + pemilik. Kuorum fondasi menurut playbook adalah satu reviewer DeepSeek/GLM/Qwen ditambah Composer, disaring terhadap keluarga penulis aktual; laporan ini tidak membuktikan kuorum sudah terpenuhi.

## Temuan yang menahan clearance

| ID | Prioritas | Bukti | Kekurangan dan syarat penutupan |
| --- | --- | --- | --- |
| R2-SOL-01 | High | `SPEC.md:140–144`; tiket 02 §3; tiket 03 §3 | Fallback atas `unavailable` belum memiliki aturan admission. Tolak laporan saat projection sudah deck, session tidak cocok, atau attempt/consumer proyektor sudah diganti. `guestSessionId` saja tidak membedakan reload/relocate dalam sesi capture yang sama. Uji failure attempt lama setelah attempt baru attached, termasuk revert lalu live lagi dengan capture tetap hangat. |
| R2-SOL-02 | High | Tiket 03 §1–3 | Tidak ada definisi `attached`, deadline readiness sink, atau penanganan `video.play()` reject/tidak ada frame. Preview siap tidak membuktikan playback proyektor siap. Tetapkan attached setelah playback/frame siap, timeout attach, fallback yang mempertahankan blank, dan reason mapping dalam taxonomy tertutup. |
| R2-SOL-03 | High | Tiket 01 §2–4; tiket 03 §3–4 | Lifecycle belum mengikat permission selesai setelah disarm/unmount, arm ganda, acquire session lama, attach gagal setelah clone dibuat, dan cleanup berulang. Tetapkan satu arm aktif, generation invalidation, stop stream hasil terlambat, validasi session, release idempotent, serta cleanup broker saat owner meninggalkan presenter. |
| R2-SOL-04 | Medium | `SPEC.md:91,158`; tiket 01/02 bagian test | HIL mewajibkan warning saat HDMI dicabut/sleep, padahal UVC dapat terus mengirim black/frozen/splash. Warning wajib hanya ketika callback frame benar-benar berhenti. Watchdog juga belum menjadi acceptance/test eksplisit pada tiket. |

R2-SOL-01 adalah risiko kontrak, bukan klaim bug yang sudah terimplementasi. Contoh: consumer A gagal; relocate membuat B dengan guestSessionId yang sama; operator menerima attached dari B lalu unavailable tertunda dari A. Tanpa identitas attempt aktif, operator tidak dapat menentukan relevansi kegagalan. Identitas diagnostic sink/attempt boleh ditambahkan tanpa menjadikan sink controller; jangan menambahkan sequence/request pairing ke heartbeat `projector-alive`.

## 1. Resolusi tiga cacat struktural utama

**Failure taxonomy realistis sebagai kebijakan observasi, bukan diagnosis hardware lengkap.** Error definitif/ended → fallback; compositor tidak maju → warning; isi HDMI buruk → keputusan manual. Driver macet tanpa error juga bisa hanya teramati sebagai stall. Gambar beku berulang masih dapat menghasilkan callback. `loadeddata`/`canplay` membuktikan media tersedia, bukan kebenaran konten HDMI. Watchdog memerlukan timer pemeriksa terpisah: timeout yang hanya diperiksa pada callback berikutnya tidak mendeteksi stall permanen. Callback mengikuti rendering; background/visibility juga perlu diuji. [WHATWG, video frame callbacks](https://html.spec.whatwg.org/multipage/media.html#video-frame-callbacks).

**Projection pada sync/currentState menutup informasi hilang, belum 100%.** Payload penuh tetap membawa index, blank, transition, background, scripture, patches, planIdentity, dan projection. Contoh sync pendek pada SPEC harus dipahami sebagai potongan. Kode memiliki pengirim sync pada navigasi (`PresenterOperator.tsx:803`), request-sync (`:1007`), hidrasi patch (`:1235`), dan regenerate (`:1500`); semua membutuhkan kebijakan projection. AD-10 sudah mewajibkan slide pre-cue mempertahankan guest: uji juga remote navigation, perubahan plan/service, serta reload/relocate. Snapshot tidak menggantikan attach lifecycle R2-SOL-01/02.

**AD-29 membatasi authority dengan tepat, tetapi admission telemetry belum lengkap.** Sink melaporkan kondisi dirinya; operator memutuskan fallback global. Itu single controller jika laporan berlaku hanya untuk sink/attempt aktif. Missing/cross-origin opener masih dapat mengirim telemetry bila channel memungkinkan; jangan menjamin pesan sampai ketika origin/context group terpisah. Heartbeat live tidak berarti video attached, dan media status tidak boleh mengubah evaluator heartbeat menjadi evaluator kesehatan video. Spesifikasi perlu menutup silent attach failure dan stale report sebelum disebut bebas desync.

## 2. Mitigasi celah detail

- **Escape:** capture-phase memperbaiki event yang sampai ke window ketika select fokus. Belum membuktikan kasus native dropdown terbuka, browser UI mengambil event, window lain fokus, atau fullscreen keluar. Uji Windows Chrome/Edge dan host desktop dengan keyboard nyata; dispatch event buatan tidak cukup. Panic dijalankan sebelum filter input/grid/modal, hanya saat guest live, tanpa aksi ganda. Tombol panic tetap diperlukan. `G` diabaikan saat mengetik/modifier; “arms/switches when in ready” perlu diperjelas karena ready sudah armed.
- **Opener:** window.open menghilangkan penyebab noreferrer, dengan syarat tanpa noopener/noreferrer, langsung dalam user gesture, memakai nama popup/handle yang sama, dan menangani null. COOP yang memisahkan browsing context group tetap dapat memutus referensi; uji deployment aktual. [MDN, Window.open](https://developer.mozilla.org/en-US/docs/Web/API/Window/open).
- **Scripture exclusivity:** logis. Berlakukan pada satu jalur state untuk UI, remote, pagination/mode, dan lookup async. Kirim snapshot konsisten deck + overlay agar tidak ada frame overlay tersembunyi di bawah guest. Hasil lookup terlambat tidak boleh merebut layar setelah intent operator yang lebih baru. Blank dipertahankan.
- **Clone cleanup:** acquire/release memperbaiki ownership, tetapi unmount/pagehide saja belum kedap bocor. Cleanup mencabut srcObject, listener, timer/callback, dan registry entry; release aman diulang/setelah disarm. Tambahkan owner cleanup ketika child crash tanpa pagehide serta aturan pageshow bila bfcache didukung. Stop satu clone tidak otomatis menghentikan source yang masih dipakai track lain; stop() tidak memicu ended. Karena itu disarm harus mengirim deck secara eksplisit. [W3C, track lifecycle dan stop](https://www.w3.org/TR/mediacapture-streams/#dom-mediastreamtrack-stop).

## 3. SOP audio dan latensi

**Jalur audio cukup jelas; acceptance operasional belum lengkap.** Analog, pemilihan output guest, audio:false, muted, dan larangan “Listen to this device” sudah tepat. Tambahkan headphone adapter untuk laptop tanpa jack, pengecekan stereo/DI/gain oleh sound technician, dan preflight klip audio-video. Panic WorshipDeck hanya mengubah video: audio analog tetap dapat berbunyi, sehingga teknisi mixer perlu kontrol mute tersendiri.

**150–300ms merupakan estimasi yang belum dibuktikan.** Tidak ada hasil pengukuran HIL yang diperiksa. Ukur end-to-end termasuk leg output operator→projector jika memakai TX1/RX1; diagram hanya menggambar leg input TX2/RX2. “Audio leads slightly” perlu tindakan: uji lip-sync, set delay mixer oleh teknisi bila tersedia, atau tetapkan batas pemakaian klip jika venue tidak dapat menyelaraskannya. Tidak perlu menambah browser audio capture.

## 4. Pengujian, CI, dan batas platform

Registrasi package.json benar ada. Ketiga test fitur belum ada pada baseline, sesuai tiket open; registrasi bukan coverage. Jangan membuat test placeholder hijau untuk menyembunyikan kondisi ini.

| Pemeriksaan yang dijalankan | Hasil |
| --- | --- |
| `uv run --script .constitution/method/scripts/validate.py --check --baseline` | Exit 0, GREEN. Review-trace spine/SDD Presenter masih stale sebagai advisory. Check digunakan agar generated files tidak ditulis ulang. |
| `npm run smoke:spec-101` | Exit 1: ketiga berkas test pada command tidak ditemukan. |
| `npm test` | Selesai exit 1. Kegagalan yang terlihat termasuk dependensi lokal better-sqlite3, typescript, jszip tidak tersedia. Ini batas environment, bukan bukti regresi SPEC-101 atau hasil CI remote. |
| present-channel + projector-liveness + presenter-congregation-display-control + public-repo-guard | 27 pass, 1 fail karena projector-liveness tidak dapat mengimpor typescript. Present-channel 16 pass; display-control 6 pass; public guard 5 pass. |

Tambahan acceptance berikut perlu dimiliki tiket yang jelas:

| Owner | Skenario |
| --- | --- |
| 01 | Arm ganda/pending permission; disarm/unmount sebelum getUserMedia resolve; timeout menghentikan stream; busy/denied/not found/overconstrained; label setelah permission/devicechange; acquire session salah; release dua kali; master stop tanpa ended; stream tanpa audio track. |
| 02 | Semua sync mempertahankan projection/blank/index/patches; telemetry lama ditolak; remote scripture dan lookup terlambat; disarm dari live; watchdog >3s dan recovery dengan fake clock; FPS getSettings dibedakan dari FPS terukur; G di input; service/plan reset. |
| 03 | Sink timeout/play reject/video error; attach gagal melepas clone; reload/relocate berulang; popup blocked/named reuse/closed atau cross-origin opener/policy isolation; cleanup deck/pagehide/unmount/crash; blank menutup video dan fallback deck. |
| HIL | HDMI loss dengan frame tetap berjalan versus USB unplug; native select terbuka + Escape; Chrome/Edge dan WebView2 sesuai cakupan; relocate saat blank; rasio 4:3/16:10/16:9; sleep/wake; audio/lip-sync; soak disertai banyak reload/relocate/revert dan registry kembali ke baseline. |

Host desktop tidak boleh diasumsikan sama dengan browser. `internal/desktop/window_windows.go` menggunakan WebView2; source review belum membuktikan capture permission, popup relation, atau konsumsi MediaStream lintas jendela. Tetapkan browser-only bila desktop belum didukung, atau masukkan desktop ke HIL. Microsoft mendokumentasikan pengelolaan popup melalui NewWindowRequested. [Microsoft, NewWindowRequested](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.newwindowrequested).

## 5. Final clearance dan instruksi terakhir

**Belum LENGKAP/KONSISTEN untuk Clear to Implement.** Tiga masalah Round 1 sudah memiliki arah solusi, tetapi identitas/readiness sink dan cancellation capture belum deterministik. Kontradiksi warning HIL perlu diperbaiki tanpa menambah pixel inspection di luar scope.

1. Tutup R2-SOL-01/02 pada kontrak projection/telemetry dan tiket 02/03, dengan test race/deadline.
2. Tutup R2-SOL-03 pada tiket 01/03; buktikan registry kembali ke baseline setelah failure/pergantian consumer.
3. Selaraskan HIL, cakupan platform, dan SOP audio; ukur latensi perangkat sebelum klaim release.
4. DEC-088 sudah applied: perubahan keputusan substantif melalui replacement/supersession, bukan mengedit applied DEC. “7-day expiry” hanya disebut pada Cost if wrong, belum eksplisit dalam Decision. Review ini tidak memberi izin autopilot/merge/deploy.
5. Ketika implementasi diizinkan, gunakan task branch/worktree. Lengkapi test sungguhan, buktikan absence guard dengan defect injection, dan jalankan seluruh CI lokal pada HEAD yang akan dikirim. Validator GREEN tidak menggantikannya.

Setelah kontrak tersebut ditutup, re-review delta dapat memberi clearance tanpa desain ulang besar. Implementasi dan HIL tetap menjadi bukti G5 Release.

**Dikerjakan:** Re-review Round 2 selesai dengan bukti dan syarat clearance.
**Kendala/ketidakpastian:** Kontrak belum lengkap, test fitur belum tersedia, dependensi lokal belum lengkap, dan HIL belum dijalankan.
**Berikutnya:** Tim menutup R2-SOL-01–04, lalu meminta re-review delta sebelum implementasi.

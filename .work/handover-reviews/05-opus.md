# Review Handover (Round 2): Claude Opus (Claude CLI / TUI)

**Tanggal:** 2026-10-04
**Target Fitur:** SPEC-101 (Guest Speaker HDMI Video Capture Input) — Round 2 Re-Review
**Status Review:** Selesai
**Basis bukti:** `SPEC.md`, tiket 01–03, `DEC-088`, AD-10/AD-29 di `ARCHITECTURE-SPINE.md`, `SDD-presenter.md`, serta kode aktual di `main` (`src/lib/present-channel.ts`, `src/operator/present/PresenterOperator.tsx`, `src/projected/ProjectorClient.tsx`, `src/lib/presenter-remote-client.ts`, `package.json`). Klaim tentang perilaku browser yang belum diuji di perangkat ditandai **[BELUM TERVERIFIKASI]**.

---

## Verdict Akhir

**Needs Minor Polish** — arsitektur sudah benar dan ketiga cacat struktural Round 1 sudah tertutup secara prinsip. Yang tersisa adalah celah kontrak yang memaksa implementer menebak. Semuanya bisa ditambal di teks tiket tanpa mengubah arsitektur atau DEC. Lima butir P1 di bawah wajib masuk tiket sebelum kode ditulis.

## Skor Kesiapan Akhir: **7.5 / 10**

(Round 1: 4–6.5. Naik karena taxonomy, kontrak `projection`, telemetri AD-29, audio SOP, dan HIL kini eksplisit. Tertahan karena semantik field absen, guard sesi basi, slot konsumen, fokus keyboard, dan registrasi CI yang ternyata vakum.)

---

## Temuan P1 — wajib ditambal di tiket sebelum implementasi

### P1-1. Semantik `projection` absen tidak didefinisikan, dan ada 4 emitter `sync`, bukan 1
Spec dan tiket 02 hanya menyebut `currentState()`. Di kode, objek `type: 'sync'` dibangun di **empat** tempat dalam `PresenterOperator.tsx`: baris 802 (`setIndexAndSync`), 1008 (`currentState`), 1236 (hidrasi emergency patch), dan 1501 (revert emergency patch). Spine AD-10 sendiri menjanjikan bahwa *"advancing slide index while in guest projection retains the guest projection on the wire"*. Itu baris 802, yang tidak disebut di tiket mana pun.

`present-channel.ts` punya konvensi eksplisit per field: `blankStateOf` membaca field absen sebagai `false`, sedangkan `liveTransitionOf` membacanya sebagai "biarkan". `projection` belum punya aturan seperti itu. Akibatnya implementer harus memilih sendiri:
- kalau absen dibaca `deck`, menekan → saat guest live diam-diam mengusir pembicara dari layar;
- kalau absen dibaca "biarkan", projector yang tertinggal tidak pernah kembali ke deck.

**Instruksi:**
- Tambahkan `projectionOf(msg): ProjectedSource | null` di `present-channel.ts`. `sync` yang tanpa field atau dengan field cacat dibaca sebagai `{ kind: 'deck' }` (fail-closed, AD-1). Pesan selain `sync` mengembalikan `null`.
- Keempat emitter membaca dari satu `projectionRef`.
- Tambahkan absence-guard: setiap literal `type: 'sync'` di `PresenterOperator.tsx` harus membawa `projection`. Guard ini harus dibuktikan merah dengan menghapus field di satu emitter, lalu dipulihkan.

### P1-2. Tidak ada guard sesi basi dan tidak ada konfirmasi `attached`
- Operator harus **mengabaikan** `projector-media-status` yang `guestSessionId`-nya bukan sesi live saat ini. Tanpa ini, `unavailable` yang terlambat dari window lama (saat relocate SPEC-99) atau dari sesi sebelumnya akan menendang sesi baru ke deck.
- `acquireProjectorConsumer(id)` harus **menolak** id yang tidak dikenal atau basi, serta state selain `ready`/`live`. Penolakan itu dilaporkan sebagai `consumer-attach-failed`.
- **Loop telemetri belum tertutup.** Projector dari build lama, atau projector yang gagal sebelum sempat mengirim apa pun, tidak akan mengirim `unavailable`. Operator lalu menampilkan "live" padahal jemaat melihat deck, dan ini desync senyap gaya Round 1 lewat pintu lain. **Instruksi:** setelah switch, operator menampilkan "Live — menunggu konfirmasi". Jika `attached` tidak datang dalam ±3 detik, operator revert ke deck dan memberi peringatan.
- Payload `projector-media-status` divalidasi oleh predicate sendiri. Taxonomy `reason` bersifat tertutup, sehingga reason yang tidak dikenal dibuang. `isProjectorMessage` (yang didokumentasikan sebagai "only two variants") harus diputuskan secara eksplisit tetap dua varian, sesuai spine yang menyatakan liveness terpisah dari media status. Keputusan itu dikunci dengan test.

### P1-3. Registry `Set<MediaStream>` sebaiknya diganti satu slot `projector`
AD-29 dan komentar di baris 306 sudah menetapkan hanya ada satu projector. `Set` masih bocor di kasus yang tidak memicu `pagehide`: renderer popup crash, window ditutup OS, StrictMode double-mount, atau acquire ulang setelah reload. Track hasil `clone()` hidup di realm opener, jadi track itu tetap menahan sumber sampai `disarm()`.

**Instruksi:**
- Pakai satu slot. `acquire` baru menghentikan konsumen lama terlebih dahulu.
- Verdict liveness `lost` atau `handle-closed` juga melepas slot tersebut.
- `release()` bersifat idempoten, dibungkus `try/catch` karena closure lintas realm bisa mati, dan menyetel `video.srcObject = null` di projector.

### P1-4. Urutan disarm/revert, dan `track.stop()` tidak memicu `ended`
`MediaStreamTrack.stop()` tidak mengirim event `ended` ke track itu sendiri. Kalau operator menekan Disarm saat `live` dan menghentikan clone lebih dulu, projector membeku di frame terakhir atau layar hitam sampai `sync` berikutnya tiba.

**Instruksi:** Disarm saat `live` dijalankan sebagai revert dulu, yaitu broadcast `projection: deck`, baru kemudian stop. Spec harus menyatakan transisi `live → idle` secara eksplisit. Saat ini state machine hanya mendefinisikan `ready → idle`.

Catatan: cabut USB tetap aman karena *source ended* merambat ke semua clone, jadi `onended` di projector akan terpicu.

### P1-5. Hotkey: fokus window, `G` vs input teks, dan Escape
- **Fokus.** `openProjector` memanggil `opened?.focus()` (baris ~748). Setelah open atau relocate, fokus keyboard pindah ke **window projector**, yang hanya mendengarkan `F11`. Escape, G, dan B yang ditekan operator lalu tidak berbuat apa-apa, dan listener capture-phase di operator tidak menolong karena event-nya tidak pernah sampai. Projector tidak boleh meneruskan perintah (AD-29). **Instruksi:** operator memantau `document.hasFocus()` dan menampilkan indikator "Hotkey nonaktif — klik konsol" saat guest `ready`/`live`. Tombol Revert tetap menjadi jalur utama. Kasus ini masuk HIL.
- **`G`.** Spec menyebut G "arms/switches when in ready". Kalau G ikut dipasang di capture-phase atau melewati guard `INPUT/TEXTAREA/SELECT` yang sudah ada (baris ~1124), mengetik "Genesis" di kolom ayat akan menaruh desktop pembicara di layar jemaat. **Instruksi:** G tunduk pada guard input dan `gridOpen` yang sudah ada. G **tidak pernah melakukan arm**, karena arm adalah aksi hardware yang disengaja. Disarankan pula G hanya me-revert, sedangkan switch ke guest cukup lewat tombol.
- **Escape.** Escape boleh capture-phase, tetapi harus no-op kecuali state `live`, tidak memanggil `stopPropagation` (dialog Radix menutup lewat Escape), dan menghormati `e.isComposing`. **[BELUM TERVERIFIKASI]** Saat konsol operator dalam fullscreen via API, Escape dikonsumsi browser untuk keluar fullscreen dan kemungkinan tidak sampai ke halaman. Kasus ini masuk HIL.

---

## Analisis per Pertanyaan

### 1. Resolusi 3 cacat struktural
- **Taxonomy 3-tier: realistis.** Satu koreksi: rumuskan tier berdasarkan **sinyal yang teramati**, bukan penyebab.
  - `ended` → auto-fallback.
  - Tidak ada frame selama >3 detik → peringatan. Penyebabnya bisa upstream atau pipeline, karena sebagian capture card murah berhenti mengirim frame saat sinyal hilang, sementara yang lain terus mengirim splash 60 fps.
  - Frame datang tetapi kontennya salah → hanya bisa dikenali manusia.
  - Tambahkan `track.onmute`/`onunmute` sebagai input tier 2 (Chromium memicunya untuk sebagian device) **[BELUM TERVERIFIKASI per kartu]**.
  - Watchdog `requestVideoFrameCallback` berhenti saat dokumen operator hidden/minimized atau elemen preview tidak dirender. Watchdog harus di-gate dengan `visibilityState === 'visible'` dan menampilkan "tidak diketahui", bukan "stalled", agar tidak menimbulkan alarm palsu.
  - Timeout readiness 5 detik harus **menghentikan master track** (melepas lock UVC). Jika tidak, arm berikutnya gagal dengan `NotReadableError`.
- **Desync reload/relocate: tertutup ±90%.** Reload sudah tertangani karena `request-sync` → `currentState()` membawa `projection`, dan `window.opener` bertahan saat reload maupun saat `existing.location.href` dinavigasi. Relocate sudah tertangani karena window baru dibuka oleh operator sehingga opener ada. Sisa 10% adalah P1-1 (emitter lain) dan P1-2 (window lama yang terlambat). Satu kasus lagi: jika `stalePlan` (identitas plan tidak cocok) aktif saat live, `ProjectorClient` me-render ulang seluruh layar sehingga elemen video ter-unmount. Pelepasan konsumen harus terjadi di sana juga, dan ini perlu test.
- **AD-29: aman dan batasnya tepat**, dengan syarat P1-2 dipenuhi. Pesan hanya membawa kondisi pengirim, dan operator yang memutuskan revert. Jadi projector tidak "mengendalikan"; operator yang menerapkan kebijakan atas laporan itu. Risiko split-brain yang tersisa ada di luar SPEC-101: tab Presenter kedua di channel yang sama akan menjawab `request-sync` dengan `projection: deck`. Hal ini cukup dicatat sebagai batas yang diketahui.

### 2. Mitigasi celah detail
- **Escape capture-phase:** menyelesaikan kasus `<select>`, tetapi **tidak** kasus fokus berada di window projector (P1-5). Bagian itu adalah celah praktis terbesar yang tersisa.
- **`window.open` programatik:** benar. Pastikan `windowFeatures` tidak pernah memuat `noopener` (saat ini `DEFAULT_WINDOW_FEATURES` aman), handler dipanggil di dalam klik pengguna, dan memakai `projectorWindowName(serviceId)` yang sama agar tidak muncul window kedua. Tautan di baris 1898–1902 adalah satu-satunya `noreferrer`.
- **Eksklusivitas scripture: logis dan aman.** Ada tiga hal yang perlu dikunci:
  - `broadcast()` baris 785 sudah mengosongkan overlay lokal pada setiap `sync`. Ini cocok untuk "masuk guest menghapus scripture". Namun aturan "scripture mengembalikan ke deck" harus berada di `setScriptureAndSync`, bukan di tombol UI, karena **remote HP** (`presenter-remote-client.ts`) memanggil handler yang sama.
  - Remote HP kini bisa menendang pembicara tamu tanpa tahu guest sedang live, dan "next" dari HP menggeser deck di latar. Minimal hal ini didokumentasikan; idealnya remote menampilkan status "Guest live".
  - Switch ke guest saat blank tetap blank, dan revert saat blank tetap blank. Kedua hal ini harus ditulis eksplisit.
- **Kebocoran clone:** `release()` saat unmount/`pagehide` belum cukup kedap. Lihat P1-3 dan P1-4.

### 3. SOP audio & latensi
Arah sudah tepat (analog 3.5mm/DI → mixer, `audio: false`, larangan "Listen to this device"). Agar benar-benar bisa dipakai teknisi sound gereja, tambahkan:
- DI box dengan **ground lift**, karena laptop yang di-charge dan dihubungkan ke mixer sering menimbulkan dengung.
- Volume laptop tetap di ±75–100%, dan **suara sistem/notifikasi dimatikan**.
- **Do Not Disturb / Focus Assist** di laptop pembicara. Notifikasi visual seperti WhatsApp atau Telegram bisa muncul di layar jemaat, dan itu masalah privasi, bukan hanya audio.
- Mode tampilan: `Win+P` Extend dengan PowerPoint Presenter View diarahkan ke HDMI, atau Duplicate untuk pengguna awam.
- Output 1920×1080. Laptop 16:10 atau 4K akan di-letterbox atau ditolak oleh capture card.
- **HDCP:** klip dari layanan streaming atau dari browser dengan DRM bisa tampil hitam lewat capture card atau UGREEN.
- Angka 150–300 ms masih **estimasi**. Ukur saat HIL dengan video flash+beep. Mixer digital bisa diberi delay input ±latensi terukur.

### 4. Kesiapan pengujian & CI
- **Registrasi CI vakum (sudah diverifikasi).** Ketiga file test terdaftar di `npm test`, tetapi belum ada. Node 24 **melewatinya secara diam-diam** ketika dicampur dengan file lain yang ada: `node --test tests/present-channel.test.mjs tests/capture-broker-device-enumeration.test.mjs` keluar dengan exit 0. Hanya `smoke:spec-101` yang merah (exit 1, "Could not find"). Artinya file test yang salah nama atau lupa dibuat tidak akan pernah membuat `npm test` merah. **Instruksi:** tambahkan guard bahwa setiap path di script `test` benar-benar ada (dibuktikan merah lalu dipulihkan), dan jadikan `smoke:spec-101` gate G5.
- **Testability.** Runner adalah `node --test` tanpa DOM. Ekstrak modul murni agar test tidak menjadi grep atas source: reducer state machine guest, `projectionOf`, broker dengan `mediaDevices` yang di-inject, dan `shouldPanic(event)`. Escape saat `<select>` fokus diuji lewat fungsi murni, ditambah asersi bahwa listener didaftarkan dengan `{ capture: true }`.
- **Skenario regresi yang belum ada di tiket:**
  - telemetri dengan `guestSessionId` basi diabaikan;
  - timeout `attached` → revert;
  - projector dari build lama mengabaikan `projection`;
  - disarm saat `live` (urutan broadcast lalu stop);
  - arm ulang dengan id baru saat projector masih memegang clone lama;
  - relocate saat live (paling banyak satu konsumen);
  - reload operator saat live (projector jatuh ke deck, `sync` baru membawa deck);
  - `→`/remote "next" saat guest live tetap guest;
  - emergency patch (baris 1236/1501) tetap guest;
  - scripture dari remote saat guest live;
  - `stalePlan` saat live melepas konsumen;
  - pemetaan error `NotReadableError` (kartu dipakai OBS/Teams/Camera), `OverconstrainedError` (deviceId basi), `NotAllowedError`, `NotFoundError` ke kode bertipe;
  - event `devicechange` me-refresh dropdown;
  - timeout readiness melepas hardware;
  - watchdog dalam keadaan hidden tidak memberi alarm palsu.
- **Batas platform untuk HIL:**
  - matriks Chrome, Edge, dan **WebView2 desktop** (`internal/desktop/window_windows.go`, go-webview2 tanpa handler `NewWindowRequested`). Perilaku popup+opener dan prompt izin kamera di WebView2 **[BELUM TERVERIFIKASI]**; kalau opener null di sana, fitur ini tidak jalan di installer;
  - **MediaStream lintas window** (stream dari realm opener dipasang ke `srcObject` di popup). Ini asumsi penopang seluruh arsitektur dan unit test berbasis mock tidak bisa membuktikannya. **Instruksi:** jadikan HIL langkah 0 berupa spike 30 menit sebelum tiket 03;
  - Windows **USB selective suspend** di power plan laptop operator;
  - laptop pembicara sleep/wake dengan waktu relink UGREEN, serta perubahan mode upstream (60→30 fps);
  - mode satu monitor;
  - soak test yang membutuhkan ambang terukur (misalnya pertumbuhan memori <10% dalam 120 menit, dipantau lewat Task Manager atau `chrome://media-internals`). "Zero memory leaks" tidak bisa diukur.

### 5. Final clearance
- **Lengkap:** hampir. Kekurangannya adalah P1-1 sampai P1-5 dan state `live → idle`.
- **Konsisten:** ya antara SPEC, spine, SDD, dan DEC. Dua catatan kecil:
  1. `.how/presenter/02-contracts/02-present-channel.md` dan `LC-14-session.md` belum menyebut `projection` maupun `projector-media-status`. Ini wajar karena dokumen mengikuti kode, tetapi keduanya harus masuk daftar tindak lanjut G5.
  2. Bagian "Cost if wrong" di DEC-088 menyebut kedaluwarsa 7 hari, tetapi frontmatter tidak punya field tanggal kedaluwarsa. Padahal `wdi-autopilot` memeriksa mandat "that has not expired". Pastikan tanggalnya terbaca mesin, sesuai format yang diminta `decision-guide.md`.
- **Siap:** **Clear to implement setelah P1 ditambal di teks tiket.** Tidak perlu Round 3 penuh; cukup diff tiket diperiksa oleh satu reviewer.

---

## Catatan / Instruksi Terakhir bagi Tim Pelaksana

1. Kerjakan **spike HIL-0 dulu**: MediaStream dari opener → `srcObject` di popup, di Chrome, Edge, dan WebView2 desktop. Jika gagal di WebView2, putuskan sebelum menulis tiket 03 apakah fitur ini *browser-only* atau perlu jalur desktop.
2. Tambal tiket 02 dan 03 dengan P1-1 sampai P1-5, termasuk transisi `live → idle` dan slot konsumen tunggal.
3. Tambahkan guard "file test terdaftar harus ada" dan buktikan merah. Selama guard itu belum ada, `npm test` hijau tidak membuktikan apa pun untuk SPEC-101.
4. Logika domain berada di modul murni yang bisa diuji dengan `node --test`. Komponen React hanya merangkai.
5. Lengkapi SOP Bagian 4 dengan ground lift, Do Not Disturb, `Win+P`, 1080p, dan HDCP. Ganti angka latensi dengan hasil pengukuran HIL.
6. Setelah kode merge, sinkronkan `02-present-channel.md` dan `LC-14-session.md` (dokumen mengikuti kode).

# Review Handover: Claude Opus (Claude CLI / TUI)

**Tanggal:** 2026-10-04
**Target Fitur:** SPEC-101 (Guest Speaker HDMI Video Capture Input)
**Status Review:** Selesai — Opus (claude-opus-5.5 via kiro-cli)
**Bahan yang dibaca:** `SPEC.md`, tiket 01–03, `src/lib/present-channel.ts`, `src/projected/ProjectorClient.tsx`, `src/operator/present/PresenterOperator.tsx` (window.open, keydown handler, broadcast), `cmd/api` (bind host / desktop port).
**Tidak diverifikasi:** perilaku hardware nyata (UGREEN 50633A, chipset capture card), perilaku internal Chromium yang ditandai `[ASSUMED]` di bawah.

---

## Ringkasan Eksekutif & Verdict

**Verdict: Accept with Changes. Skor kesiapan: 5/10.**

Arah arsitekturnya benar: satu pemilik hardware di jendela operator, `audio: false`, deck tetap ter-mount di bawah video, blank `z-50` di atas segalanya. Fitur native juga lebih layak daripada switcher HDMI murah (alasan di §6).

Tetapi spec saat ini mengandalkan tiga asumsi yang **salah atau tidak terbukti**, dan ketiganya persis jalur kegagalan saat ibadah:

1. **"Signal loss → `track.onended`" keliru.** Saat laptop pembicara sleep, TX2 dimatikan, atau HDMI dicabut di sisi pembicara, capture card **tetap enumerated** dan track tetap `live`. Yang dikirim ke jemaat adalah frame "No Signal" milik capture card, splash standby receiver UGREEN, atau frame terakhir yang beku. `ended` hanya muncul kalau **USB** capture card dicabut atau driver/capture service mati. Fallback di Tiket 03 tidak menangkap kegagalan yang paling sering terjadi.
2. **Protokol channel belum didefinisikan sampai bisa diimplementasikan.** `PresentMessage` adalah *discriminated union*. "Tambah `projectedSource?` ke `PresentMessage`" tidak menyebut varian mana. `sync` (jawaban `request-sync`) tidak membawa `projectedSource`, padahal Tiket 03 butuh "mount ketika `projectedSource === 'guest'`". Kalau proyektor di-reload atau dipindah layar (SPEC-99 `relocateProjector` menutup lalu membuka ulang jendela), proyektor kembali ke deck sementara operator masih mengira `live`. Itu desync diam-diam.
3. **Tidak ada jalur balik projector → operator.** Spec menulis "operator console receives the error", tetapi AD-29 + `isProjectorMessage()` membatasi pesan dari proyektor hanya `request-sync` / `projector-alive`. Kalau consumer track di proyektor gagal sementara master track di operator sehat, proyektor diam-diam kembali ke deck dan operator tetap melihat "LIVE".

Ditambah dua bug ergonomi yang bisa dibuktikan dari kode yang ada: (a) hotkey panic `Escape` **tidak akan jalan** setelah operator memilih device, karena handler keydown `PresenterOperator` melewati event saat fokus ada di `SELECT`, dan dropdown device adalah `SELECT`; (b) `G` sebagai *toggle* melanggar prinsip header `present-channel.ts` sendiri, yaitu "carry the intended value, never a toggle".

---

## Analisis Mendalam per 6 Pertanyaan

### 1. Keamanan & Kelayakan Teknis

**`getUserMedia()` untuk UVC di Windows/Chromium — realistis, tetapi tidak "100%".**
- Kartu UVC murah (chipset MS2109/MS2130 dan sejenisnya) dikenali Chrome/Edge sebagai `videoinput` biasa. Pendekatan ini realistis.
- Constraint `width 1920 / height 1080 / frameRate ideal 60` bisa memilih format yang buruk. Banyak kartu USB 2.0 hanya memberi 1080p30 lewat MJPEG, dan 1080p60 hanya pada format tertentu. `ideal` tidak gagal, tetapi hasil negosiasinya bisa 720p atau 5 fps (YUY2). Badge `getSettings()` sudah benar untuk *melaporkan* ini. Spec harus menyatakan perilakunya: **frameRate aktual < 24 → badge warning, bukan `ready` hijau**.
- **Rasional "Windows UVC exclusive lockout" antar jendela Chrome perlu dikoreksi** `[ASSUMED, verifikasi di hardware]`. Video capture service Chromium umumnya *berbagi* satu perangkat ke beberapa renderer dalam satu browser. Lockout eksklusif terjadi antar **aplikasi** (Chrome vs OBS/Zoom/Camera app). Desain single-broker tetap sah karena hanya ada satu permission prompt dan satu otoritas. Tetapi Problem Statement #1 sebaiknya tidak dijadikan alasan, dan risiko yang nyata harus ditulis: **OBS / Windows Camera / Teams yang sudah membuka capture card → `NotReadableError`**. Pesan UI harus menyebut itu.

**Crash driver / deadlock / leak selama 1,5–2 jam.**
- Di Chromium, capture berjalan di proses *Video Capture service* yang terpisah dari renderer. Crash driver umumnya hanya membuat track `ended`, bukan tab crash. Desain fallback berbasis `ended` berguna untuk kasus **ini** saja.
- `track.stop()` pada sebagian driver bisa menggantung di capture service. Disarm harus *fire-and-forget* dan UI tidak boleh menunggu promise apa pun dari stop.
- Risiko nyata jangka panjang ada di platform, bukan JS: **USB selective suspend** Windows, power plan baterai, dan thermal throttling saat decode MJPEG 1080p60 ditambah render di dua sink (preview + proyektor). Ini masuk checklist operasional, bukan kode.
- Leak di level JS kecil kalau registry consumer benar. Tetapi `Set<MediaStream>` yang hanya dibersihkan saat `disarm()` **akan menumpuk clone** setiap kali proyektor reload/relocate selama live. Consumer harus di-*release* eksplisit (`releaseConsumer(stream)`) dan juga dibersihkan saat `pagehide` di jendela proyektor.

**`audio: false` — kedap untuk browser, tidak kedap untuk ruangan.**
- Browser memang tidak akan menangkap audio. Jalur howling/ledakan audio yang tersisa ada di luar browser:
  - Windows "Listen to this device" pada input audio capture card (mengalir ke speaker / HDMI-out operator → proyektor Pair 1 → speaker proyektor).
  - Software vendor capture card yang melakukan passthrough audio.
  - Audio sistem laptop operator yang keluar ke HDMI Pair 1 (notifikasi Windows di speaker proyektor).
- **Blindspot yang lebih besar: audio pembicara hilang total.** HDMI membawa audio pembicara lewat Pair 2 ke capture card, lalu dibuang oleh `audio: false`. Windows di laptop pembicara biasanya **memindahkan default playback ke HDMI** saat tersambung, sehingga video khotbah yang ada suaranya menjadi bisu di ruangan. Spec harus menetapkan jalur audio fisik (jack 3.5 mm laptop pembicara → mixer, atau output audio dari RX/capture card bila ada) dan mencatat konsekuensinya: video dari pipeline wireless + capture + browser tertinggal ±100–300 ms dari audio jalur langsung (lip-sync). `[ASSUMED besaran latensi; ukur di lokasi]`

**Secure context.**
- Default bind `127.0.0.1` dan mode desktop memakai `localhost`, jadi skenario utama aman.
- Jebakannya ada di deployment server-di-mesin-lain (`LISTEN_HOST=0.0.0.0`, akses `http://192.168.x.x`): `navigator.mediaDevices` bernilai `undefined`. Ini tidak fatal *selama fail-closed*. Cek di Tiket 01 sudah tepat, dan harus juga menjaga `navigator.mediaDevices` yang undefined, bukan hanya `isSecureContext`.
- **Jebakan yang belum disebut: permission dan `deviceId` bersifat per-origin (scheme+host+port).** Mode desktop memakai `FindAvailablePort(…, 3850, 5)`, jadi port bisa bergeser antar boot. Akibatnya permission prompt muncul lagi di Sabat pagi dan `deviceId` tersimpan tidak cocok. Juga `localhost:5173` ≠ `127.0.0.1:3000`. Fallback pemilihan device harus by-label, dan pre-flight (lihat §5) harus memicu prompt *sebelum* ibadah.

### 2. Risiko Regresi

- **Struktur `ProjectorClient` saat ini:** wrapper `incoming` dengan `transitionLayerStyle` (opacity/transform), lalu hint F11 `z-40`, lalu blank `z-50`. Video **harus** menjadi sibling di luar wrapper transisi, sama seperti blank. Kalau ditaruh di dalam wrapper, video ikut cross-fade/push setiap operator pindah slide di belakang layar. Spec belum mengunci letaknya.
- **Deck harus tetap ter-mount di bawah video**, bukan diganti lewat conditional render. Dengan begitu fallback cukup berupa unmount satu layer: cut instan, tanpa remount `SlideView` dan tanpa flash hitam (AD-1). Tiket 03 menyebut "conditional rendering layer" tanpa menegaskan ini.
- **SPEC-100 scripture:** scripture yang dikirim saat guest live tertimbun di bawah `z-30`, sementara operator mengira jemaat membacanya. Perlu aturan eksplisit: push scripture saat `live` → **auto-revert ke deck**, atau tombol disabled dengan alasan. Hal yang sama berlaku untuk navigasi dari **smartphone remote**: kalau remote menekan Next saat live, apakah tetap tersembunyi? Itu harus diputuskan, bukan dibiarkan kebetulan.
- **SPEC-99 dual-monitor / relocate:** `openProjector(overrideTarget)` menutup dan membuka ulang jendela. Selama live, jendela baru wajib re-attach dari `sync`. Saat ini `sync` tidak membawa sumbernya, jadi ini regresi pasti kalau protokol tidak diperbaiki.
- **`stalePlan`:** kalau rencana ibadah diedit saat guest live dan `planIdentity` berubah, proyektor merender "Unable to continue." dan **membunuh video pembicara di depan jemaat**. Pesan sumber baru wajib membawa `planIdentity`, tetapi spec harus memutuskan apakah guest feed bertahan melewati perubahan plan. Saya sarankan bertahan: guest feed tidak bergantung pada deck.
- **Hint F11 `z-40`** akan tampil di atas video `z-30`. Ini dapat diterima karena transien, tetapi sebutkan supaya tidak dianggap bug.
- **Fabric.js:** canvas editor tidak dirender di proyektor (`SlideView`). Risiko rendah.
- **Desync navigasi saat live:** state deck tetap berjalan via `sync`/`goTo` di bawah video. Itu aman dan memang diinginkan (pre-cue). Desync yang nyata berasal dari poin 2 dan 3 di Ringkasan, bukan dari navigasi.

### 3. Ketepatan Arsitektur

- **Single broker + `track.clone()` + opener bridge: pilihan yang tepat untuk Chromium**, dengan tiga kelemahan struktural:
  1. **Realm ownership.** `opener.__worshipDeckCaptureBroker.createConsumerStream()` dieksekusi di realm operator, jadi clone-nya *milik dokumen operator*. Kalau operator **reload** (lebih sering terjadi daripada proyektor reload), track mati bersama dokumennya, dan event `ended` **tidak dijamin** sampai ke listener di realm proyektor `[ASSUMED]`. Hasilnya frame beku di layar jemaat. Proyektor wajib punya watchdog sendiri (lihat poin berikut), dan Presenter wajib mem-broadcast `projectedSource: 'deck'` saat mount, karena broker baru selalu `idle`.
  2. **Watchdog frame progress wajib, terlepas dari `ended`.** Gunakan `video.requestVideoFrameCallback` (atau `currentTime` yang tidak maju) di sisi proyektor **dan** operator: tidak ada frame baru > N ms (mis. 1500 ms) → revert. Event `mute` pada track bisa membantu tetapi tidak boleh diandalkan `[ASSUMED]`.
  3. **Deteksi "No Signal" frame.** Watchdog frame tidak menangkap kartu yang terus mengirim frame biru/hitam/logo. Sampling ringan (mis. 1 Hz, canvas 32×18, varians luma ≈ 0 atau warna dominan konstan) di **operator** sebaiknya hanya mengubah badge ke "No signal?" dan **tidak** auto-revert, karena slide pembicara yang hitam itu sah. Keputusan revert tetap di tangan manusia.
- **Proyektor dibuka tanpa opener:** fail-closed ke deck sudah benar. Tetapi kalimat "warns the operator" tidak bisa diimplementasikan dengan protokol sekarang. Pilih salah satu dan tulis di spec:
  - (a) proyektor memanggil `opener.__broker.reportConsumerFailure(guestSessionId, reason)` lewat bridge (hanya bisa kalau opener ada; kasus *tanpa* opener tidak terlapor);
  - (b) pesan channel baru dari proyektor, misalnya `{ type: 'guest-attach', guestSessionId, ok: boolean }`. Ini **memperluas `isProjectorMessage` / kontrak AD-29**, jadi perlu `DEC-` sesuai AGENTS.md (kontradiksi dengan AD-N wajib dicatat).

  Saya rekomendasikan (b): operator baru menampilkan "LIVE" setelah **ack attach dari proyektor**, bukan setelah ia sendiri mem-broadcast. Ini menutup desync di semua jalur, termasuk tanpa opener.
- **`guestSessionId` belum diberi fungsi.** Fungsikan: proyektor hanya meng-attach consumer jika `broker.sessionId === msg.guestSessionId`, supaya re-arm atau ganti device tidak membuat proyektor menempel ke stream lama.
- **Named-window reuse:** kalau proyektor dibuka dari tab Presenter A lalu Presenter B membuka `window.open(…, sameName)`, `opener` milik proyektor tetap tab A `[ASSUMED — perilaku opener pada reuse browsing context]`. Bridge harus memvalidasi bahwa broker di opener adalah otoritas yang sedang aktif (via `guestSessionId`), dan jangan mengasumsikannya.

### 4. Kelengkapan Test Case & Failure Modes

**Skenario yang belum ter-cover:**

| # | Skenario | Perilaku yang wajib ditetapkan |
|---|---|---|
| 1 | Laptop pembicara sleep / layar mati | Track tetap `live`; watchdog/no-signal → badge warning di operator, jemaat tidak boleh melihat splash vendor lebih dari N detik tanpa keputusan operator |
| 2 | HDMI dicabut di TX2, atau TX2 kehilangan daya | Sama dengan #1 (bukan `ended`) |
| 3 | USB capture card dicabut | `ended` → revert otomatis (sudah ada) |
| 4 | Resolusi 1920×1200 (16:10) → kartu men-*scale* ke 1080p | Gambar **stretched** di level kartu, dan `object-fit: contain` tidak menolong. Tidak bisa diatasi lewat kode; masuk checklist: minta pembicara set 1920×1080, preview operator memperlihatkannya |
| 5 | `getSettings()` berubah di tengah jalan | Badge harus re-read secara periodik / saat `resize` pada `<video>` |
| 6 | Re-arm / ganti device saat `live` | Dropdown & Arm **disabled** saat `live`; transisi tersebut ilegal di state machine |
| 7 | Proyektor reload / relocate (SPEC-99) saat live | Re-attach dari `sync`, ack ke operator |
| 8 | Operator reload saat live | Proyektor watchdog → deck; Presenter mount → broadcast `deck` |
| 9 | Popup proyektor ditutup paksa saat live | AD-29 `handle-closed` → operator state `ready` (bukan `live`), release consumer |
| 10 | `planIdentity` berubah saat live | Keputusan eksplisit (lihat §2) |
| 11 | Blank `B` saat live lalu unblank | Kembali ke guest, bukan ke deck |
| 12 | Scripture / remote Next saat live | Keputusan eksplisit (lihat §2) |
| 13 | HDCP (Netflix, beberapa player DRM) | Kartu mengirim hitam/hijau; badge tidak bisa membedakannya. Masuk checklist |
| 14 | Kartu sudah dipakai OBS/Camera app | `NotReadableError` → pesan spesifik |
| 15 | Permission ditolak sekali (Chrome mengingat "Block") | Instruksi reset site permission |
| 16 | `deviceId` tidak cocok (origin/port berubah) | Fallback by-label |
| 17 | Readiness timeout 5 s pada kartu yang lambat negosiasi | Retry sekali sebelum `error` |
| 18 | `lost` lalu sinyal kembali | **Tidak boleh** auto-live lagi; kembali ke `ready`, operator yang memutuskan |
| 19 | Soak 2 jam | CPU, suhu, frame drop, jumlah consumer di registry tetap 1 |
| 20 | Interferensi 5 GHz Pair 1 vs Pair 2 | Uji di lokasi: Pair 2 aktif tidak boleh menurunkan kualitas Pair 1 (jalur **Plan A**) |

**Kecukupan unit test dan mock:** cukup untuk state machine, payload channel, dan teardown, tetapi **tidak cukup** untuk keandalan hardware. Mock `MediaStreamTrack` hanya membuktikan logika yang dipikirkan penulis mock, dan kasus #1/#2 (penyebab utama) tidak bisa dimock dengan jujur. Wajib ditambah:
- Unit test watchdog frame dengan fake timers + `requestVideoFrameCallback` palsu, **dibuktikan merah dulu** (aturan absence-guard di AGENTS.md: suntik defek "tidak ada frame" → test gagal → revert).
- Test protokol: `sync` membawa `projectedSource`/`guestSessionId`; pesan sumber tanpa `planIdentity` ditolak; ack attach.
- Test hotkey panic saat fokus di `SELECT` dan saat jump grid terbuka.
- **Checklist uji hardware manual (HIL)** dengan perangkat gereja yang sebenarnya, berisi skenario #1–#20 di atas, sebagai syarat G5. Tanpa itu, fitur ini belum terbukti.

### 5. Ergonomi & UI/UX Operator

- Alurnya terlalu panjang untuk momen live: *Pilih Device → Arm → (preview) → Switch*. Dua klik pertama seharusnya terjadi **sebelum ibadah**. Usulan:
  - **Pre-flight sebelum ibadah:** tombol "Test guest input" yang memicu permission, memilih device by-label, dan menampilkan resolusi/fps. Device terakhir diingat per origin.
  - **Auto-arm opsional** saat Presenter dibuka kalau device tersimpan ditemukan, supaya saat khotbah tinggal satu tindakan: **Switch**.
- **Panic/Revert:**
  - Bug nyata: handler keydown saat ini `return` kalau target adalah `INPUT/TEXTAREA/SELECT` atau `gridOpen`. Setelah memilih device, fokus berada di `SELECT`, sehingga **Escape tidak melakukan apa-apa**. Panic key harus didaftarkan **sebelum** guard tersebut (capture phase), dan dropdown sebaiknya melakukan `blur()` setelah memilih.
  - `Escape` juga dipakai untuk menutup dialog/grid dan keluar fullscreen. Satu tekanan Escape sebaiknya menutup grid **dan** me-revert, tanpa harus dua kali.
  - **`G` jangan toggle.** Tekan dua kali karena panik bisa kembali ke guest. Buat idempoten: `G` = guest (hanya dari `ready`), `Escape` = deck. Ini selaras dengan prinsip "intended value" di `present-channel.ts`.
  - Tombol Revert harus selalu terlihat di posisi tetap selama `live` (bukan di menu), dan header menampilkan indikator besar "JEMAAT MELIHAT: LAPTOP PEMBICARA". Status ini berasal dari **ack proyektor**, bukan dari state lokal.
- **Disarm** jangan diletakkan bersebelahan dengan Switch/Revert. Disarm yang salah klik di tengah khotbah memutus feed. Saat `live`, Disarm harus disabled atau meminta konfirmasi.
- Teks UI wajib melalui `catalogue-en.ts` / `catalogue-id.ts`, dan istilahnya ramah relawan ("Laptop Pembicara", bukan "Guest Feed / UVC").

### 6. Native vs Hardware HDMI Switcher 2×1

| | Native SPEC-101 | Switcher 2×1 murah di input TX1 |
|---|---|---|
| Transisi | Cut instan, tanpa re-handshake | Re-sync HDMI ±1–3 s hitam di proyektor, ditambah re-sync link wireless TX1 |
| Dampak ke Plan A | Proyektor tetap extended display WorshipDeck | Banyak switcher murah memutus **HPD/EDID** ke port yang tidak aktif → Windows melihat monitor kedua dicabut → **jendela proyektor WorshipDeck pindah ke layar laptop** dan harus dipindah ulang setelah kembali. Ini merusak SPEC-99 |
| Audio | Hilang, perlu jalur terpisah (lip-sync) | Audio HDMI ikut ke proyektor (biasanya bukan ke sound system juga) |
| HDCP | Gagal (hitam) | Lolos |
| Blank / fallback / pre-cue | Ya | Tidak |
| Biaya pengembangan & risiko software | Ada | Nol |

**Rekomendasi:** bangun native, dengan **fallback fisik yang terdokumentasi** (bukan switcher permanen): kalau feed bermasalah, kabel HDMI dari RX2 dicolokkan langsung ke input TX1 menggantikan laptop WorshipDeck. Kalau gereja memang ingin switcher, syaratkan model dengan **EDID emulation / HPD tetap tinggi**, dan perlakukan sebagai Plan C, bukan pengganti.

**Skor kesiapan: 5/10.** Arah dan invarian sudah benar, tetapi kontrak kegagalan utama (no-signal tanpa `ended`, sync saat reload/relocate, ack proyektor) belum didefinisikan.

---

## Daftar Celah / Blindspot yang Terlewatkan

1. Signal loss HDMI ≠ `track.ended`; capture card/RX mengirim frame "No Signal"/splash vendor atau frame beku.
2. `sync` tidak membawa `projectedSource`/`guestSessionId` → reload/relocate saat live = desync.
3. Tidak ada jalur ack/error projector → operator; "operator receives the error" belum punya mekanisme, dan memperluasnya menyentuh AD-29 (butuh `DEC-`).
4. Clone track milik realm operator; operator reload = frame beku di proyektor tanpa jaminan `ended`.
5. Registry consumer menumpuk pada setiap reload/relocate proyektor; harus ada `releaseConsumer`.
6. Panic `Escape` diblokir guard `SELECT`/`gridOpen` di handler keydown yang sudah ada.
7. `G` toggle melanggar prinsip idempoten channel.
8. Scripture overlay dan navigasi remote saat live tertimbun video tanpa aturan.
9. `stalePlan` mengganti seluruh render, termasuk video pembicara, dengan "Unable to continue."
10. Audio pembicara hilang (Windows auto-switch ke HDMI); lip-sync jalur audio terpisah; jalur howling non-browser ("Listen to this device", HDMI audio Pair 1).
11. Permission & `deviceId` per-origin; port desktop bisa bergeser (`FindAvailablePort`).
12. 16:10 di-*stretch* oleh kartu, bukan di-letterbox oleh CSS.
13. HDCP → layar hitam.
14. Interferensi 5 GHz dua pasang UGREEN terhadap jalur Plan A.
15. Konflik dengan aplikasi lain yang memegang kartu (OBS/Camera/Teams).
16. `lost` → perilaku saat sinyal kembali belum ditetapkan (harus tetap di `ready`, tanpa auto-live).
17. Letak layer video relatif terhadap wrapper transisi belum dikunci.
18. Rasional "exclusive lockout antar jendela Chrome" kemungkinan keliru; risiko nyatanya adalah lockout antar aplikasi.

---

## Rekomendasi Tindakan Nyata bagi Tim

**Blocking — wajib masuk SPEC/tiket sebelum kode ditulis:**

1. **Protokol:** tambah varian `{ type: 'source', projectedSource, guestSessionId?, planIdentity }`, masukkan `projectedSource`/`guestSessionId` ke `sync`, dan tetapkan perlakuannya terhadap `stalePlan`.
2. **Ack attach dari proyektor** (`guest-attach ok|failed`) dan operator menampilkan LIVE hanya setelah ack. Buka `DEC-` lewat `wdi-decision` karena ini memperluas kontrak AD-29/`isProjectorMessage`.
3. **Watchdog frame progress** di proyektor (revert otomatis) dan di operator (badge), terpisah dari `ended`. Test-nya dibuktikan merah dulu.
4. **Detektor "No Signal"** di operator, hanya untuk badge. Keputusan revert tetap manual.
5. **Presenter mount → broadcast `deck`**; proyektor meng-attach hanya jika `guestSessionId` cocok dengan broker opener.
6. **Lifecycle consumer:** `releaseConsumer()`, pembersihan saat `pagehide`, dan invarian "maksimal 1 consumer aktif per proyektor" dengan test.
7. **Hotkey:** panic didaftarkan sebelum guard `SELECT`/grid; `G` idempoten (bukan toggle); dropdown `blur()` setelah memilih; Disarm disabled saat `live`.
8. **Aturan interaksi saat live:** scripture → auto-revert (atau disabled), remote Next/Prev → tetap navigasi di bawah layar (didokumentasikan), blank/unblank → kembali ke guest.
9. **Kunci struktur DOM:** layer video sibling di luar wrapper transisi, deck selalu ter-mount di bawahnya.
10. **Checklist HIL di perangkat gereja** (tabel §4, #1–#20) sebagai syarat G5, termasuk soak 2 jam dan uji interferensi Pair 1/Pair 2.

**Non-blocking, tetapi sebaiknya ikut di gelombang yang sama:**

- Pre-flight "Test guest input" sebelum ibadah, device diingat by-label, auto-arm opsional.
- Pesan error spesifik: `INSECURE_CONTEXT`, `NotAllowedError` (cara reset permission), `NotReadableError` (tutup OBS/Camera), `OverconstrainedError`.
- Badge warning untuk fps < 24 atau resolusi < 720p.
- Dokumentasi operasional (bukan di repo publik kalau memuat data gereja): jalur audio fisik pembicara, set 1920×1080 di laptop pembicara, mode Duplicate vs Extend, matikan USB selective suspend dan pakai power plan AC, fallback fisik RX2 → TX1.
- Koreksi Problem Statement #1 (lockout antar aplikasi, bukan antar jendela Chrome) setelah diverifikasi di hardware.

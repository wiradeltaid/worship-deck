# Review Handover: DeepSeek Pro (CommandCode / OpenCode)

**Tanggal:** 2026-10-04
**Target Fitur:** SPEC-101 (Guest Speaker HDMI Video Capture Input)
**Status Review:** Selesai — Adversarial Review DeepSeek Pro

> Review ini dilakukan terhadap kode aktual di repositori (`src/projected/ProjectorClient.tsx`,
> `src/operator/present/PresenterOperator.tsx`, `src/lib/present-channel.ts`,
> `spa/src/pages/ProjectorPage.tsx`), bukan hanya terhadap dokumen SPEC/tiket.

---

## Ringkasan Eksekutif & Verdict

**Verdict: Accept with Changes.**

Arah arsitektur **benar** — *Single CaptureBroker + Cloned Track Fan-out + Same-Origin Opener Bridge*
adalah pola yang paling masuk akal di browser untuk masalah *UVC exclusive device lockout* Windows.
Pilihan `audio: false` + `muted` di kedua permukaan juga tepat. Namun dokumen SPEC/tiket punya
**satu celah arsitektur struktural** (kontrak *re-attach* lewat `sync` tidak didefinisikan), **satu
blindspot keandalan yang fatal** (deteksi *frozen frame*), dan **beberapa kebocoran lifecycle** yang
belum tertutup. Jika tiga item blocking di bawah tidak diperbaiki sebelum kode ditulis, fitur ini
akan tampak bekerja di demo dan gagal persis di momen ibadah live (laptop pembicara sleep, kabel HDMI
lepas tapi USB tetap terdeteksi).

**Skor kesiapan: 6 / 10.**

### Blocking items (wajib sebelum kode ditulis)

1. **Kontrak `sync` / re-attach tidak membawa `projectedSource`.** `PresentMessage['sync']` saat ini
   (lihat `present-channel.ts:40-49`) tidak punya field `projectedSource` sama sekali, dan handler
   `onMessage` di `ProjectorClient.tsx:143-239` tidak punya cabang untuk variant `projectedSource`.
   Tiket 03 menyatakan *"ketika ProjectorClient mount saat `projectedSource === 'guest'`, request
   cloned stream baru"* — tapi tidak ada mekanisme bagaimana projector tahu state itu saat mount,
   karena jawaban `request-sync` (`currentState()` di `PresenterOperator.tsx:1007-1016`) juga tidak
   menyertakan `projectedSource`. **Reload projector saat live = kembali ke deck secara diam-diam.**
2. **Tidak ada deteksi *frozen frame*.** `track.onended` / `video.onerror` hanya menyala saat device
   dicabut secara keras. Ketika laptop pembicara **sleep** atau **kabel HDMI lepas tapi USB capture
   card tetap terdeteksi**, UVC terus mengirim frame — biasanya frame hitam atau frame terakhir yang
   membeku — **tanpa event `ended`**. Jemaat melihat layar beku tanpa fallback otomatis. Ini
   melanggar AD-1 (*no black screen freeze*).
3. **Jalur fallback "open congregation screen as tab" memutus bridge.** Link fallback popup-blocker
   memakai `rel="noreferrer"` (`PresenterOperator.tsx:1898-1905`), yang membuat `window.opener`
   menjadi `null`. Artinya persis di skenario darurat (popup diblok), fitur guest feed **mustahil**
   bekerja, dan desain *fail-closed* tidak menyediakan jalur pemulihan apa pun bagi operator.

---

## Analisis Mendalam per 6 Pertanyaan

### 1. Keamanan & Kelayakan Teknis (Safety & Feasibility)

**`getUserMedia()` untuk USB capture card — realistis, tapi "100% aman" adalah klaim yang salah.**
Secara fungsional realistis: UVC capture card terekspos sebagai `videoinput` standar, dan Chromium
Windows menanganinya lewat Media Foundation/DirectShow. Yang tidak boleh diklaim 100%:

- **`deviceId { exact }` rapuh terhadap re-enumerasi.** Saat kabel USB di-replug atau hub reset,
  `deviceId` berubah; `getUserMedia({ exact })` lalu melempar `OverconstrainedError`. Broker harus
  menangkap ini dan *fallback ke enumerasi ulang*, bukan hanya menampilkan error.
- **`NotReadableError` (device busy)** adalah kasus nyata yang sudah diantisipasi SPEC, dan pola
  single-broker memang menghilangkannya. Bagus.

**Crash driver / deadlock / memory leak selama 1.5–2 jam — risiko nyata, dan tikiet tidak
mengukur kesehatan stream setelah `ready`.** Titik-titik rawan:

- Beban dekode: banyak capture card murah mengirim **MJPEG** (bukan H.264) di 1080p; Chromium
  mendekode ini di CPU pada laptop operator selama 2 jam. Tanpa pemantauan `getStats()` /
  `requestVideoFrameCallback`, tidak ada sinyal dini soal degradasi.
- `track.getSettings()` hanya dibaca sekali saat arm (Tiket 01). Kesehatan *runtime* (frame rate
  aktual, `framesDecoded` berhenti bertambah) **tidak dipantau** — padahal ini satu-satunya cara
  mendeteksi freeze.
- Teardown non-leaking sudah dirancang baik (`.disarm()` menghentikan master + semua consumer). Satu
  celah: **`window.unload` operator tidak dijamin** memanggil `.disarm()`. Browser melepas stream
  saat navigasi, tapi broker harus juga dipanggil eksplisit, dan projector harus mendeteksi kematian
  opener (lihat blindspot #4).

**Audio loop/howling — `audio: false` TIDAK menjamin bebas howling, dan jangan pernah diklaim begitu.**
`audio: false` + `muted` benar menghilangkan penangkapan audio HDMI di sisi browser. Tapi loop
akustik (howling) adalah masalah **fisik**, bukan perangkat lunak: audio HDMI pembicara keluar lewat
UGREEN RX2 → mixer → speaker jemaat, dan mikrofon pembicara menangkap speaker itu. Ini domain
petugas sound, dan SPEC (baris 18) sudah benar mendefer ke sound tech. Yang salah adalah framing
prompt yang menyiratkan `audio: false` "mengunci" howling — tim harus menulis tegas di dokumen bahwa
garansi perangkat lunak berhenti di batas browser; loop akustik tidak bisa ditanggung kode.

**Secure context — jebakan nyata, tapi hanya untuk laptop *non-host*.** Operator di sini adalah
**host** (capture card dicolok ke laptop yang menjalankan server), jadi `http://localhost` adalah
secure context dan `getUserMedia` jalan. Jebakan fatal muncul jika operator mengakses lewat
`http://192.168.x.x:5173` (LAN IP = **bukan** secure context) — dari laptop kedua atau karena
bookmark. Error `INSECURE_CONTEXT` yang diketik (Tiket 01) sudah benar, tapi **tidak ada jalur
pemulihan yang didokumentasikan** (opsi HTTPS self-signed, atau instruksi eksplisit "buka via
localhost"). Tanpa itu, operator non-teknis terjebak.

### 2. Risiko Regresi terhadap Fitur yang Sudah Ada

**Layer video vs dual-monitor (SPEC-99), scripture overlay (SPEC-100), canvas Fabric.js — risiko
terkendali jika posisi render tree tepat, tapi ada dua interaksi yang tidak dirancang:**

- **Z-order aman:** slide layers (`outgoing`/`incoming`) tidak punya z-index eksplisit, jadi `<video
  z-30>` akan menumpuk di atasnya, di bawah F11 hint (`z-40`) dan blank (`z-50`). Ini cocok dengan
  `ProjectorClient.tsx:363-371` yang sudah ada. Tidak ada konflik dengan canvas Fabric.js (itu di
  dalam `SlideView`/`ArtifactSlide`, yang berada di bawah video).
- **Interaksi scripture overlay ↔ guest feed TIDAK didefinisikan.** `ScriptureOverlayView` dirender
  *di dalam* layer `incoming` (`ProjectorClient.tsx:327-341`). Saat `projectedSource === 'guest'`,
  jika operator (atau remote) menekan push scripture, apakah overlay muncul di atas video? Karena
  video di `z-30` dan overlay di dalam layer tanpa z-index, overlay akan **tersembunyi di bawah
  video** — tapi perilaku itu tidak dinyatakan eksplisit, tidak diuji, dan bisa berubah saat video
  `object-fit: contain` meninggalkan letterbox (di area hitam letterbox, overlay bisa bocor tampak).
  Butuh aturan tegas + test: **saat live, scripture overlay ditekan (dilempar ke state, tidak
  dirender di permukaan) sampai revert.**
- **Navigasi slide saat live — desync? Tidak desync, tapi butuh satu test kunci.** `sync` membawa
  `index` dan projector memperbarui `activeSlides` di bawah video. Saat revert, slide yang tampil
  adalah index **terbaru** (bukan yang tadi). Ini justru perilaku yang diinginkan (pre-cue slide
  berikutnya). Yang belum dijamin: **tidak boleh ada satu frame slide yang bocor lewat video selama
  navigasi live.** `useSlideTransition` memicu cross-fade/push; jika video hanya ditumpuk di atas,
  animasi slide berjalan *di belakang* video dan tidak terlihat — aman — tapi harus ada test regresi
  yang menegaskan ini, karena perubahan kecil pada z-order bisa membocorkannya ke ruangan.

### 3. Ketepatan Rancangan Arsitektur

**Pola Single Broker + Clone + Opener Bridge adalah pilihan paling optimal di browser.** Alternatif
lain (dua `getUserMedia` → `NotReadableError`; WebRTC peer antara dua window → overkill dan tambah
latensi; `BroadcastChannel` membawa `MediaStream` → dilarang AD-10 dan secara teknis tidak
di-serialize). Jadi arahnya tepat. Kekurangan strukturalnya:

- **`track.clone()` tidak memberi akses hardware independen.** Semua clone berbagi satu source UVC;
  ini fine untuk satu preview + satu projector, tapi berarti tidak ada isolasi fault — jika master
  berhenti, semua clone ikut `ended`. Broker harus mendokumentasikan bahwa kematian master
  **merambat** ke semua consumer, dan consumer registry harus menangani propagasi itu (bukan
  membiarkan tiap consumer mengira dirinya error sendiri).
- **`window.opener` adalah kontrak rapuh, dan dua jalur pembuka memutusnya.** Jalur popup
  (`window.open` bernama, `PresenterOperator.tsx:739`) mengeset `opener` dengan benar. Jalur fallback
  tab (`rel="noreferrer"`, baris 1898) dan **tab yang dibuka manual** (operator copy URL) sama-sama
  `opener === null`. Desain fail-closed benar, tapi tidak ada jalur pemulihan — operator yang
  popup-nya diblok tidak punya cara untuk membuat fitur ini hidup.
- **`guestSessionId` under-specified.** Ia dibawa lewat channel (AD-10) tetapi `MediaStream` lewat
  opener — dua jalur berbeda. Jika operator re-arm, `guestSessionId` lama masih bisa berkeliaran di
  channel sementara bridge opener sudah mati. Projector harus **memvalidasi bahwa opener bridge benar-
  benar bisa melayani session tersebut**, atau fail-closed ke deck. Tidak ada aturan ini di tiket.

**Reload projector / dibuka tanpa opener — kontrak fail-closed tepat, tapi tidak lengkap.** Fail-
closed ke deck benar dan sesuai AD-1. Yang hilang: reload projector saat live **tidak bisa re-attach**
karena `sync` tidak membawa `projectedSource` (blocking #1). Dan arah sebaliknya — **operator reload
saat live** — hanya selamat *secara kebetulan* lewat `track.onended` yang merambat dari master yang
mati. Itu harus dites eksplisit, bukan diandalkan sebagai side-effect.

### 4. Kelengkapan Test Case & Failure Modes

**Daftar skenario di Tiket 01–03 bagus sebagai baseline, tapi miss pada failure mode paling penting.
Edge case yang belum ter-cover:**

1. **Laptop pembicara sleep / HDMI lepas tapi USB tetap hidup → frozen frame** (tidak ada `onended`).
   Ini *bukan* edge case langka; ini mode kegagalan #1 di produksi. Butuh deteksi frame-freeze.
2. **Operator window reload / close saat live** — tidak ada `pagehide`/`beforeunload` yang broadcast
   `projectedSource: 'deck'`, dan tidak ada test urutan teardown saat master mati oleh navigasi.
3. **Re-arm saat stream masih live** — state machine tidak mendefinisikan transisi ini. Apakah tombol
   Arm harus disabled saat `live`, atau harus auto-revert dulu? Tidak diuji.
4. **Pergantian resolusi 16:10 → 16:9 mid-stream** — `getSettings()` dibaca sekali; perubahan resolusi
   live tidak me-refresh badge, dan `object-fit: contain` harus tetap letterbox benar. Tidak diuji.
5. **Popup projector ditutup paksa (X) saat live** — consumer track harus berhenti tanpa menghentikan
   master; test teardown Tiket 03 menyebut unmount, tapi bukan close paksa lewat window manager.
6. **Device dicabut saat `ready` (belum `live`)** — `track.onended` harus transisi `ready → lost` dan
   broadcast deck; Tiket 02 hanya menguji `live → lost`.
7. **Permission ditolak saat arm** — disebut di SPEC (state `error`) tapi tidak ada test unit untuk
   path rejection `getUserMedia`.
8. **Dua presenter tab terbuka bersamaan** — AD-10 menyebut kasus ini (liveness), tapi guest feed
   tidak menyebut siapa pemilik `projectedSource` saat dua tab sama-sama bisa broadcast guest.

**Unit & mock cukup? Tidak.** Test yang direncanakan menguji logika state machine dan kontrak API
(`audio: false`, clone, teardown). Yang tidak bisa dijamin oleh unit/mock: **perilaku hardware nyata**
(MJPEG decode, re-enumerasi deviceId, driver crash, frozen frame). Ini butuh **test harness manual
dengan hardware nyata** (capture card + laptop pembicara + kabel yang sengaja dicabut) sebagai
acceptance gate terpisah — bukan sekadar mock `MediaStream` di Node.

### 5. Ketepatan Ergonomi & UI/UX Operator

**Alur `Pilih Device → Arm → Pre-warm → Switch → Revert → Disarm` secara konsep tepat dan aman untuk
sukarelawan.** Pre-warm stage adalah keputusan bagus (menghilangkan kejutan black-screen saat switch).
Yang perlu diperbaiki:

- **Revert/Panic button sudah responsif** (`Escape` + tombol kontras tinggi), tapi **tidak ada satu
  aksi "panic + blank"**. Saat feed pembicara rusak dan operator panik, refleks paling aman adalah
  *blank screen* (`B`) dulu, baru pikirkan. Pastikan `Escape` saat live → deck, dan `B` tetap bekerja
  di atas video (sudah dijamin `z-50`, tapi harus diuji dari state `live`).
- **Hotkey `G` vs `B` vs `Escape`** — `G` toggle guest saat ready, `Escape` revert, `B` blank. Ada
  risiko `G` tertempel saat operator mengetik di field lain; handler keyboard yang ada
  (`PresenterOperator.tsx:1131-1165`) sudah menahan INPUT/TEXTAREA/SELECT, tapi kontrol guest feed
  baru harus **mematuhi guard yang sama**, dan `G` jangan mengganggu field scripture/reference.
- **State tidak jelas bagi sukarelawan saat arming gagal.** Spinner 5 detik tanpa penjelasan apa yang
  terjadi ("mencari sinyal dari laptop tamu?") akan membingungkan. Badge sinyal (1080p/60fps) bagus,
  tapi perlu teks status yang jelas untuk `lost`/`error` yang menyebut **tindakan** (mis. "periksa
  kabel HDMI tamu"), bukan penyebab teknis.
- **Tidak ada indikasi "siapa yang tampil" di layar operator saat live.** Operator harus bisa melihat
  sekilas apakah ruangan sedang melihat deck atau guest. Badge state machine ada di operator console,
  tapi perlu satu indikator kuat (warna/modus) bahwa `projectedSource === 'guest'`.

### 6. Ketepatan Desain & Analisa Keseluruhan

**Rekomendasi: implementasikan fitur native, TAPI posisikan sebagai *staging/convenience*, bukan
pengganti jaminan layar jemaat.** Jawaban jujurnya dua arah:

- Untuk **jaminan layar jemaat** (AD-1), **hardware HDMI switcher fisik 2x1 tetap Plan A** yang lebih
  andal: bebas OS, bebas secure-context, bebas frozen-frame, bebas driver crash. Tidak ada pipeline
  browser yang bisa menandingi keandalan switch fisik untuk surface yang menghadap ruangan.
- **Nilai nyata fitur native** ada di tiga hal yang tidak bisa diberikan switcher: (a) **preview +
  staging operator** sebelum switch, (b) gereja tanpa budget switcher, (c) **integrasi blank + revert
  instan** ke slide deck lewat satu konsol.

Jadi keputusannya bukan *either/or* — tim sebaiknya **menjual fitur ini sebagai "guest feed staging +
soft-switch"** dengan fallback ke deck yang anti-freeze, dan **menyarankan gereja yang sudah punya
switcher fisik untuk tetap memakainya sebagai jalur utama ke proyektor**, sementara fitur native
dipakai untuk preview dan koordinasi. Menamainya "Switch to Guest Screen" secara internal boleh, tapi
dokumentasi rilis harus jujur soal batas keandalannya.

---

## Daftar Celah / Blindspot yang Terlewatkan

1. **Frozen frame (mode kegagalan #1 produksi) tidak terdeteksi.** `onended`/`onerror` tidak menyala
   saat laptop pembicara sleep atau HDMI lepas tapi USB tetap hidup. Butuh monitor `getStats()` /
   `requestVideoFrameCallback` (deteksi "frame berhenti bertambah selama N ms → fallback").
2. **Kontrak `sync` tidak membawa `projectedSource`** → reload projector saat live = diam-diam balik
   ke deck tanpa re-attach (blocking).
3. **`rel="noreferrer"` pada fallback tab** memutus `window.opener`; operator yang popup-nya diblok
   tidak punya jalur pemulihan.
4. **Kematian operator window (reload/close) saat live** hanya selamat secara kebetulan lewat
   propagasi `track.onended`; tidak ada `pagehide`/`beforeunload` broadcast deck, tidak dites.
5. **`guestSessionId` tidak tervalidasi** oleh projector — stale broadcast guest bisa membuat
   projector meminta stream yang bridge-nya sudah mati; tidak ada aturan validasi session.
6. **Perubahan resolusi/rate mid-stream** tidak me-refresh `getSettings()` dan tidak diuji.
7. **Interaksi scripture overlay ↔ guest feed** tidak didefinisikan (letterbox bisa membocorkan
   overlay ke ruangan).
8. **Re-arm saat live** dan **device dicabut saat `ready`** tidak ada transisi state machine + test.
9. **Permission rejection saat arm** tidak ada unit test.
10. **Kesehatan stream jangka panjang** (CPU decode MJPEG, thermal, degradasi 2 jam) tidak dipantau —
    hanya `ready` sekali saat arm.

---

## Rekomendasi Tindakan Nyata bagi Tim

**Sebelum kode ditulis (blocking):**
1. Perluas `PresentMessage['sync']` (dan `currentState()` di `PresenterOperator`) agar membawa
   `projectedSource` + `guestSessionId`, plus handler variant di `ProjectorClient.onMessage` dan
   pembaruan `adoptsSharedState`/predikat lain. Ini menutup re-attach saat reload.
2. Tambah deteksi **frozen frame** di broker (poll `getStats().framesDecoded` / RVC callback) dan
   fallback otomatis ke deck. Ini memenuhi AD-1 secara nyata.
3. Tentukan kontrak fallback tab: ubah `rel="noreferrer"` menjadi `rel="opener"` (atau buka via
   `window.open` tanpa `noopener`) agar bridge tetap hidup, ATAU nyatakan tegas bahwa guest feed
   hanya tersedia di jendela popup dan beri instruksi operator untuk mengizinkan popup.
4. Tambahkan handler `pagehide`/`beforeunload` operator yang broadcast `projectedSource: 'deck'`
   + `.disarm()`, dan test urutan teardown saat operator reload.
5. Definisikan dan uji state machine untuk: re-arm saat live, device cabut saat `ready`, permission
   rejected, dua presenter tab, dan `guestSessionId` stale.
6. Tegaskan aturan precedence guest vs scripture overlay (scripture ditekan saat live → disimpan,
   tidak dirender sampai revert).

**Saat implementasi:**
7. Tambah test regresi "navigasi slide saat live tidak membocorkan frame slide ke ruangan".
8. Tambah test z-order: video `z-30` di bawah F11 hint `z-40` dan blank `z-50`.
9. Tambah acceptance gate **manual dengan hardware nyata** (cabut kabel, sleep laptop, ganti
   resolusi) — mock tidak cukup untuk ini.

**Untuk dokumen rilis:**
10. Tulis jujur batas keandalan: fitur ini *staging + soft-switch*, bukan pengganti switcher fisik
    untuk jaminan layar jemaat. Rekomendasikan gereja dengan switcher fisik tetap menggunakannya
    sebagai jalur utama.

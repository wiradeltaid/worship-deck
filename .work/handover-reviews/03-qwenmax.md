# Review Handover: Qwen Max (OpenCode / DashScope)

**Tanggal:** 2026-10-04
**Target Fitur:** SPEC-101 (Guest Speaker HDMI Video Capture Input)
**Reviewer slot:** Qwen Max — Technical Lead & Principal Architect (independent, adversarial)
**Status Review:** Complete
**Metode:** Review terhadap `SPEC.md` + 3 tiket, diverifikasi silang terhadap kode yang benar-benar ada di
repository (bukan terhadap klaim dokumen). Semua temuan di bawah membawa sitasi `file:line` agar bisa
diaudit ulang.

---

## 0. Ringkasan Eksekutif & Verdict

**Verdict: ACCEPT WITH CHANGES** — dengan satu gerbang keras: **jangan tulis kode sebelum hardware spike
1 hari selesai dan 4 temuan berlabel `[Critical]` ditutup.**

**Skor kesiapan: 6 / 10.**

Yang sudah benar dan layak dipuji: disiplin invarian-nya tinggi. Keputusan menahan `MediaStream` di luar
`BroadcastChannel` (AD-10), satu pemilik lifecycle hardware (single CaptureBroker), `audio: false` di level
API, `object-fit: contain` + `background:#000`, video di `z-30` di bawah blanking `z-50`, dan kontrak
fail-closed ke slide deck — semuanya arah yang benar dan konsisten dengan cara repository ini berpikir.

Yang membuatnya tidak bisa langsung dibangun: **model kegagalannya dibangun di atas satu asumsi yang
kemungkinan besar salah** (`track.onended` sebagai detektor signal loss), dan **fakta terpenting bagi
operator — "apakah layar jemaat benar-benar sedang menampilkan tamu?" — tidak teramati oleh siapa pun.**
Kombinasi keduanya menghasilkan satu mode kegagalan yang paling buruk dalam produksi live: operator melihat
"LIVE" di konsolnya, thumbnail-nya hidup, sementara jemaat melihat slide. Tidak ada error di mana pun,
karena AD-24 melarang error di layar jemaat dan tidak ada satu pun tiket yang memberi operator umpan balik
dari sisi ruang.

Empat temuan `[Critical]`:

| ID | Temuan | Akibat jika dibangun apa adanya |
|---|---|---|
| **B-1** | `track.onended` bukan detektor signal loss | Laptop pembicara sleep / kabel HDMI dicabut / link wireless drop → capture card tetap mengirim frame (hitam, biru, atau OSD "NO SIGNAL"). Track tetap `live`. Fallback "authoritative" tidak pernah jalan. Jemaat menonton layar hitam/berbintik selama sisa khotbah. |
| **B-2** | Status "room attached" tidak teramati operator | Ada jalur yang **sudah ter-ship hari ini** yang membuat `window.opener === null` (`PresenterOperator.tsx:1902`, `rel="noreferrer"`). Bridge gagal tertutup, konsol tetap bilang LIVE. Divergensi senyap. |
| **B-3** | Menabrak AD-29 tanpa `DEC-` | AD-29 (`ARCHITECTURE-SPINE.md:255,259`) mengunci "exactly one acknowledgement variant" dan "admitting a second is a new decision, not an implementation choice". Tiket 03 butuh laporan balik dari proyektor. Itu perubahan spine, bukan keputusan tiket. AGENTS.md menjadikan "contradicting an AD-N" satu-satunya kasus `DEC-` yang **wajib**. `.control/registry/decisions.yaml` belum punya entri SPEC-101. |
| **B-4** | Reload/late-open proyektor kehilangan status guest | `request-sync` dijawab oleh `currentState()` (`PresenterOperator.tsx:1007-1016,1033-1034`) yang tidak membawa `projectedSource`. Proyektor yang di-reload di tengah khotbah kembali ke deck; operator tidak tahu. |

Selain itu ada 10 temuan `[High]`/`[Medium]` (HDCP, scripture overlay vs guest feed, `presentationLock`,
tabrakan hotkey, i18n, registrasi test di CI, absence-guard yang belum di-injection-proof, permukaan
deployment desktop/LAN, traceability FR & sizing, taksonomi error) — semuanya di §7.

**Rekomendasi inti (§6):** bagi risiko ini menjadi dua. Setengah operator (capture + preview + signal
health) bernilai dan rendah risiko. Setengah ruang (lapisan video di `ProjectorClient.tsx`) memikul
hampir seluruh risiko dan **tidak punya offline guarantee apa pun** di bawah AD-1. Beli HDMI switcher 2×1
untuk jalur ruang **sekarang**, jalankan spike 1 hari, lalu putuskan apakah setengah ruang layak dibangun.

---

## 1. Keamanan & Kelayakan Teknis (Safety & Feasibility)

### 1.1 Apakah `getUserMedia()` untuk USB capture card di Windows/Chromium realistis?

**Ya, realistis — tetapi bukan 100%, dan kata "100%" di pertanyaan ini sendiri adalah gejala masalahnya.**
Tidak ada satu pun bagian dari jalur ini yang berada di bawah kendali tim: driver UVC pihak ketiga,
firmware capture card, firmware UGREEN wireless, kebijakan permission Chromium, dan status power laptop
pembicara. Semua itu di luar repository ini dan di luar kendali AD-1.

Rinciannya:

- **Kelas device.** Capture card USB murah (kelas MS2109/MS2130) di Chromium/Windows umumnya memberi
  1080p30, bukan 1080p60. `frameRate: { ideal: 60 }` di Tiket 01 bersifat lunak (`ideal`), jadi tidak akan
  melempar `OverconstrainedError` — tetapi badge `"1080p 60fps - Ready"` yang dijanjikan Tiket 02 bisa jadi
  fiksi. **Wajib:** badge menampilkan fps **terukur** dari `requestVideoFrameCallback` (delta `mediaTime`),
  bukan `track.getSettings().frameRate` yang hanya melaporkan angka nominal format yang dinegosiasikan.
- **Negosiasi format (YUY2 vs MJPG).** Ini jebakan senyap yang nyata: kalau driver menegosiasikan YUY2 pada
  1080p, bandwidth USB membatasi ke ~5 fps dan hasilnya adalah slideshow yang tersendat, **tanpa error apa
  pun**. `getSettings()` tidak melaporkan fourcc. Hanya pengukuran fps terukur yang menangkapnya. Ini alasan
  kedua untuk syarat di atas.
- **Kualitas gambar — celah terbesar yang tidak disebut satu dokumen pun.** Jalur ini adalah
  *dua* hop wireless HDMI + kompresi UVC. Hampir semua wireless HDMI consumer dan capture card UVC bekerja
  pada chroma subsampling 4:2:0. Akibatnya pada konten khotbah — **teks kecil di slide** — adalah tepi huruf
  yang berdarah/berbayang. Slide 24pt yang terbaca dari baris belakang lewat HDMI langsung bisa jadi tidak
  terbaca lewat jalur ini. Spec tidak menyebut kualitas gambar sama sekali, padahal inilah kriteria
  penerimaan yang paling menentukan bagi jemaat. **Wajib masuk acceptance gate:** proyeksikan slide berisi
  teks 20–24pt dari laptop tamu, baca dari baris belakang ruangan.
- **Latency end-to-end.** Guest laptop → TX → 5GHz → RX → capture → USB → decode browser → composite GPU →
  HDMI out → TX1 → 5GHz → RX1 → proyektor. Realistisnya 150–500 ms. Untuk konten **slide**, ini tidak
  berbahaya. Untuk **video klip bersuara** (audio masuk ke mixer langsung dari laptop tamu, video lewat
  jalur capture), offset A/V akan terlihat jelas di atas ~125 ms. Spec harus menyatakan scope-nya:
  *slide/PDF/video tanpa audio lewat jalur ini*; video klip bersuara = di luar scope atau butuh jalur
  hardware. Tidak ada satu pun tiket yang menyebut kata "latency".

### 1.2 Crash driver UVC / deadlock MediaFoundation / memory leak selama 1.5–2 jam

- **Crash driver:** mungkin, tidak bisa dicegah dari browser, dan tidak bisa dideteksi oleh kode JS selain
  lewat frame watchdog (lihat B-1). Yang bisa dilakukan repository ini hanya: (a) tidak pernah membuka device
  dua kali, (b) teardown bersih, (c) deteksi "frame berhenti" lalu failover. Ketiganya harus eksplisit.
- **Deadlock DirectShow/MediaFoundation:** risiko nyata bukan antar dua window Chrome (lihat §1.3), tetapi
  **antar aplikasi**: OBS Studio, Zoom, Teams, atau Camera app yang memegang capture card akan membuat
  `getUserMedia` gagal dengan `NotReadableError`. Ini kegagalan paling sering di lapangan dan **tidak disebut
  di satu dokumen pun**. Wajib masuk runbook + taksonomi error (B-13).
- **Memory leak 2 jam:** secara arsitektur, satu-satunya sumber leak yang diperkenalkan spec adalah
  *consumer registry* di broker. `Set<MediaStream>` yang diisi saat popup meminta clone **tidak akan pernah
  kosong** kalau popup ditutup paksa (di-close lewat tombol X, di-kill, crash) — tidak ada `pagehide`
  cleanup yang bisa diandalkan dari realm yang sudah mati. Registry tumbuh, dan lebih buruk: laporan
  "consumer attached" jadi positif palsu selamanya (ini yang merusak solusi B-2). **Wajib:** (i) popup
  memanggil `releaseConsumer(id)` pada `pagehide`/unmount, **dan** (ii) broker mem-purge registrasi consumer
  ketika poll `.closed` yang **sudah ada** di `PresenterOperator.tsx:1121-1123` membaca `closed === true`.
  Dua mekanisme, satu fakta — persis gaya yang dipakai `projector-liveness.ts` untuk handle + heartbeat.
- **Soak test tidak ada di rencana.** Untuk fitur yang diharapkan menyala 2 jam tanpa henti di atas laptop
  gereja, tidak adanya rencana soak adalah celah. **Wajib:** 30 menit continuous (lebih baik 90), pantau
  `chrome://media-internals`, dropped frames, dan memori proses renderer; catat suhu/throttling. Ini
  acceptance gate, bukan nice-to-have.
- **Kontensi CPU/GPU yang salah sasaran di prompt review.** Perlu dikoreksi: `ProjectorClient.tsx` tidak
  merender Fabric.js. Jalurnya `SlideView` → `ArtifactSlide` = **DOM biasa**; Fabric hanya hidup di canvas
  editor admin (`src/components/admin/ArtifactEditor.tsx`, AD-13). Kontensi yang nyata adalah: video
  1080p decode + composite **bersamaan dengan** dua layer slide DOM full-screen yang tetap ter-mount, dan —
  kalau operator pre-cue slide saat live (Tiket 02 memang memintanya) — **animasi transisi rAF penuh**
  (`use-slide-transition.ts`) berjalan di bawah video yang menutupinya. Buang-buang GPU tepat di saat
  paling mahal. **Keputusan yang harus dibuat spec, dan belum dibuat:** saat `projectedSource === 'guest'`,
  terapkan perubahan index **tanpa** menjalankan animasi transisi (potong langsung), tapi **tetap mount**
  DOM slide supaya revert bersifat instan. Jangan lakukan sebaliknya (unmount slide demi hemat CPU): itu
  menukar CPU dengan risiko flash putih/kosong saat revert, yang persis melanggar semangat AD-1. Revert
  harus *cut*, bukan efek — sama seperti blanking, yang kodenya sudah menyatakan prinsip itu
  (`ProjectorClient.tsx:365-370`).

### 1.3 Apakah `audio: false` sudah kedap untuk mencegah loop/howling?

**Untuk jalur browser: ya, kedap.** `audio: false` berarti tidak ada audio track yang pernah dibuat, jadi
tidak ada yang bisa dirutekan ke speaker laptop operator. `muted` pada kedua `<video>` adalah lapisan kedua.

Tiga catatan yang harus ditambahkan, karena `audio: false` **bukan** jaminan howling secara sistem:

1. **Howling di ruangan bukan urusan browser.** Kalau laptop tamu mengirim audionya ke mixer *dan* mic
   podium menyala, feedback adalah masalah sound technician — dan spec sudah benar menyatakan itu di luar
   scope. Pertahankan kalimat itu, jangan sampai ada yang menganggap fitur ini "mengatasi audio".
2. **`muted` bersifat load-bearing untuk autoplay, bukan hanya untuk howling.** Video tanpa `muted` akan
   terkena autoplay policy → `play()` menolak → layar hitam beku di depan jemaat. Jadi `muted` harus
   dijaga oleh test sebagai *invarian*, dan rejection `video.play()` harus punya jalur fallback ke deck,
   bukan hanya `.catch(() => {})`.
3. **Capture card UVC umumnya juga mengekspos USB audio device (UAC).** `audio: false` membuat browser tidak
   membukanya — benar. Tapi sebutkan di runbook bahwa device audio itu akan muncul di Windows Sound dan
   **tidak boleh** dipilih sebagai input mixer oleh teknisi suara, karena itu jalur howling yang sesungguhnya.

### 1.4 Secure context (`localhost` vs LAN IP) — jebakan fatal?

**Ya, dan lebih spesifik daripada yang ditulis spec.** Fakta di repository ini:

- Default bind adalah **loopback** (`cmd/api/listen.go:8-18`, AD-4) → `http://127.0.0.1:3000` = secure
  context → `getUserMedia` tersedia. Aman.
- Produksi lewat Cloudflare Tunnel (`presenter.example.org`, `.constitution/project/deployment.md:31`) →
  HTTPS → aman.
- **Bahaya:** `LISTEN_HOST=0.0.0.0` (`deployment.md:29`) + operator membuka konsol lewat
  `http://192.168.x.x:3000`. Di sana `window.isSecureContext === false` **dan** `navigator.mediaDevices`
  adalah `undefined` — bukan "ditolak", tapi *tidak ada*. Guard Tiket 01 hanya memeriksa `isSecureContext`;
  itu perlu, belum cukup. Kode yang menyentuh `navigator.mediaDevices.enumerateDevices()` tanpa guard akan
  melempar `TypeError` saat komponen mount, di setiap pembukaan Presenter, di laptop mana pun yang memakai
  jalur LAN.
- **Konsekuensi deployment yang harus ditulis sebagai syarat, bukan footnote:** browser yang meng-arm feed
  **harus** berada di mesin tempat capture card dicolok, **dan** popup proyektor harus window dari browser
  yang sama di mesin yang sama, **dan** mesin itu yang men-drive HDMI out ke UGREEN Pair 1. Ketiga peran
  (capture host, konsol operator, output ruang) runtuh ke **satu laptop**. Itu kebetulan cocok dengan
  skenario gereja yang diberikan — tapi harus dinyatakan sebagai batas arsitektur, karena kalau suatu saat
  layar jemaat dijalankan dari PC media terpisah, seluruh desain bridge ini mati total (bukan degradasi —
  mati), dan tidak ada jalur pengganti.

**Tambahan yang tidak disebut spec sama sekali: desktop mode.** Repository ini meng-ship installer Windows
dengan WebView2 (`internal/desktop/window_windows.go`, `scripts/build-desktop.mjs`, `installer/`). Di sana:
- Tidak ada handler `PermissionRequested` maupun `NewWindowRequested` pada go-webview2 → perilaku permission
  kamera dan topologi popup **belum terverifikasi**. Kalau popup proyektor WebView2 tidak punya opener yang
  usable, fitur ini tidak berfungsi sama sekali di desktop mode, dan gagal-tertutup berarti diam.
- `FindAvailablePort` (`internal/desktop/port.go`) memindai port berikutnya kalau port utama terpakai →
  **origin bisa berubah antar-launch**. Permission kamera dan `deviceId` keduanya terikat origin. Artinya:
  prompt permission bisa muncul di tengah ibadah, dan device yang tersimpan tidak dikenali lagi.

**Wajib:** SPEC menyatakan topologi yang didukung (browser mode, mesin capture host, secure context), lalu
memutuskan desktop mode **in or out**. Kalau out — guard runtime yang menyembunyikan kontrol guest di
desktop mode. Jangan biarkan operator menemukannya sendiri pada hari Minggu.

---

## 2. Risiko Regresi terhadap Fitur yang Sudah Ada

### 2.1 `ProjectorClient.tsx`: dual-monitor (SPEC-99), scripture overlay (SPEC-100), layout

Kabar baik dulu: SPEC-99 dan SPEC-100 keduanya sudah `status: closed`
(`.control/registry/specs.yaml:4176,4212`), jadi tidak ada konflik merge di udara. Tetapi
`ProjectorClient.tsx` baru saja disentuh oleh keduanya, dan lapisan video baru berinteraksi dengan **empat**
mekanisme yang sudah ada di file itu. Tiga di antaranya tidak disebut satu tiket pun:

| Mekanisme yang sudah ada | Sitasi | Interaksi dengan lapisan video | Status di tiket |
|---|---|---|---|
| **Early return `stalePlan`** — proyektor merender "Unable to continue." saat `planIdentity` tidak cocok | `ProjectorClient.tsx:269`, `present-channel.ts:233` | Kalau lapisan video ditaruh di *luar* return utama, video tamu tetap tayang **di atas** pesan stale-plan, atau sebaliknya video tidak ikut fail-closed. Harus eksplisit: stale plan ⇒ **tidak ada video**. | Tidak disebut |
| **Layer z-40 (F11 fullscreen hint)** | `ProjectorClient.tsx:345-347` | `z-40 > z-30` → banner chrome bilingual "Press F11 for full screen · Tekan F11…" muncul **di atas wajah pembicara tamu** selama 5 detik. Ini pelanggaran AD-24 yang lolos karena tidak ada yang menggambar tumpukan z-nya. Wajib: suppress hint saat `projectedSource === 'guest'`. | Tidak disebut |
| **Scripture overlay menggantikan slide di dalam layer yang sama** | `ProjectorClient.tsx:327-341` | Overlay di-render *instead of* slide, di dalam layer tanpa z-index → tertutup video `z-30`. Pengkhotbah tamu mengutip ayat, operator menekan tombol scripture, **tidak ada yang terjadi di layar**. Lihat B-6: ini keputusan produk yang belum diambil, bukan detail implementasi. | Tidak disebut |
| **Blanking z-50** | `ProjectorClient.tsx:365-370` | Sudah benar dan sudah disebut (`z-50` menutup `z-30`). **Satu syarat tambahan yang wajib ditulis:** jangan pernah memanggil `video.requestFullscreen()`. Kalau elemen `<video>` yang di-fullscreen, subtree blanking `z-50` berada **di luar** fullscreened element → `B` tidak lagi menutupi apa pun → AD-24 rusak secara senyap. Fullscreen hanya boleh pada `document.documentElement` (yang sudah dilakukan `:85-86`). Demikian juga atribut `controls` tidak boleh pernah ada. | Setengah disebut |
| **Display target / window mode (SPEC-99)** | `display-target.ts`, `PresenterOperator.tsx:702-754` | Tidak terganggu secara logika — resolusi/posisi window tidak bergantung pada isi DOM. Risiko sesungguhnya adalah *kinerja*: memindahkan popup proyektor ke layar eksternal yang digerakkan GPU berbeda saat sedang men-decode 1080p adalah resep frame drop di laptop hybrid. Masuk soak test. | Tidak disebut |

**Layout canvas Fabric.js: tidak relevan dan perlu dikoreksi di dokumen.** Seperti disebut di §1.2, jalur
proyeksi adalah DOM (`ArtifactSlide`), bukan Fabric. Menulis "risiko pada canvas Fabric.js" di prompt review
membuat reviewer berikutnya mencari di tempat yang salah.

### 2.2 Apakah `present-channel` terancam desync saat operator navigasi slide sambil live?

**Tidak untuk navigasi slide — dan itu kabar baik yang layak dikatakan.** Desainnya sudah benar di sini:
`sync` membawa *state yang dimaksud* (index, blank, transition, background, scripture, patches), bukan
instruksi flip, sehingga idempotent (`present-channel.ts:4-17`). Menambah `projectedSource` ke payload yang
sama berarti navigasi slide saat live tidak bisa menggeser sumber proyeksi. Pre-cue slide saat live aman.

**Desync yang nyata datang dari tiga arah lain, dan ketiganya belum ditangani:**

1. **Reload / renavigasi proyektor (B-4).** `request-sync` → `currentState()`
   (`PresenterOperator.tsx:1007-1016`) tidak membawa `projectedSource`/`guestSessionId`. Jalur
   `lost`-verdict bahkan **sengaja** merenavigasi window yang ada (`:713-718`). Hasilnya: layar kembali ke
   deck, konsol tetap LIVE, tanpa error di sisi mana pun. Tiket 02 menyebut "extend `PresentMessage`" tapi
   tidak pernah menyebut `currentState()` — dan di file itulah seluruh pemulihan state hidup.
2. **Dua window proyektor.** Sudah mungkin hari ini: link fallback popup-blocked memakai
   `target="_blank" rel="noreferrer"` (`:1902`), lalu operator menekan tombol "Open Congregation Screen"
   yang memanggil `window.open(url, projectorWindowName(serviceId), …)` (`:739-742`). Named-window reuse
   hanya menjadi backstop kalau window sebelumnya dibuat dengan nama yang sama; link `noreferrer` membuat
   window anonim → **dua proyektor hidup di satu channel**. Komentar di `:306-308` sendiri menyebut risiko
   ini. Dengan SPEC-101 konsekuensinya naik kelas: window A (tab noreferrer, tanpa opener) selalu
   gagal-tertutup ke deck, window B (popup) menampilkan tamu. Kalau yang digeser ke layar proyektor adalah
   window A, jemaat tidak pernah melihat tamu sementara konsol berkata LIVE.
3. **Dua tab Presenter.** Kode sudah bertahan untuk liveness (`isProjectorMessage`,
   `present-channel.ts:216`; `PresenterOperator.tsx:1021-1032`), tetapi **tidak** untuk capture: dua tab
   Presenter = dua broker = dua percobaan buka device + dua sumber broadcast `projectedSource` yang bisa
   saling menimpa. Butuh aturan single-writer yang eksplisit, atau minimal perilaku terdokumentasi.

**`guestSessionId` belum didefinisikan.** Tidak ada satu kalimat pun yang mengatakan siapa yang
membuatnya, apakah baru setiap `arm`, dan apa yang dilakukan proyektor saat nilainya berubah. Tanpa itu:
- revert → live lagi akan membuat proyektor meminta clone baru tiap kali (buang-buang, dan bisa bocor), atau
  sebaliknya tidak pernah meminta clone baru setelah re-arm (layar hitam).
- **Wajib:** definisikan sebagai *satu per sesi capture yang di-arm, stabil melintasi pergantian
  live ↔ deck, baru pada setiap `arm`*, dan **perubahan `guestSessionId` memicu re-akuisisi consumer
  stream** — bukan hanya mount (Tiket 03 hanya menangani mount).

---

## 3. Ketepatan Rancangan Arsitektur (Architectural Soundness)

### 3.1 Single CaptureBroker + `track.clone()` fan-out + same-origin opener bridge

**Pemilihan pola: tepat. Pembenaran di Problem Statement: sebagian salah. Ketergantungan strukturalnya:
rapuh dan tidak teruji.**

**Yang tepat.** `MediaStream`/`MediaStreamTrack` tidak structured-cloneable — `postMessage`-nya melempar
`DataCloneError` — jadi AD-10 ("never media streams or binary buffers") bukan pilihan gaya, itu hukum
platform. Satu-satunya cara memindahkan track antar-document dalam satu proses adalah referensi objek langsung
(`window.opener`), atau WebRTC. `track.clone()` dari satu master track itu murah dan tidak membuka device
kedua kali. Satu pemilik lifecycle + registry consumer adalah bentuk yang benar. Tidak ada pola browser
yang lebih baik untuk topologi satu-mesin ini.

**Premis #1 Problem Statement kemungkinan salah, dan itu mengubah risk register.** Klaimnya: dua window
Chrome yang memanggil `getUserMedia` pada device UVC yang sama → yang kedua gagal `NotReadableError`.
Pada Chromium modern, video capture berjalan lewat satu *video capture service* per browser process yang
membuka device sekali dan membagikan frame ke semua client — jadi dua tab dalam satu profil biasanya
**keduanya** dapat frame. Eksklusivitas yang nyata adalah **antar aplikasi** (OBS/Zoom/Teams), bukan antar
window. Ini penting bukan karena keputusannya berubah — single broker tetap benar, dengan alasan yang lebih
kuat (satu pemilik teardown, satu kali buka device, satu sumber `getSettings()`, satu tempat untuk health
check, tidak ada double-decode) — tetapi karena **risiko yang harus dimitigasi berbeda**: yang harus masuk
runbook dan taksonomi error adalah "aplikasi lain memegang capture card", dan itu hari ini tidak disebut di
mana pun. **Wajib:** verifikasi empiris 30 menit pada spike (buka device dari dua window sekaligus di mesin
gereja yang sebenarnya), lalu tulis ulang Problem Statement #1 sesuai hasil. Dokumen arsitektur yang
membenarkan diri dengan premis yang salah akan melahirkan keputusan salah di spec berikutnya.

**Kelemahan struktural #1 — seluruh desain bergantung pada satu fakta yang tidak dijaga siapa pun:
`window.opener !== null` di popup proyektor.** Fakta ini bisa dirusak oleh perubahan yang tidak berhubungan:
- `rel="noreferrer"` pada link fallback — **sudah ada di kode hari ini** (`:1902`);
- menambah header `Cross-Origin-Opener-Policy: same-origin` sebagai hardening keamanan (saat ini belum ada
  satu pun header COOP/CSP di `internal/httpapi/` — saya periksa);
- setting di edge/tunnel;
- popup yang di-detach jadi window terpisah, atau dibuka lewat copy-paste URL.

Tidak ada satu pun test di tiga tiket yang akan menangkap regresi ini, karena semuanya unit test dengan mock.
**Wajib:** satu smoke test Playwright yang benar-benar membuka popup dari halaman operator dan menegaskan
bridge ter-attach (lihat B-9), plus guard bahwa rute projected tidak pernah mengirim COOP.

**Kelemahan struktural #2 — "fails closed, logs warning" bukan kontrak operasional (B-2).** Tiket 03
menulis: kalau opener tidak ada, *"fails closed, logs warning, and cleanly renders the active slide deck"*.
`console.warn` di window yang berada di layar kedua, menghadap jemaat, tidak dibaca siapa pun. Ini harus
diubah menjadi fakta yang **teramati operator**, dan ada cara yang elegan sekaligus legal terhadap AD-29:

> **Broker sudah tahu.** `createConsumerStream()` mendaftar di `Set` broker — artinya operator console dapat
> membaca `consumerCount` langsung, tanpa pesan channel baru, tanpa menyentuh AD-29 sama sekali. Gabungkan
> dengan handle same-origin yang **sudah** dipoll (`:1121-1123`): `projectedSource === 'guest'` **dan**
> `consumerCount === 0` setelah N ms ⇒ tampilkan peringatan operator "ROOM FEED NOT ATTACHED" dan jangan
> pernah menampilkan badge LIVE. Chrome di sisi operator boleh sekasar apa pun — AD-24 hanya menutup
> permukaan yang menghadap ruang.
>
> Positif-palsu (popup mati tanpa cleanup) ditutup dengan purge berbasis poll `.closed` (§1.2).

Kalau tim tetap ingin laporan eksplisit dari proyektor (`guest-bridge-ack`), itu **boleh**, tapi itu
perubahan AD-29: varian ack kedua, pengirimnya harus tetap hanya window proyektor, harus idempotent, tanpa
shared state, tanpa request/response pairing, dan `isProjectorMessage()` (`present-channel.ts:216`) harus
ikut diperbarui supaya tidak merusak gating liveness. Jalur itu butuh `DEC-` + amandemen spine **sebelum**
Tiket 03 ditulis (B-3). Pilih salah satu jalur dan tuliskan; jangan biarkan implementer memilih diam-diam.

**Alternatif yang layak dicatat, lalu ditolak dengan alasan.** WebRTC loopback antar dua window dengan
signaling SDP lewat `present-channel` (string serializable → legal AD-10) jauh lebih tahan terhadap topologi
window: selamat dari reload, tanpa opener, bahkan tab terpisah. Harganya: re-encode (kualitas turun, latency
naik — persis dua hal yang paling merugikan konten slide), kompleksitas ICE, dan satu tiket tambahan. Untuk
venue satu laptop, opener bridge adalah trade-off yang benar — **asal** kegagalannya terlihat (B-2) dan
dijaga oleh test (B-9). Tulis penolakan ini di SDD supaya orang berikutnya tidak menemukan ulang.

### 3.2 Proyektor di-reload, atau dibuka terpisah tanpa opener — kontrak fail-closed sudah tepat?

**Arahnya tepat, eksekusinya belum, dan ada satu kasus yang terbalik.**

| Skenario | Perilaku yang dirancang | Penilaian |
|---|---|---|
| Popup di-reload operator | Bridge minta clone baru saat mount | **Setengah benar.** Mount-time acquisition hanya berguna kalau state-nya `'guest'` — dan setelah reload state itu hilang karena `currentState()` tidak membawanya (B-4). Perbaiki B-4 dulu, baru ini berarti. |
| Popup di-close paksa | `track.onended` di sisi proyektor tidak relevan (window sudah mati); broker harus purge registry | **Belum ada.** Tambah purge berbasis poll `.closed` (§1.2). |
| Dibuka terpisah tanpa opener | Fail closed → render deck | **Benar untuk layar, salah untuk operator.** Tanpa B-2, konsol tetap bilang LIVE. Kontrak "fail-closed" yang tidak memberi tahu siapa pun bahwa ia baru saja fail-closed adalah kontrak yang berbahaya di produksi live. |
| Renavigasi oleh jalur `lost` (`:713-718`) | Tidak dibahas | **Celah.** Window yang sama, opener bertahan, tapi state `guest` hilang bersama reload. Sama dengan B-4. |
| Operator window di-reload/ditutup saat live | Semua consumer track berakhir; proyektor jatuh ke deck | **Benar secara visual, salah secara state.** Setelah reload, operator tidak punya memori bahwa ruang sedang di `guest` (AD-10 melarang localStorage untuk ini — dan itu benar). Proyektor menyimpan `projectedSource: 'guest'` di memorinya sendiri dengan stream mati. **Wajib:** saat stream consumer berakhir, proyektor tidak boleh menyimpan state `guest` yang sudah mati; dan operator yang baru mount harus mem-broadcast `deck` secara eksplisit (yang memang dilakukan `:1070`), sehingga kedua sisi konvergen. Tuliskan konvergensi ini sebagai aturan, bukan sebagai efek samping. |
| **Operator tab di-background / diminimize saat live** | Tidak dibahas | **Celah berbahaya.** Timer watchdog di tab latar belakang di-throttle Chrome (grouping ~1 s). Watchdog yang tidak toleran terhadap throttling akan menyimpulkan "frame berhenti" dan **menarik ruang kembali ke slide di tengah khotbah** — false-positive yang justru merusak AD-1. Repository ini sudah memikirkan hal yang persis sama untuk heartbeat: lihat alasan sizing di `projector-liveness.ts:85-102` ("a popup window on a second screen, ordinarily visible, so it does not suffer ordinary background-tab timer throttling"). **Wajib:** watchdog sisi operator memakai jendela toleransi yang lebar (≥ 3× interval, mengikuti preseden `LIVENESS_FRESHNESS_WINDOW_MS` di `:102`), dan watchdog sisi render ditempatkan di proyektor (window yang terlihat penuh). Jangan pakai angka 1000 ms tanpa alasan. |

---

## 4. Kelengkapan Test Case & Failure Modes

### 4.1 Rencana test yang ada: cukup untuk logika, tidak cukup untuk apa pun yang penting

Tiga file test yang direncanakan (`capture-broker-device-enumeration`, `presenter-guest-feed-controls`,
`projector-guest-media-bridge`) adalah unit test dengan mock. Itu tepat untuk state machine, payload shape,
dan teardown registry. Tetapi **empat klaim yang paling menentukan keselamatan fitur ini tidak bisa dibuktikan
oleh mock**: readiness frame nyata, kloning track nyata lintas window, fallback saat sinyal benar-benar
hilang, dan blanking yang benar-benar menutupi video di layar nyata.

Kabar baiknya: repository ini **sudah punya** semuanya yang dibutuhkan untuk membuktikan itu.
- `tests/helpers/browser-harness.mjs` menyalakan Go API + Chromium asli (`:151-154`) dan sudah dipakai
  `smoke-spec-25` / `smoke-spec-37`.
- CI meng-install Chromium dan menjalankan `npm test` (`.github/workflows/test.yml:47,49`).
- `chromium.launch({ args: [...] })` tinggal ditambah `--use-fake-device-for-media-stream`,
  `--use-fake-ui-for-media-stream`, dan `--use-file-for-fake-video-capture=<path>` → `getUserMedia` nyata,
  permission otomatis, frame nyata dari file. Playwright memberi `page.waitForEvent('popup')` untuk popup
  proyektor yang asli (opener nyata!).

**Wajib (B-9):** satu `tests/smoke-spec-101.test.mjs` di atas harness itu, yang menguji: arm → badge
`ready` dari frame nyata; switch → **popup** benar-benar menampilkan frame (assert `videoWidth > 0` dan
`readyState >= 2` di popup); `track.stop()` di master → popup jatuh ke deck dalam N ms; blanking menutupi
video; popup tanpa opener → deck + peringatan operator.

**Wajib juga, dan ini yang akan menggigit kalau dilewat:** `npm test` di `package.json` adalah **daftar file
eksplisit**, bukan auto-discovery. Tiga file test baru yang tidak didaftarkan **tidak akan pernah berjalan di
CI**. Konvensi repository juga menambah `smoke:spec-NNN` + `test:smoke-spec-NNN` (lihat `smoke:spec-99`,
`smoke:spec-100`). Tidak satu pun tiket menyebut pendaftaran ini. G5 akan "hijau" dengan nol test berjalan.

### 4.2 Absence guard belum di-injection-proof (B-10)

AGENTS.md mengikat: *"A test that asserts something is absent is worth nothing until it has been seen to
fail. Prove every new or changed absence-guard by injecting the defect, then reverting."* Seluruh fitur ini
bersandar pada absensi. Daftar yang wajib punya bukti injeksi tertulis di tiket:

1. tidak ada audio track (`audio: false`) — Tiket 01 sudah menyebut assertion, belum menyebut injeksi;
2. tidak ada `MediaStream`/binary di `BroadcastChannel` (AD-10);
3. tidak ada `localStorage` untuk kontrol stream live (AD-10/AD-24);
4. tidak ada operator chrome, device label, error text, atau atribut `controls` di permukaan projected
   (AD-24);
5. tidak ada `video.requestFullscreen()` di jalur projected (§2.1 — merusak blanking secara senyap);
6. tidak ada auto-arm saat mount (device pertama tidak boleh pernah dipilih otomatis — lihat §5.3);
7. tidak ada render video saat `stalePlan` (§2.1).

Butir 4, 5, 6, 7 belum ada di tiket mana pun.

### 4.3 Edge case yang belum ter-cover

Yang sudah disebut di prompt (laptop sleep, kabel dicabut, 16:10→16:9, re-arming saat live, popup ditutup
paksa) — **semuanya nyata, dan semuanya belum ada di tiket**. Ditambah yang belum disebut siapa pun:

**Signal & device**
1. Laptop tamu sleep / lid close mid-sermon → *frame tetap mengalir* (B-1). Watchdog, bukan `onended`.
2. Kabel HDMI dicabut di sisi TX (laptop tamu), bukan di sisi capture card → sama, tidak ada `onended`.
3. Link wireless UGREEN drop / interferensi 5 GHz (WiFi gereja, microwave, TX di belakang pilar) → frame
   beku atau artifact. Deteksi frame-beku (bandingkan hash/variance frame berurutan) hanya bisa di sisi
   operator; jangan pernah merender peringatan ke ruang.
4. **HDCP** (B-5): Netflix/Disney+/DVD/Blu-ray, atau jalur DRM lain → layar hitam **dengan frame tetap
   mengalir**. `canplay` lolos, badge "Ready" menyala, jemaat menonton hitam. Ini kegagalan paling memalukan
   dan paling mungkin terjadi saat pembicara tamu memutar video klip.
5. Pergantian resolusi/aspect mid-stream (16:10 → 16:9, atau sleep→wake di mode lain) → event `resize` pada
   track/`<video>`; badge dan letterboxing harus diperbarui. Sebagian card mengakhiri track dan meminta
   `getUserMedia` ulang. Belum ada penanganan `onresize` di tiket mana pun.
6. Capture card dicabut lalu dicolok lagi → **`deviceId` berubah** (bukan stabil!). Dropdown yang menyimpan
   `deviceId` akan memilih device yang tidak ada → `OverconstrainedError`. Perlu re-select berbasis **label**
   + listener `navigator.mediaDevices.ondevicechange` (tidak ada di tiket).
7. Device hilang antara enumerasi dan arm → `OverconstrainedError` dari `deviceId: { exact }` harus
   dipetakan ke kalimat manusia + refresh daftar, bukan stack trace.
8. Aplikasi lain memegang device (OBS/Zoom/Teams) → `NotReadableError`. Kegagalan paling sering; belum ada.
9. Windows camera privacy ("Let desktop apps access your camera" off) → `NotFoundError`/`NotReadableError`.
   Wajib masuk runbook.
10. Permission ditolak lalu operator mengubahnya di site settings → perlu `NotAllowedError` + jalur pemulihan,
    dan tidak boleh auto-retry dalam loop.
11. Capture card satu-satunya tidak ada, yang ada hanya webcam built-in → dropdown berisi webcam; operator
    bisa tidak sengaja memproyeksikan wajahnya sendiri. Lihat §5.3.

**Window & state**
12. Popup ditutup paksa (X / kill) saat live → registry leak + positif palsu (B-2, §1.2).
13. Popup di-reload saat live (B-4).
14. Popup di-relocate ke layar lain oleh `relocateProjector` (`:756-758`) saat live → `existing.close()` lalu
    `window.open` baru: stream consumer lama harus dilepas, yang baru diminta. Tidak dibahas.
15. Operator window di-reload / ditutup saat live (§3.2, baris 5).
16. Operator tab di-background / minimize saat live → throttling vs watchdog (§3.2, baris 6).
17. Presenter di-unmount / operator pindah rute (ke run sheet, `:1884`) saat armed → device tetap tergenggam,
    indikator "camera in use" tetap menyala, arm berikutnya dari tab lain gagal. **Wajib:** auto-disarm pada
    unmount + `pagehide`, bukan hanya lewat tombol Disarm.
18. Dua tab Presenter armed bersamaan (§2.2 butir 3).
19. Service berganti (`serviceId` lain) saat live → channel name berubah (`presentChannelName`), popup lama
    masih hidup di channel lama. Belum dibahas.
20. `planIdentity` berubah (Sync Artifact di tengah ibadah) saat live → jalur `stalePlan` (`:269`) harus
    menjatuhkan video juga, dan operator harus tahu bahwa layarnya kini "Unable to continue."
21. Blank (`B`) saat live, lalu revert, lalu un-blank → urutan z harus tetap benar di ketiga langkah;
    blank harus bertahan melintasi pergantian sumber (blanking memang dirancang menutupi, bukan mengganti,
    `:365-370`).
22. `stalePlan` + `guest` bersamaan (§4.2 butir 7).

**Kinerja & durasi**
23. Soak 90 menit: dropped frames, memori renderer, suhu/throttling, dan apakah fps terukur turun (§1.2).
24. Pre-cue slide saat live: transisi rAF berjalan di bawah video → ukur dropped frames (§1.2).
25. Latency end-to-end terukur (kamera/webcam ke layar proyektor, atau file video dengan timecode) — satu
    angka yang dicatat, bukan diperkirakan (§1.1).
26. Legibility teks 20–24pt dari baris belakang (§1.1) — acceptance gate subjektif tapi menentukan.

### 4.4 Apakah unit test + mock cukup untuk menjamin keandalan saat hardware nyata dicolok?

**Tidak, dan tidak akan pernah.** Mock membuktikan kontrak kode; hardware membuktikan kontrak dunia. Yang
wajib ditambahkan sebagai artefak, bukan sebagai niat:

- **Satu `MANUAL-HARDWARE-VERIFICATION` checklist** di folder spec (atau `tests/manual-*` mengikuti preseden
  `tests/manual-live-smoke-verification.mjs`) yang dijalankan di gereja dengan perangkat sebenarnya, berisi
  butir 1–11, 23–26 di atas, dengan kolom hasil terukur (fps nyata, resolusi nyata, latency ms, suhu,
  legibility). Tanpa ini, "ready" di kode tidak punya arti apa pun.
- **Satu spike 1 hari sebelum tiket 01 dibuka** (§6.2), karena tiga dari enam pertanyaan di atas
  (fps nyata, latency, perilaku signal-loss pada card ini) menentukan bentuk kode, bukan mengujinya.
- **Defect-injection proof** untuk ketujuh absence guard (§4.2).

---

## 5. Ergonomi & UI/UX Operator

### 5.1 Alur `Pilih Device → Arm → Pre-warm Preview → Switch → Revert → Disarm`

**Bentuk alurnya benar.** Pemisahan arm (mahal, bisa gagal, butuh waktu) dari switch (murah, harus instan)
adalah keputusan produksi yang tepat, dan pre-warm berarti operator tidak pernah menunggu `getUserMedia`
di depan jemaat. Ini bagian terbaik dari seluruh rancangan.

Yang kurang:

- **Arm harus dilakukan sebelum ibadah, bukan saat khotbah dimulai.** Tuliskan sebagai prosedur di runbook:
  arm pada saat sound check, biarkan `ready`, lalu switch hanya satu klik. Kalau arm dilakukan live, operator
  menghadapi prompt permission + 5 s timeout di depan jemaat.
- **`presentationLock` tidak disebut satu tiket pun (B-7).** Presenter mount dalam keadaan **terkunci**
  (`PresenterOperator.tsx:488`) dan kontrol dinonaktifkan saat terkunci (`:1884`). Kontrol guest harus
  menghormati lock untuk Arm/Switch — **tetapi Revert tidak boleh pernah dinonaktifkan oleh lock**. Kalau
  operator mengunci konsol saat feed live lalu perlu kembali ke deck, tombol panic yang disabled adalah
  bencana kecil yang bisa dihindari dengan satu baris kode.
- **Preview terlalu kecil untuk tugasnya.** Thumbnail "compact di toolbar" tidak cukup untuk tugas yang
  sebenarnya dibebankan padanya: memastikan (a) sinyalnya ada, (b) isinya bukan layar hitam HDCP, (c) isinya
  bukan desktop tamu dengan notifikasi email/password yang terbuka. **Wajib:** area preview minimal ~240 px
  lebar dengan aspect ratio terjaga, dan tombol Switch **bersebelahan** dengan preview sehingga mata tidak
  perlu berpindah. Kalau perlu, sediakan "perbesar preview" (dialog di sisi operator — chrome operator
  diizinkan, AD-24 hanya melarangnya di ruang).
- **Switch live berarti seluruh layar tamu menjadi milik publik.** Notifikasi, jendela pribadi, prompt
  password — semua ikut ke proyektor. Ini bukan bug, ini sifat fitur, dan operator sukarelawan harus
  diberitahu satu kalimat di UI (bukan hanya di dokumen): "Live = seluruh layar pembicara tampil ke jemaat."

### 5.2 Apakah Revert/panic button cukup responsif dan aman?

**Responsif: ya, kalau revert adalah *cut*.** Broadcast `{ projectedSource: 'deck' }` + melepas `srcObject`
harus melukis dalam satu frame. **Wajib diuji dengan angka** (mis. assert deck terlukis < 250 ms setelah
klik di smoke test Playwright), bukan diasumsikan. Jangan bungkus revert dalam animasi transisi apa pun.

**Aman: belum, karena tiga hal.**

1. **Tombol yang paling penting harus bisa ditemukan tanpa melihat.** Di bawah tekanan, operator tidak
   membaca label. Revert harus (a) selalu di posisi tetap, (b) kontras tinggi, (c) punya hotkey, dan (d)
   **selalu enabled** — termasuk saat locked (§5.1), saat state `lost`, dan saat broker error.
2. **Hotkey `G` sebagai *toggle* adalah keputusan yang salah (B-7).** Toggle berarti tekanan kedua
   mengembalikan tamu ke layar. Dalam panik, orang menekan berulang. **Wajib:** `G` = *one-shot* "go live",
   hanya valid dari state `ready`; revert = `Escape` atau `Shift+G`, satu arah saja. `B` tetap blanking.
3. **`Escape` bertabrakan.** `Escape` adalah kunci dismiss dialog (Base UI / `SlideGridDialog`) dan kunci
   keluar fullscreen. Handler global baru di komponen baru **tidak mewarisi** guard yang sudah ada di
   `PresenterOperator.tsx:1142-1160` (`gridOpen`, dan `INPUT`/`TEXTAREA`/`SELECT`). Tanpa guard itu,
   operator yang sedang memilih device dengan keyboard (focus di `<select>`) lalu menekan `g` akan
   **menayangkan tamu ke jemaat**. **Wajib:** replikasi guard yang sama persis, plus test "tombol ditekan
   saat device SELECT focus tidak melakukan apa pun", plus aturan bahwa revert tidak boleh tertutup dialog
   (dialog kalah).

### 5.3 Satu bahaya ergonomi yang belum disebut siapa pun: device yang salah

Laptop operator hampir pasti punya webcam built-in. Sebelum permission diberikan, `enumerateDevices()`
mengembalikan label kosong → dropdown berisi "Video Input 1 / 2 / 3" (Tiket 01 sudah menangani label kosong,
bagus). Artinya pada ibadah pertama, operator **tidak bisa membedakan capture card dari webcam**, dan
tidak ada mekanisme mengingat pilihan.

**Wajib:**
- **Tidak boleh ada auto-select/auto-arm** device pertama (absence guard §4.2 butir 6);
- setelah satu arm成功, simpan **label** device (bukan `deviceId` — tidak stabil antar replug, §4.3 butir 6)
  sebagai *persisted-local* di `localStorage` operator shell. Ini legal dan tepat menurut AD-24: preferensi
  milik mata operator sendiri, bukan state yang disepakati bersama, dan **bukan** kontrol stream live
  (spec sudah benar melarang localStorage untuk kontrol stream — pertahankan kalimat itu, dan tambahkan
  kalimat bahwa yang disimpan hanya preferensi device);
- urutkan daftar sehingga device yang terakhir dipakai berada di atas, dengan penanda;
- tampilkan `getSettings()` nyata (resolusi/fps terukur) di badge supaya "USB Video" 640×480 langsung
  ketahuan salah pilih.

---

## 6. Ketepatan Desain & Analisa Keseluruhan

### 6.1 Native di WorshipDeck, atau HDMI switcher fisik 2×1?

**Jawaban jujur: keduanya, tapi tidak seperti yang dirancancang sekarang — dan urutan pembeliannya
dibalik.**

Pertanyaan yang menentukan bukan "mana yang lebih canggih", melainkan **"apa yang dibutuhkan gereja?"**
Kebutuhan yang dinyatakan di SPEC adalah: *menampilkan layar laptop pembicara tamu ke proyektor jemaat, dan
kembali ke slide liturgi sesudahnya.* Untuk kebutuhan itu:

| Kriteria | HDMI switcher 2×1 fisik | SPEC-101 (native) |
|---|---|---|
| Menampilkan layar tamu | Ya | Ya, **asal** 14 blocking item ditutup |
| Latency | ~0 | 150–500 ms (dua hop wireless + decode + composite) |
| Ketajaman teks slide | Bit-perfect | 4:2:0 dua kali → berisiko tidak terbaca (§1.1) |
| HDCP | Umumnya lolos | **Layar hitam** (§4.3 butir 4) |
| Bergantung pada OS/driver/browser/permission/secure context | Tidak | Ya, semuanya |
| Tetap jalan saat laptop operator hang / browser crash / update Windows | Ya | Tidak |
| Offline guarantee ala AD-1 untuk segmen tamu | **Ya — inilah Plan A-nya** | **Tidak ada.** PPTX tidak bisa menampilkan tamu. Kalau browser mati saat khotbah tamu, tidak ada jalur kembali ke tamu kecuali hardware |
| Biaya | ~harga satu kabel HDMI | 3 tiket + spike + soak + runbook + risiko hari Minggu |
| Nilai tambah yang **tidak** bisa diberikan switcher | — | Preview/health di konsol operator, integrasi overlay liturgi & scripture di atas feed, confidence monitor, jalan menuju recording/streaming |

Perhatikan baris AD-1. Spec mengutip AD-1 sebagai dasar ("slide deck adalah Plan A, streaming adalah Plan B
dengan failover instan"), tetapi yang benar adalah kebalikannya untuk segmen ini: **untuk segmen khotbah
tamu, tidak ada Plan A sama sekali di dalam produk.** AD-1 sendiri menyatakan jaminan offline Sabbath adalah
PPTX yang bisa diunduh (`ARCHITECTURE-SPINE.md:62-65`) — dan PPTX tidak bisa menampilkan laptop tamu. Jadi
fitur ini, apa pun hasilnya, tetap membutuhkan jalur hardware sebagai jaringannya. Menyatakan itu di SPEC
adalah kejujuran yang menghemat perdebatan nanti.

**Rekomendasi saya, berurutan:**

1. **Beli switcher 2×1 sekarang** (atau pakai input kedua di proyektor/AV receiver kalau ada). Ini menutup
   kebutuhan yang dinyatakan hari ini, dengan risiko nol, dan menjadi Plan A untuk segmen tamu.
2. **Jalankan spike 1 hari (§6.2)** dengan perangkat yang benar-benar ada di gereja.
3. **Pecah SPEC-101 menjadi dua, dan bangun yang rendah risiko lebih dulu:**
   - **101-A — Operator-side capture, preview, dan signal health.** Tiket 01 + 02, **tanpa** lapisan video di
     `ProjectorClient.tsx` sama sekali. Operator mendapat: device picker, preview, badge resolusi/fps
     terukur, watchdog sinyal, dan peringatan "signal lost / HDCP black / device busy" **di konsolnya
     sendiri**. Ini berguna dengan sendirinya (operator bisa melihat apa yang akan ditayangkan tamu
     *sebelum* switcher dipindah, dan tahu lebih dulu kalau link wireless mati), tidak menyentuh AD-24,
     tidak menyentuh AD-29, tidak menyentuh permukaan ruang, dan menghapus B-2/B-3/B-4/B-6 dari daftar
     risiko. **Nilai tinggi, risiko rendah.**
   - **101-B — Room-facing video layer.** Tiket 03, dan hanya kalau spike membuktikan kualitas & latency
     layak, **dan** ada kebutuhan produksi yang switcher tidak bisa penuhi (overlay liturgi di atas feed,
     recording, streaming, atau satu operator yang harus memotong antara deck dan tamu dalam hitungan
     frame). Kalau tidak ada kebutuhan itu, tutup 101-B sebagai *won't do* dan catat alasannya — itu
     keputusan arsitektur yang sah, bukan kegagalan.
4. **Kalau 101-B dibangun**, tutup 14 blocking item di §7 lebih dulu, dan naikkan `size` dari `S` ke `M`
   (§7 B-12).

### 6.2 Spike 1 hari — wajib, sebelum satu baris kode

Satu hari, di gedung gereja, dengan perangkat yang sebenarnya, dan **hasilnya dicatat sebagai angka** di
folder spec:

| # | Yang diukur | Ambang keputusan |
|---|---|---|
| 1 | `track.getSettings()` + fps **terukur** (rVFC) pada capture card ini di Chrome | ≥ 24 fps nyata untuk lanjut; < 15 fps ⇒ stop, jalur software tidak layak |
| 2 | Format yang dinegosiasikan (YUY2 vs MJPG) dan apakah 1080p tercapai | 1080p nyata, bukan 720p yang di-upscale |
| 3 | Latency end-to-end (video timecode dari laptop tamu, difoto di layar proyektor) | ≤ 200 ms untuk konten slide; catat angkanya apa adanya |
| 4 | Legibility teks 20–24pt dari baris belakang | Subjektif tapi mengikat: "bisa dibaca" / "tidak" |
| 5 | **Perilaku signal loss** — laptop tamu sleep, kabel HDMI dicabut, wireless dimatikan. Periksa: apakah `track.onended` menyala? Apakah `readyState` berubah? Apa yang tampil di frame? | Ini yang **menentukan** apakah B-1 perlu watchdog penuh atau cukup `onended` |
| 6 | Perilaku HDCP (putar konten terproteksi) | Konfirmasi layar hitam + frame tetap mengalir |
| 7 | Apakah dua window Chrome bisa membuka device yang sama (uji premis §3.1) | Menentukan kalimat Problem Statement #1 |
| 8 | Eksklusivitas antar aplikasi (buka OBS/Zoom, lalu arm) | Menghasilkan baris runbook + pesan `NotReadableError` |
| 9 | Soak 30–90 menit: dropped frames, memori renderer, suhu | Tidak ada degradasi progresif |
| 10 | Replug capture card: apakah `deviceId` berubah? apakah `devicechange` menyala? | Menentukan strategi re-select berbasis label |

Sepuluh pengukuran ini mengubah SPEC dari "kami percaya ini bisa" menjadi "kami tahu ini bisa, dengan angka
ini". Tiga di antaranya (#1, #3, #5) bisa membatalkan atau membentuk ulang desain — itulah sebabnya spike
harus terjadi **sebelum** tiket 01, bukan sebagai bagian darinya.

### 6.3 Skor kesiapan

**6 / 10.**

| Dimensi | Skor | Catatan |
|---|---|---|
| Kejelasan masalah & motivasi | 7 | Nyata, spesifik, berbasis perangkat yang ada. Premis #1 perlu diverifikasi (§3.1). |
| Kesesuaian dengan invarian (AD-1/10/24/29) | 6 | AD-10 & AD-24 dihormati dengan baik. AD-29 **ditabrak** tanpa `DEC-` (B-3). AD-1 dikutip tapi konsekuensinya (tidak ada offline guarantee untuk segmen tamu) tidak dinyatakan. |
| Model kegagalan | 3 | Bersandar pada `track.onended` (B-1); tidak ada watchdog; HDCP tidak disebut; kegagalan bridge tidak teramati (B-2). |
| Kelengkapan state & sinkronisasi | 5 | State machine bagus; `currentState()`/`request-sync` terlewat (B-4); `guestSessionId` tidak didefinisikan; dua tab Presenter tidak dibahas. |
| Rencana test | 4 | Unit test layak; tidak ada bukti browser nyata padahal harness-nya ada; tidak ada registrasi di `package.json`; absence guard belum di-injection-proof. |
| Ergonomi operator | 6 | Alur arm/pre-warm/switch tepat; lock, hotkey collision, ukuran preview, dan pemilihan device salah belum ditangani. |
| Kesiapan deployment (secure context, desktop, LAN) | 4 | Guard `isSecureContext` ada; WebView2, port drift, dan jalur LAN `0.0.0.0` belum; runbook Windows belum ada. |
| Ketertiban method (traceability, sizing, corpus, DEC) | 4 | FR-16/FR-19 dipaksakan; `size: S` tidak jujur; tidak ada update SRS/SDD/scenario/LC; tidak ada `DEC-`/`OQ`/risk entry. |

**Blocking items: 14** (4 `[Critical]`, 6 `[High]`, 4 `[Medium]`) — daftar lengkap di §7.

---

## 7. Daftar Celah / Blindspot (Blocking & Non-Blocking)

Label: **[C]=Critical** (harus tutup sebelum kode), **[H]=High** (harus tutup sebelum tiket ditutup),
**[M]=Medium** (harus diputuskan dan dicatat).

| ID | Lv | Celah | Perbaikan wajib | Mendarat di |
|---|---|---|---|---|
| **B-1** | C | `track.onended` bukan detektor signal loss; laptop sleep / HDMI dicabut / wireless drop / HDCP semua tetap mengirim frame | Frame watchdog berbasis `requestVideoFrameCallback` (atau `getVideoPlaybackQuality().totalVideoFrames`) di **kedua** sisi; jendela toleransi mengikuti preseden `projector-liveness.ts:85-102` supaya tidak false-positive saat tab di-throttle; deteksi uniform/black frame **hanya** di sisi operator; probe harus elemen yang *ter-render* (rVFC tidak menyala pada `display:none`) | SPEC §1–2; tiket 01, 02, 03 |
| **B-2** | C | "Room attached" tidak teramati; `rel="noreferrer"` di `PresenterOperator.tsx:1902` sudah bisa membuat `opener === null`; dua window proyektor sudah mungkin | Gate LIVE pada `broker.consumerCount >= 1` **dan** handle tidak `closed`; tampilkan "ROOM FEED NOT ATTACHED" di konsol operator; purge registry saat poll `.closed` (`:1121-1123`) membaca true + `releaseConsumer` pada `pagehide` popup | tiket 01, 02, 03 |
| **B-3** | C | Menabrak AD-29 (`ARCHITECTURE-SPINE.md:255,259`) tanpa `DEC-`; `.control/registry/decisions.yaml` kosong untuk SPEC-101 | Pilih jalur broker-side (B-2, tanpa pesan baru — **direkomendasikan**) **atau** buka `DEC-` + amandemen AD-29 (varian ack kedua, tetap state-free, idempotent, hanya window proyektor, `isProjectorMessage()` diperbarui) sebelum tiket 03 | `wdi-decision` (nanti, atas persetujuan owner) |
| **B-4** | C | Reload/renavigasi/late-open proyektor kehilangan `projectedSource` karena `currentState()` (`:1007-1016`) tidak membawanya | Tambah `projectedSource`/`guestSessionId` ke `currentState()` + refs; proyektor re-akuisisi consumer saat **`guestSessionId` berubah**, bukan hanya saat mount | tiket 02, 03 |
| **B-5** | H | HDCP → layar hitam yang lolos `canplay` dan menyalakan badge "Ready" | Nyatakan scope di SPEC (slide/PDF/video tak terproteksi); preview verification oleh manusia sebelum Switch; optional uniform-frame warning di sisi operator; masuk spike #6 | SPEC; tiket 02 |
| **B-6** | H | Scripture overlay (`ProjectorClient.tsx:327`) tertutup video `z-30`; perilaku belum diputuskan | Putuskan satu: (i) guest menutupi overlay dan UI operator mengatakannya, atau (ii) overlay di atas video pada z bernama (mis. `z-35`) dengan latar sendiri. Lalu test menegaskan urutan yang dipilih | SPEC; tiket 03 |
| **B-7** | H | `presentationLock` (`:488`, `:1884`) tidak disebut; `G` sebagai toggle berbahaya; `Escape` tabrakan dialog/fullscreen; guard `gridOpen`/`INPUT`/`TEXTAREA`/`SELECT` (`:1142-1160`) tidak diwarisi komponen baru | `G` one-shot dari `ready`; revert satu arah dan **tidak pernah** disabled oleh lock; replikasi guard; test "key saat SELECT focus = no-op" | tiket 02 |
| **B-8** | H | Label UI hardcoded English; repository memakai catalogue (`src/lib/i18n/keys.ts` ±785 key, `catalogue-en.ts`/`catalogue-id.ts`) yang dijaga `bilingual-i18n-parity.test.mjs` + `operator-i18n-guard.test.mjs` | Tambah key `presenter.guestFeed.*` di **tiga** file; sisi projected tetap tanpa string operator (AD-24) | tiket 02, 03 |
| **B-9** | H | `npm test` = daftar eksplisit → test baru tidak jalan di CI; tidak ada bukti browser nyata padahal harness ada | Daftarkan 3 file test + tambah `smoke:spec-101`/`test:smoke-spec-101`; tambah `tests/smoke-spec-101.test.mjs` di atas `browser-harness.mjs` dengan `--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`, `--use-file-for-fake-video-capture` | tiket 01, 02, 03 + `package.json` |
| **B-10** | H | Absence guard belum di-injection-proof (AGENTS.md) | 7 absensi (§4.2) masing-masing dengan bukti inject → fail → revert tercatat di tiket | tiket 01, 02, 03 |
| **B-11** | H | Desktop WebView2 (tanpa handler `PermissionRequested`/`NewWindowRequested`), port drift → origin berubah → permission & `deviceId` hilang, dan jalur LAN `LISTEN_HOST=0.0.0.0` membuat `navigator.mediaDevices` **undefined** | SPEC menyatakan topologi yang didukung; guard `!isSecureContext \|\| !navigator.mediaDevices` → sembunyikan/nonaktifkan kontrol dengan satu kalimat manusia; putuskan desktop mode in/out (kalau out, guard runtime); runbook Windows (camera privacy, aplikasi lain memegang device) | SPEC; tiket 01 |
| **B-12** | M | Traceability dipaksakan: FR-16 = "Two-screen presenter view in the browser", FR-19 = "Search and display an on-demand verse in Presenter" (`requirements-operator-turn.yaml:69-84`) — tidak ada yang menjanjikan sumber video eksternal; `size: S` menuntut "no new FR"; `presenter` = `mode: deep`/`risk_accepted: medium` dengan risk note tentang nama & ayat, bukan video live orang di layar ruang; tidak ada update corpus (`.what/presenter/05-scenarios/`, `.how/presenter/04-components/LC-*`, SDD, SRS) | Amandemen SRS/PRD (FR baru **atau** pernyataan eksplisit bahwa ini perpanjangan bukti FR-16) — lewat `wdi-build to-spec`; periksa ulang `size` (→ M) dan `risk_accepted` — lewat `wdi-init` intent `risk`; tambah scenario SCN-* (signal lost mid-sermon; armed tapi ruang tidak attach) dan LC-* untuk capture broker; re-derive structure map | SPEC + registries |
| **B-13** | M | Taksonomi error satu kode (`INSECURE_CONTEXT`); empat kegagalan nyata tak bernama | Petakan `NotFoundError` (card tak terdeteksi / privacy Windows), `NotAllowedError` (permission ditolak), `NotReadableError` (aplikasi lain memegang device), `OverconstrainedError` (device hilang / `deviceId` basi setelah replug) → masing-masing satu kalimat manusia ter-lokalisasi + satu tindakan pemulihan; tambah listener `devicechange` + re-select berbasis **label** | tiket 01, 02 |
| **B-14** | M | Premis Problem Statement #1 (eksklusivitas UVC antar window Chrome) kemungkinan salah; risiko eksklusivitas yang nyata (aplikasi lain) tidak disebut | Verifikasi di spike #7; tulis ulang premis sesuai hasil; pindahkan risiko yang benar ke runbook | SPEC |

**Blindspot tambahan yang tidak muat di tabel (harus dicatat di SPEC/SDD):**

- **B-15 `guestSessionId` belum didefinisikan** — siapa membuat, kapan baru, apa yang terjadi saat berubah
  (§2.2). Tanpa definisi, dua implementer akan menulis dua perilaku.
- **B-16 Teardown otomatis tidak ada** — unmount Presenter / pindah rute / `pagehide` harus auto-disarm,
  kalau tidak device tetap tergenggam dan arm berikutnya gagal (§4.3 butir 17).
- **B-17 Badge harus menampilkan fps terukur**, bukan `getSettings().frameRate` (§1.1).
- **B-18 `muted` adalah invarian autoplay**, bukan hanya anti-howling; rejection `video.play()` harus
  fallback ke deck (§1.3 butir 2).
- **B-19 Transisi harus dibekukan saat live** supaya pre-cue tidak membakar GPU di bawah video, tapi DOM
  slide tetap mount supaya revert instan (§1.2).
- **B-20 Tidak ada rencana untuk "operator salah pilih device"** (webcam built-in tampil di dropdown;
  tidak ada memori pilihan) (§5.3).
- **B-21 Privasi/consent** — menampilkan layar & wajah tamu ke ruang (dan nanti ke recording/stream) layak
  satu kalimat di SRS; AD-24 sendiri sudah menyebut "congregation or OBS output" sebagai kelas permukaan.
- **B-22 Satu laptop memikul tiga peran** (capture host + konsol + output ruang) sekaligus men-decode 1080p.
  Perlu minimum spec terdokumentasi + pengaturan power Windows (jangan sleep/dim) di runbook (§1.4).

---

## 8. Rekomendasi Tindakan Nyata bagi Tim

**Urutan penting. Jangan mulai dari tiket 01.**

### Langkah 0 — Keputusan produk, sebelum engineering (owner, ~30 menit)
1. Jawab satu pertanyaan: **apakah gereja hanya perlu menayangkan layar tamu, atau perlu mengintegrasikannya
   dengan produksi (overlay liturgi/scripture di atas feed, recording, streaming)?**
   - Kalau hanya menayangkan → beli switcher 2×1, jalankan spike untuk memastikan, dan pertimbangkan hanya
     **101-A** (operator-side preview & health) sebagai nilai tambah. Tutup 101-B sebagai *won't do* dengan
     alasan tercatat.
   - Kalau perlu integrasi → lanjut, dengan 14 blocking item ditutup lebih dulu.
2. Naikkan ini ke tempat yang benar: ini pertanyaan yang belum bisa diputuskan sekarang →
   **skill `wdi-question`** (default `assumptions.md`, bukan `blocking.md`, kecuali owner memang
   memblokir). B-3 (tabrakan AD-29) → **skill `wdi-decision`**, dan itu `DEC-` **wajib** karena
   menyentuh `AD-N`. B-12 (FR/sizing/risk) → **skill `wdi-build` (`to-spec`)** untuk amandemen SRS/PRD dan
   **skill `wdi-init` intent `risk`** untuk `presenter`.
   Sesuai AGENTS.md, saya **tidak** memanggil skill apa pun — saya hanya menyebutkannya; tunggu perintah
   owner.

### Langkah 1 — Spike hardware 1 hari (§6.2)
Sepuluh pengukuran, hasilnya dicatat sebagai angka di folder spec. Tiga di antaranya — butir 1 (fps nyata),
butir 3 (latency), dan butir 5 (perilaku signal-loss) — bisa membatalkan atau membentuk ulang desain.

### Langkah 2 — Perbaiki dokumen, bukan kode
Tulis ulang SPEC dengan: premis #1 yang sudah diverifikasi; scope HDCP & latency; definisi `guestSessionId`;
topologi deployment yang didukung (secure context, satu laptop tiga peran, desktop in/out); keputusan
scripture-vs-guest; keputusan freeze-transition; dan pernyataan jujur bahwa **segmen tamu tidak punya offline
guarantee** di bawah AD-1, sehingga jalur hardware tetap menjadi jaringannya. Lalu pecah menjadi **101-A**
(operator-side, tanpa menyentuh `ProjectorClient.tsx`) dan **101-B** (room-facing, hanya kalau layak).

### Langkah 3 — Perbaiki tiket sebelum implementasi
- **Tiket 01:** watchdog frame + ukuran toleransi beralasan; taksonomi 5 error; `devicechange` + re-select
  berbasis label; auto-disarm pada unmount/`pagehide`; purge consumer registry berbasis poll `.closed`;
  badge fps terukur; pendaftaran test di `package.json` + flag fake-media di harness; injection-proof untuk
  absensi 1–3, 6.
- **Tiket 02:** `currentState()` + refs (B-4); `presentationLock` (arm/switch hormati lock, revert tidak
  pernah); hotkey one-shot + guard yang direplikasi; i18n key di tiga file; gate LIVE pada consumerCount +
  peringatan "ROOM FEED NOT ATTACHED"; preview ≥ 240 px bersebelahan dengan Switch; satu kalimat "live =
  seluruh layar tamu tampil"; injection-proof absensi 2–3.
- **Tiket 03:** re-akuisisi saat `guestSessionId` berubah; larangan eksplisit `video.requestFullscreen()`
  dan `controls`; suppress F11 hint (`z-40`) saat guest; `stalePlan` ⇒ tanpa video; urutan z scripture vs
  video sesuai keputusan B-6; penanganan `play()` rejection; fallback deck terukur < 250 ms; injection-proof
  absensi 4, 5, 7.

### Langkah 4 — Buktikan di browser nyata, lalu di gedung
`tests/smoke-spec-101.test.mjs` di atas `browser-harness.mjs` (popup asli, opener asli, frame asli) +
`MANUAL-HARDWARE-VERIFICATION` checklist dijalankan di gereja sebelum fitur dinyatakan siap, termasuk soak
90 menit dan uji legibility dari baris belakang.

---

## Appendix — Indeks Bukti (sitasi yang dipakai review ini)

| Klaim | Bukti |
|---|---|
| `currentState()` tidak membawa `projectedSource` | `src/operator/present/PresenterOperator.tsx:1007-1016` |
| `request-sync` dijawab oleh `currentState()` | `src/operator/present/PresenterOperator.tsx:1033-1034` |
| Jalur `lost` merenavigasi window yang ada | `src/operator/present/PresenterOperator.tsx:713-718` |
| `window.open` bernama + fitur (opener ada) | `src/operator/present/PresenterOperator.tsx:739-742` |
| Named-window reuse sebagai backstop dua proyektor | `src/operator/present/PresenterOperator.tsx:306-312` |
| Link fallback `target="_blank" rel="noreferrer"` → opener null | `src/operator/present/PresenterOperator.tsx:1902` |
| Poll `.closed` tiap interval (mekanisme yang sudah ada) | `src/operator/present/PresenterOperator.tsx:1121-1123` |
| Hotkey `b`/`B`/`.` + guard `gridOpen`/`INPUT`/`TEXTAREA`/`SELECT` | `src/operator/present/PresenterOperator.tsx:1142-1160` |
| Presenter mount dalam keadaan locked | `src/operator/present/PresenterOperator.tsx:488`, `:1884` |
| Early return `stalePlan` ("Unable to continue.") | `src/projected/ProjectorClient.tsx:269` |
| Scripture overlay menggantikan slide di layer yang sama | `src/projected/ProjectorClient.tsx:327-341` |
| Hint F11 di `z-40` | `src/projected/ProjectorClient.tsx:345-347` |
| Blanking `z-50` sebagai *cut*, bukan efek | `src/projected/ProjectorClient.tsx:365-370` |
| Fullscreen hanya pada `document.documentElement` | `src/projected/ProjectorClient.tsx:85-86` |
| Kontrak channel: state yang dimaksud, idempotent; `sync` menjawab `request-sync` | `src/lib/present-channel.ts:4-17` |
| `isProjectorMessage` — satu-satunya tempat pembeda pengirim | `src/lib/present-channel.ts:216` |
| `sharedStatePlanIdentity` fail-closed / `adoptsSharedState` | `src/lib/present-channel.ts:226-238` |
| AD-29: satu varian ack, pengirim tunggal, "a new decision, not an implementation choice" | `.how/_platform/ARCHITECTURE-SPINE.md:255,259` |
| AD-24: permukaan ruang tertutup dari operator chrome | `.how/_platform/ARCHITECTURE-SPINE.md:205` |
| AD-10: satu channel, plan identity, projector-originated state-free | `.how/_platform/ARCHITECTURE-SPINE.md:108` |
| AD-1: PPTX adalah jaminan offline Sabbath | `.how/_platform/ARCHITECTURE-SPINE.md:62-65` |
| Alasan sizing heartbeat vs throttling tab latar (preseden untuk watchdog) | `src/lib/projector-liveness.ts:85-102` |
| Proyektor merender DOM, bukan Fabric | `src/components/SlideView.tsx` → `ArtifactSlide`; Fabric di `src/components/admin/ArtifactEditor.tsx` (AD-13) |
| Bind default loopback; `LISTEN_HOST` override | `cmd/api/listen.go:8-18`; `.constitution/project/deployment.md:28-31` |
| Desktop = WebView2 tanpa handler permission/new-window | `internal/desktop/window_windows.go:193-205,277` |
| Port desktop dipindai → origin bisa berubah | `internal/desktop/port.go` (`FindAvailablePort`) |
| Tidak ada header COOP/CSP hari ini (bridge aman, tapi tak terjaga) | `internal/httpapi/*.go` (diperiksa; hanya `Content-Type`, `Cache-Control`, `X-Content-Type-Options`, `Retry-After`) |
| Harness Playwright + args yang perlu ditambah | `tests/helpers/browser-harness.mjs:151-154` |
| CI meng-install Chromium dan menjalankan `npm test` | `.github/workflows/test.yml:47,49` |
| `npm test` = daftar file eksplisit; konvensi `smoke:spec-NNN` | `package.json` scripts |
| i18n: ±785 key + dua catalogue + guard parity | `src/lib/i18n/keys.ts`, `catalogue-en.ts`, `catalogue-id.ts`, `tests/bilingual-i18n-parity.test.mjs`, `tests/operator-i18n-guard.test.mjs` |
| FR-16 / FR-19 tidak menjanjikan sumber video eksternal | `.control/registry/requirements-operator-turn.yaml:69-84` |
| `presenter`: `mode: deep`, `risk_accepted: medium` | `.control/registry/components.yaml:44-48` |
| SPEC-101: `size: S`, `depends_on: [SPEC-100]`, 3 tiket, tanpa AC | `.control/registry/specs.yaml:4240-4274` |
| SPEC-99 & SPEC-100 sudah closed | `.control/registry/specs.yaml:4176,4212` |
| Tidak ada `DEC-`/risk/question untuk SPEC-101 | `.control/registry/decisions.yaml`, `risks.yaml`, `.control/questions/*.md` (diperiksa) |
| Aturan absence-guard harus di-injection-proof | `AGENTS.md` § Code |

---

*Catatan hygiene: file ini berada di `.work/handover-reviews/` (scratch yang dikosongkan saat task tutup).
Tidak ada data jemaat, nama asli, atau informasi production host di dalamnya. Tidak ada kode yang diubah,
tidak ada skill yang dipanggil, tidak ada commit yang dibuat selama review ini.*

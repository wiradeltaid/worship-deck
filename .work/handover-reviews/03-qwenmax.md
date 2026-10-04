# Review Handover (Round 2): Qwen Max (OpenCode / DashScope)

**Tanggal:** 2026-10-04
**Target Fitur:** SPEC-101 (Guest Speaker HDMI Video Capture Input) — Round 2 Re-Review
**Reviewer slot:** Qwen Max — Technical Lead & Principal Architect (independent, adversarial)
**Status Review:** Complete
**Metode:** Audit penutupan (closure audit) atas 22 temuan Round 1 saya sendiri, diverifikasi terhadap kode
yang benar-benar ada di `main` pada `e9a6b16c`, registry, dan CI — bukan terhadap klaim dokumen. Setiap
temuan membawa sitasi `file:line` supaya bisa diaudit ulang.

---

## 0. Verdict & Skor

**Verdict Akhir: NEEDS MINOR POLISH — tetapi "minor" menunjuk pada *usaha*, bukan pada *gerbang*.**
Seluruh perbaikan yang tersisa bersifat dokumenter (tidak ada satu pun yang menuntut redesign), jadi
`Reject` akan melebih-lebihkan. Namun gerbangnya keras: **jangan buka Tiket 01 sebelum 6 hard-stop di §4
ditutup**, karena salah satunya adalah **`main` sedang merah** dan yang lain adalah **jalan paling mungkin
menayangkan tamu ke jemaat secara tidak sengaja**.

**Skor Kesiapan Akhir: 6.5 / 10** (Round 1: 6 / 10)

| Dimensi | R1 | R2 | Alasan pergerakan |
|---|---|---|---|
| Disiplin arsitektur (AD/DEC) | 6 | **8** | B-3 tutup penuh: `DEC-088` ada, `AD-10`/`AD-29` diamandemen di spine, SDD ikut (`SDD-presenter.md:64,72,90`). Ini perbaikan paling nyata. |
| Kontrak state & sinkronisasi | 5 | **7** | B-4 tutup di level kontrak: `projection: ProjectedSource` resmi di `sync` + `currentState()`. Masih bolong di `guestSessionId` (B-15) dan re-akuisisi saat id berubah. |
| Model kegagalan | 3 | **5** | Taksonomi 3-tier jujur dan benar secara konsep. Tetapi watchdog-nya akan memberi positif-palsu, HDCP tetap tidak disebut, dan taksonomi error masih satu kode. |
| Kesehatan repo & test | 4 | **3** | **Regresi.** Tiga file test yang belum ada sudah didaftarkan ke `npm test` → `main` merah, CI gagal, dan rem satu-satunya di DEC-088 (`npm test` GREEN) rusak. Kunci JSON duplikat ikut masuk. |
| Ergonomi & keselamatan operator | 6 | **5** | **Regresi.** `Escape` capture-phase tanpa aturan tabrakan dialog, `G` tetap toggle tanpa guard target editable, `presentationLock` masih tak disebut. |
| Kesiapan deployment | 4 | **5** | Guard `!navigator.mediaDevices` masuk (persis yang diminta). Desktop/WebView2, port drift, dan batas topologi satu-laptop masih belum diputuskan. |
| Ketertiban method (traceability/sizing/risk) | 4 | **4** | Tidak bergerak. `size: S` padahal dua `AD` diamandemen; FR-16/FR-19 tetap dipaksakan — dan kini **terbalik** (§2 N-9). |

**Kalimat penutupnya:** Round 2 menutup *cacat arsitektur* yang saya angkat dan hampir tidak menutup
*cacat operasional* yang saya angkat. Padahal yang membahayakan ibadah hari Minggu adalah kelompok kedua.

---

## 1. Audit Penutupan 22 Temuan Round 1

Label: ✅ tutup · 🟡 sebagian · ❌ tidak disentuh · 🔴 regresi.

| ID R1 | Lv | Status | Bukti di Round 2 | Yang masih kurang |
|---|---|---|---|---|
| **B-1** `track.onended` bukan detektor signal loss | C | 🟡 | SPEC §1 "Lightweight Compositor Stalled Watchdog" (rVFC, >3 s) + §3 masalah #3 ditulis ulang dengan benar; SPEC §5.3 memisahkan HDMI-loss vs USB-unplug | Angka 3 s tanpa alasan (preseden `projector-liveness.ts:85-102` tidak dipakai); tidak ada gate `document.visibilityState`; tidak disebut elemen mana yang menjadi probe (rVFC **tidak menyala** pada elemen `display:none`); watchdog hanya aktif "while in `live`" padahal fase `ready` juga butuh |
| **B-2** "Room attached" tidak teramati | C | 🟡 | `projector-media-status` (`attached` \| `unavailable` + reason) di SPEC §3, Tiket 03 §3, dan amandemen `AD-29` | Gate `consumerCount >= 1` **tidak** diambil; state `live` tetap dinyalakan sebelum ada bukti ruang ter-attach; `attached` tidak dirender di konsol mana pun (konfirmasi positif tak teramati); purge registry berbasis poll `.closed` (`:1120-1129`) tidak ada → lihat B-16/N-4 |
| **B-3** Menabrak AD-29 tanpa `DEC-` | C | ✅ | `DEC-088` (`decisions.yaml:1872-1884`, `type: mandate`, `expires: 2026-10-11`), amandemen `AD-10` & `AD-29` di spine, baris SDD | Satu kewajiban eksplisit dari R1 belum masuk tiket: **`isProjectorMessage()` (`present-channel.ts:216-218`) harus diperbarui** bersama komentar kontraknya yang hari ini berkata "Every other variant … is presenter-authored state" → N-6 |
| **B-4** Reload/late-open proyektor kehilangan state | C | 🟡 | `projection` di `PresentMessage['sync']` **dan** `currentState()` (SPEC §2, Tiket 02 §2-3); amandemen AD-10 | Re-akuisisi consumer **saat `guestSessionId` berubah** masih tidak disebut — Tiket 03 §1 tetap "when `ProjectorClient` mounts". Revert→re-arm→switch tanpa remount = stream mati di layar jemaat |
| **B-5** HDCP → hitam yang lolos `canplay` | H | ❌ | — | Kata "HDCP" tidak muncul di satu berkas SPEC-101 pun (diverifikasi grep). Ini kegagalan paling memalukan dan paling mungkin: pembicara tamu memutar klip Netflix/YouTube Premium → badge "Ready" menyala, jemaat menonton hitam |
| **B-6** Scripture overlay vs guest video | H | ✅ | Keputusan eksklusivitas dua arah (SPEC §2; Tiket 02 §3; amandemen AD-10) | Titik penegakannya tidak disebut → harus di *choke point* broadcast, bukan di handler tombol, atau jalur remote (`presenter-remote-client.ts`) menembusnya → N-7. Biaya produknya (selama guest live, gereja **tidak bisa** menampilkan ayat) tidak dicatat sebagai keputusan |
| **B-7** `presentationLock`, `G` toggle, tabrakan `Escape`, guard tidak diwarisi | H | 🔴 | Tiket 02 §1 menambah `Escape` **capture-phase** | Capture-phase justru **memperbesar** tabrakan: handler kini menyala saat `gridOpen` (dialog jump grid, `:1134`) dan saat keluar fullscreen — dua arti `Escape` dalam satu tekanan. `G` tetap toggle ("reverts when in `live`"). Guard `INPUT`/`TEXTAREA`/`SELECT` (`:1141`) **tidak** direplikasi untuk `G`. `presentationLock` (`:488`, `:1884-1885`) masih tak disebut |
| **B-8** Label UI hardcoded English | H | ❌ | — | Tiket 02 menulis `"Arm Guest Feed"`, `"Switch to Guest Screen"`, `"Revert to Deck"`, `"Disarm"`, `"Signal Stalled"` sebagai literal. Tidak ada key `presenter.guestFeed.*` di `keys.ts` / `catalogue-en.ts` / `catalogue-id.ts`. **Tidak ada test yang menangkap ini** (`operator-i18n-guard.test.mjs` hanya memeriksa pola `useT`), jadi regresi locale ID akan lolos diam-diam |
| **B-9** Registrasi CI + bukti browser nyata | H | 🔴 | `smoke:spec-101` / `test:smoke-spec-101` ditambahkan; 3 file didaftarkan ke `npm test` | **Didaftarkan sebelum berkasnya ada** → `npm test` keluar 1 (diverifikasi: `node --test <path-hilang>` ⇒ exit 1; `npm run smoke:spec-101` ⇒ "Could not find"). `.github/workflows/test.yml:8-9,49` menjalankan `npm test` pada push ke `main` → **CI merah di `main` sejak `1960274f`**. Bagian browser-nyata (`tests/smoke-spec-101.test.mjs` di atas `tests/helpers/browser-harness.mjs:151-154` dengan `--use-fake-device-for-media-stream`) tetap tidak ada |
| **B-10** Absence guard belum injection-proof | H | ❌ | — | Tidak satu tiket pun mencantumkan 7 absensi + bukti inject→fail→revert yang diwajibkan `AGENTS.md` § Code. Yang paling penting justru tak terjaga: tidak ada `controls`, tidak ada `video.requestFullscreen()`, tidak ada video saat `stalePlan`, tidak ada auto-arm |
| **B-11** Secure context / desktop / LAN / port drift | H | 🟡 | Tiket 01 §1: `!window.isSecureContext \|\| !navigator.mediaDevices` → `INSECURE_CONTEXT` (persis yang diminta) | Keputusan **desktop mode (WebView2) in/out** tidak diambil; kata "WebView2"/"desktop" tidak ada di SPEC. Tanpa handler `PermissionRequested`/`NewWindowRequested`, bridge opener bisa mati total **dan gagal-tertutup berarti diam**. Port drift (`internal/desktop/port.go`) → origin berubah → permission prompt di tengah ibadah. Batas topologi "satu laptop memikul tiga peran" belum ditulis sebagai batas arsitektur |
| **B-12** Traceability / sizing / risk / corpus | M | ❌ | — | `specs.yaml:4244-4245` masih `fr: [FR-16, FR-19]`, `size: S`. `components.yaml:46-49` masih `risk_accepted: medium` dengan risk note "displays names and verses". `UC-12` (`critical: false`) alurnya murni slide+blank. Tidak ada scenario `SCN-*`, tidak ada `LC-*` untuk capture broker, SRS/PRD tidak diamandemen → N-9 |
| **B-13** Taksonomi error satu kode | M | ❌ | — | Hanya `INSECURE_CONTEXT`. `NotReadableError` (aplikasi lain memegang card — kegagalan lapangan paling sering), `NotAllowedError`, `NotFoundError` (Windows camera privacy), `OverconstrainedError` (`deviceId` basi setelah replug) tidak dipetakan. Tidak ada listener `devicechange`, tidak ada re-select berbasis **label** |
| **B-14** Premis Problem Statement #1 belum diverifikasi | M | ❌ | — | SPEC masih menegaskan eksklusivitas UVC antar-window Chrome sebagai fakta, masih tanpa verifikasi, dan masih tidak menyebut risiko eksklusivitas yang nyata (OBS/Zoom/Teams). Spike 1 hari (10 pengukuran) tidak masuk rencana — HIL §5 adalah acceptance, bukan spike pembentuk desain |
| **B-15** `guestSessionId` tak terdefinisi | — | ❌ | — | Masih tidak ada satu kalimat pun: siapa membuat, format, kapan baru, apa yang terjadi saat berubah. Lebih parah: Tiket 01 memakai registry `Set<MediaStream>` sehingga **id itu tidak menjadi kunci apa pun** → N-5 |
| **B-16** Auto-disarm saat unmount / pindah rute / `pagehide` | — | ❌ | — | `.disarm()` ada sebagai tombol; tidak ada kewajiban auto-disarm. Operator pindah ke Run Sheet (`:1884-1891`) saat armed → device tetap tergenggam, indikator "camera in use" menyala, arm berikutnya dari tab lain gagal |
| **B-17** Badge fps **terukur** | — | 🟡 | Prompt R2 menyebut "measured FPS badge" | SPEC §1 malah mengikat badge ke `track.getSettings()` ("Track Health & Real Settings") — itu angka **nominal hasil negosiasi**, bukan terukur. Kasus YUY2@1080p (~5 fps nyata) akan tampil sebagai "1080p 60fps - Ready". Dua dokumen, dua perilaku |
| **B-18** `muted` sebagai invarian autoplay + rejection `play()` | — | ❌ | — | Tiket 03 menulis `<video autoPlay playsInline muted />` tanpa jalur untuk `play()` yang menolak → layar hitam beku di depan jemaat. Harus dipetakan ke `reason: 'video-error'` + fallback deck |
| **B-19** Bekukan transisi saat live, DOM slide tetap mount | — | ❌ | — | Amandemen AD-10 justru berkata "pre-cueing the next slide in background memory" tanpa memutuskan apakah animasi transisi rAF (`use-slide-transition.ts`) berjalan di bawah video 1080p. Itu pembakaran GPU tepat di saat paling mahal |
| **B-20** Salah pilih device (webcam built-in) | — | ❌ | — | Tidak ada "no auto-select" guard, tidak ada memori **label** device terakhir (persisted-local legal menurut AD-24), tidak ada urutan daftar |
| **B-21** Privasi/consent layar tamu | — | ❌ | — | Tidak ada satu kalimat di UI ("Live = seluruh layar pembicara tampil ke jemaat") maupun di SRS. Notifikasi email/password tamu ikut ke proyektor |
| **B-22** Satu laptop tiga peran: minimum spec + power Windows | — | 🟡 | HIL §5 (5 langkah) + soak 120 menit | Tidak ada pengaturan power (jangan sleep/dim) untuk **laptop operator** — kalau laptop operator sleep, seluruh jalur mati; tidak ada minimum spec; tidak ada pengukuran (soak hanya "assert zero memory leaks", tanpa angka dan tanpa mekanisme yang membuatnya bisa gagal) |

**Ringkasan penutupan: 2 ✅ · 6 🟡 · 12 ❌ · 2 🔴.** Dari 4 temuan `[Critical]` Round 1: **1 tutup penuh**
(B-3), **3 tutup sebagian** (B-1, B-2, B-4). Tidak ada satu pun `[Critical]` yang tutup penuh selain B-3.

---

## 2. Temuan Baru — Diciptakan oleh Edit Round 2 Sendiri

Semua ini baru; tidak ada di Round 1 karena kodenya/dokumennya belum berubah.

### N-1 · `[Critical]` `main` merah: test didaftarkan sebelum berkasnya ada
`package.json:17` memuat `tests/capture-broker-device-enumeration.test.mjs`,
`tests/presenter-guest-feed-controls.test.mjs`, `tests/projector-guest-media-bridge.test.mjs`.
**Ketiganya tidak ada di working tree** (verifikasi: 208 path terdaftar, 3 hilang — persis tiga ini).
`node --test` pada path yang hilang keluar dengan kode 1, jadi `npm test` tidak bisa GREEN, dan
`.github/workflows/test.yml:8-9` memicu CI pada setiap push ke `main`.

Mengapa ini lebih dari sekadar kerapian: **DEC-088 menyebut `npm test` sebagai rem tunggal** ("coordinator
alone verifies the authoritative test suite (`npm test` …)"). Mandat autopilot dengan rem yang sudah merah
sebelum satu baris kode ditulis berarti "GREEN" tidak lagi membawa informasi apa pun — implementer akan
melihat merah, menyimpulkan itu warisan, dan terus jalan.
**Perbaikan:** keluarkan tiga path itu dari `test` sampai berkasnya benar-benar mendarat di tiket yang
sama (satu commit, bukan dua), atau daratkan berkas kerangka lebih dulu.

### N-2 · `[High]` Kunci JSON duplikat `smoke:spec-100`
`package.json:20` dan `:21` mendefinisikan `smoke:spec-100` dua kali (diverifikasi dengan parser
`object_pairs_hook`). Diperkenalkan oleh commit yang sama (`1960274f`). JSON mengizinkan duplikat dan
pembaca mengambil yang terakhir, jadi tidak ada yang meledak — itulah masalahnya: ini bukti `package.json`
sedang diedit dengan append manual tanpa validasi apa pun, pada berkas yang sama yang menjadi daftar
test otoritatif. Tambahkan guard (satu test yang mem-parse `package.json` dengan deteksi kunci duplikat
dan menegaskan setiap path di `scripts.test` ada) — dua kelas cacat N-1 dan N-2 tertutup oleh satu test.

### N-3 · `[Critical]` Mengganti anchor fallback dengan `window.open` membatalkan tujuan anchor itu
Tiket 03 §1 dan §"Replace `noreferrer` fallback link" memerintahkan: ganti `target="_blank"
rel="noreferrer"` dengan programmatic `window.open`. Fakta di kode: anchor itu **hanya dirender ketika
`projectorBlocked === true`** (`PresenterOperator.tsx:1895-1906`), dan flag itu diset **karena
`window.open` baru saja mengembalikan `null`** (`:739-747`, dengan komentar aslinya: *"`null` means the
popup blocker ate it — surface the plain link instead of leaving the operator clicking a button that does
nothing"*). Menyuruh fallback itu memanggil `window.open` lagi berarti menjalankan ulang satu-satunya hal
yang baru saja ditolak browser: **tombol darurat menjadi mati tepat pada situasi yang membutuhkannya.**

Perbaikan yang benar dan lebih kecil: pertahankan anchor (gestur user, tidak diblokir), buang
`rel="noreferrer"` (cukup `rel="opener"` atau tanpa `rel`), dan **beri `target={projectorWindowName(serviceId)}`**
(`:310-312`). Tanpa nama itu, tab fallback menjadi window **anonim** → named-window reuse tidak berlaku →
**dua proyektor hidup di satu channel**, dan yang satu (tanpa opener) selalu gagal-tertutup ke deck. Itu
skenario divergensi senyap Round 1 §2.2 butir 2, dan perubahan Round 2 tidak menutupnya.

Satu konsekuensi yang belum diputuskan siapa pun: di jalur blocked, layar jemaat adalah **tab**, bukan
window fullscreen di monitor kedua. Artinya guest video **tidak sampai ke ruang sama sekali**. Selagi
`projectorBlocked === true`, tombol "Switch to Guest Screen" harus **disabled** dengan satu kalimat
manusia, bukan enabled dan gagal-tertutup dalam diam.

### N-4 · `[High]` Kebocoran klon belum tertutup — `release()` lintas realm bukan mekanisme yang cukup
Kontrak Round 2 adalah callback `release()` yang **hidup di realm popup** dan dipanggil pada
unmount/`pagehide`. Popup yang ditutup paksa (tombol X, kill, crash, renderer beku) tidak menjalankan
apa pun, dan `relocateProjector` menutup window lama dari sisi operator (`:731-737`) tanpa jaminan
`pagehide` sempat berjalan. Registry `Set<MediaStream>` di broker tumbuh selamanya, dan — lebih buruk —
"consumer attached" menjadi positif-palsu permanen, yang merusak nilai telemetry B-2.

Dua mekanisme wajib, satu fakta (persis pola `projector-liveness.ts`: handle + heartbeat):
1. popup memanggil `release()` pada unmount/`pagehide` (sudah ada di tiket);
2. **broker menyapu registry sendiri** pada tick poll `.closed` yang **sudah ada** (`:1120-1129`): buang
   consumer yang semua video track-nya `readyState === 'ended'`, dan paksa **satu consumer proyektor
   aktif** — `acquireProjectorConsumer` yang baru **melepas yang lama**.

Invarian satu-consumer itu juga jawaban termurah untuk divergensi dua window (N-3) dan satu-satunya cara
membuat HIL §5.5 ("assert zero memory leaks") bisa **gagal**, bukan sekadar dimaksudkan.

### N-5 · `[High]` `projector-media-status` tanpa rekonsiliasi sesi = revert tak diinginkan saat relocate
Aturan Round 2: "upon receiving `unavailable`, the Operator Console authoritatively updates global state
back to `deck`" (SPEC §3, amandemen AD-29, Tiket 02 §3). Tidak ada satu kalimat pun yang menyuruh operator
**membandingkan `guestSessionId` pada pesan dengan sesi yang sedang live**, atau **menahan telemetry
selama jendela grace setelah operator sendiri memicu open/relocate**.

Skenario nyata: `relocateProjector` (`:756-758`) menutup window lama dan membuka yang baru **saat guest
sedang live**. Track di window lama mati → `video-error`/`onended` → pesan `unavailable` ter-post sesaat
sebelum window hancur → operator menerima, menyimpulkan gagal, dan **menarik jemaat kembali ke slide di
tengah khotbah**, padahal window baru sudah ter-attach. Id sesinya sama (relocate tidak meng-arm ulang),
jadi filter berdasarkan id saja tidak cukup — perlu grace window atau, lebih baik, **kroborasi dari broker**:
`unavailable` hanya dieksekusi bila `consumerCount === 0` setelah N ms. Itu desain B-2 Round 1, dan ia
**kebal** terhadap race ini karena broker tahu berapa consumer hidup yang ia punya.

Dua aturan turunan yang juga belum ditulis: (a) telemetry tanpa `guestSessionId` yang cocok = dibuang,
bukan ditafsir; (b) tidak ada debounce/cooldown untuk `video-error` → satu hiccup decoder memotong tamu
dari layar.

### N-6 · `[High]` `isProjectorMessage()` dan komentar kontraknya akan menjadi bohong
`present-channel.ts:216-218` mengembalikan true hanya untuk `request-sync` dan `projector-alive`, dengan
komentar yang mengikat: *"Every other variant on this channel is presenter-authored state …
`isProjectorMessage` is the one place that distinction is made, so it cannot drift from
`present-channel.ts`'s own account of who sends what"* (dan `PresenterOperator.tsx:1021-1032` mengulang
ikatan yang sama). Round 2 menambahkan varian **kedua** yang dikirim proyektor tanpa menyebut predikat itu
di tiket mana pun. Implementer punya dua pilihan dan keduanya salah tanpa arahan:
- tidak menambahkannya → komentar dan `AD-29`'s "hanya window proyektor" tak lagi cocok dengan kode;
- menambahkannya → `projector-media-status` menjadi bukti liveness, padahal amandemen spine berkata
  "Heartbeat liveness evaluation remains **decoupled** from media status".

Tiket 02 (pemilik `present-channel.ts`) harus menuliskan pilihannya secara eksplisit — rekomendasi saya:
**bukan** bukti liveness (ikuti amandemen), predikat tetap dua varian, dan komentar `present-channel.ts`
diperbarui di commit yang sama supaya berkas itu tidak mendokumentasikan kebohongan.

### N-7 · `[High]` Eksklusivitas scripture tanpa *choke point* → jalur remote menembusnya
`broadcast()` sudah men-null overlay lokal untuk setiap `sync` (`:785-787`), tapi arah sebaliknya
("push scripture ⇒ projection kembali ke deck") hanya disebut sebagai prosa di "PresenterOperator
Integration". Kalau ia dipasang di handler tombol, maka intent `scripture` dari **ponsel**
(`presenter-remote-client.ts:102-160`, FR-35/AD-37) melewatinya: di kawat ada `scripture` **dan**
`projection: guest`, proyektor merender overlay **di bawah** video (tak terlihat), dan konsol operator
percaya sebuah ayat sedang tampil. Divergensi senyap, persis kelas cacat yang Round 2 janjikan tertutup.
**Wajib:** aturannya hidup di satu fungsi broadcast/`setScriptureAndSync`, dan satu test menjalankannya
**lewat jalur remote**, bukan lewat klik tombol.

Tambahan yang belum disebut: `RemoteControlSessionState` (`:340-347`) membawa `index`/`blank` tetapi tidak
`projection` → operator di ponsel **tidak bisa tahu** ruang sedang menampilkan tamu dan **tidak punya
tombol revert**. Untuk fitur yang seluruh mitigasinya adalah "operator menekan panic", panic yang tidak
ada di tangan operator yang sedang memegang ponsel adalah celah, bukan detail.

### N-8 · `[High]` `stalePlan` membunuh video tamu, dan hint `z-40` menimpa wajah pembicara
Dua interaksi di `ProjectorClient.tsx` yang Round 1 sebut dan Round 2 tetap tidak sebut:
- **`:269` early return `stalePlan`** merender "Unable to continue." menggantikan **seluruh** permukaan
  ruang. `planIdentity` berubah saat ibadah itu kejadian nyata (Sync Artifact, edit registry, presenter
  reload dengan plan yang dibangun ulang) — dan video tamu **tidak bergantung pada plan sama sekali**.
  Aturan yang harus diputuskan dan ditulis: `stalePlan` ⇒ tidak ada video (fail-closed, aman, tapi
  memutus khotbah tamu), **atau** projection guest bertahan sementara deck menolak index. Belum
  diputuskan = dua implementer, dua perilaku.
- **`:345-347` hint F11 di `z-40`** (`showHint && !blank`) dirender **di atas** video `z-30`: banner
  chrome bilingual "Press F11 for full screen · Tekan F11 untuk layar penuh" muncul di atas wajah
  pembicara tamu selama 5 detik — pelanggaran `AD-24`, dan `showHint` justru menyala lagi **setelah
  reload**, yaitu persis saat guest sedang live. Wajib: suppress hint saat `projection.kind === 'guest'`.

### N-9 · `[High]` Tiket 03 mengklaim memuaskan FR-19 sambil membuat bukti FR-19 tak tercapai
`requirements-operator-turn.yaml:81-84`: FR-19 = *"Search and display an on-demand verse in Presenter"*,
buktinya *"The reference appears on the projector in the chosen translation"*. Aturan eksklusivitas
Round 2 membuat bukti itu **tidak dapat dicapai** selama guest live (push scripture ⇒ balik ke deck lebih
dulu). Itu mungkin memang keputusan produk yang benar — tetapi kalau begitu ia **mengubah FR-19**, dan
perubahan FR bukan isi tiket. `Satisfies: [UC-12, FR-16, FR-19]` pada Tiket 03 saat ini mengklaim
kepatuhan pada requirement yang implementasinya meniadakan requirement itu. Jalurnya: amandemen
SRS/UC-13 lewat `wdi-build to-spec`, atau cabut FR-19 dari tag dan catat eksklusivitas sebagai keputusan
produk (OQ/DEC) dengan biaya produknya ditulis.

### N-10 · `[Medium]` Klaim "validate.py GREEN" benar, dan advisory-nya menunjuk tepat ke berkas spec ini
Saya jalankan: `GREEN — no findings`. Tetapi bagian *Skipped* menyebut `review-trace` **stale** untuk
`.how/_platform/ARCHITECTURE-SPINE.md` (changed at `4c1e5ac`, reviewed at `e1558cc`) dan
`.how/presenter/SDD-presenter.md` (changed at `4c1e5ac`, reviewed at `bc6c694`) — yaitu **dua berkas yang
DEC-088 amandemen**. JadiGREEN-nya jujur, dan yang dikatakannya adalah: amandemen spine/SDD ini belum
punya jejak review yang tercatat. Untuk komponen `presenter` di `mode: deep`, jalankan review-trace
sebelum G5, jangan lewatkan sebagai advisory.

---

## 3. Jawaban atas 5 Pertanyaan Audit Round 2

### 3.1 Resolusi 3 cacat struktural utama

**(a) Taksonomi 3-tier — realistis? Sebagian, dan tier-2 nya rapuh.**
Pemisahan konsepnya benar dan merupakan perbaikan nyata dari asumsi `track.onended` Round 1:
*definitive pipeline error* → auto-fallback; *compositor stall* → badge; *upstream freeze/black/splash* →
manual panic. Itu pemetaan yang jujur terhadap apa yang bisa dan tidak bisa diamati browser.
Tiga keberatan:
1. **Tier-2 akan berbohong ke operator.** `requestVideoFrameCallback` terikat pada presentasi frame
   *dokumen itu*; dokumen yang tersembunyi/di-minimize tidak mempresentasikan frame → tidak ada callback →
   "Signal Stalled" palsu. Konsol operator **sangat mungkin** di-background selama ibadah. Tanpa gate
   `document.visibilityState === 'visible'` dan tanpa jendela toleransi beralasan (preseden repo sendiri:
   `projector-liveness.ts:85-102`), badge ini akan melatih operator mengabaikan peringatan — kegagalan yang
   justru didokumentasikan kode liveness repo ini. Angka 3 s muncul tanpa derivasi.
2. **Probe-nya belum ditentukan.** rVFC tidak menyala pada elemen `display:none`. Harus ditulis: probe
   adalah `<video>` preview operator yang **benar-benar ter-render**, atau pakai
   `getVideoPlaybackQuality().totalVideoFrames` yang tidak bergantung pada presentasi.
3. **Tier-3 menanggung terlalu banyak.** "Manual panic" hanya bekerja bila manusia sedang melihat. Itu
   menuntut preview yang cukup besar dan cukup dekat dengan tombol Switch — Tiket 02 masih berkata
   "Compact … thumbnail in the operator toolbar" (Round 1 §5.1 meminta ≥240 px dan bersebelahan). Dan
   karena deteksi pixel ditolak ("without expensive pixel inspection"), **HDCP lolos seluruhnya**: hitam
   pekat, `canplay` sukses, badge "Ready", jemaat menonton hitam. Minimal: nyatakan HDCP di luar scope
   dalam SPEC, dan jadikan "manusia memverifikasi preview sebelum Switch" sebuah langkah wajib di runbook.

**(b) Kontrak `projection` menutup desync 100%? Tidak — 80%, dan tiga celah sisanya bernama.**
Yang sudah benar: `projection` di `sync` **dan** `currentState()` (`:1007-1016`) menutup jalur reload,
late-open, dan renavigasi jalur `lost` (`:713-718`), dan karena `sync` membawa *state yang dimaksud*
bukan instruksi flip (`present-channel.ts:4-17`), navigasi slide saat live tidak bisa menggeser sumber
proyeksi. Itu bagian terbaik dari Round 2.
Yang masih terbuka:
1. **`guestSessionId` tak terdefinisi** (B-15) dan **tidak menjadi kunci apa pun** di broker
   (`Set<MediaStream>`), sehingga proyektor yang memegang id basi tetap dilayani dan tetap melaporkan
   `attached` untuk sesi yang sudah tidak ada. Definisikan: dibuat operator saat `arm`
   (`crypto.randomUUID()`), stabil melintasi live↔deck, baru pada setiap `arm`; broker **menolak** id yang
   tidak cocok (typed → `consumer-attach-failed`); proyektor **re-akuisisi saat id berubah**, bukan hanya
   saat mount.
2. **`stalePlan`** (N-8) — interaksi yang belum diputuskan; "100%" tidak bisa diklaim selama satu early
   return di `:269` bisa mengganti seluruh permukaan ruang termasuk video.
3. **Kematian window operator saat live.** Seluruh jalur media hidup di realm operator. Bila konsol
   reload/crash/ditutup: master track mati → klon berakhir → proyektor harus (i) melepas state `guest`
   miliknya sendiri dan merender deck, dan (ii) operator yang baru mount mem-broadcast `deck`
   (`:1070`) sehingga kedua sisi konvergen. Kedua langkah itu hari ini terjadi **kebetulan**, bukan
   karena aturan. Tulis sebagai aturan (Round 1 sudah meminta kalimat ini) — dan sadari bahwa
   `unavailable` yang dipancarkan proyektor saat itu **tidak didengar siapa pun**, jadi jangan gantungkan
   pemulihan padanya.
4. **Relocate** (`:756-758`) — lihat N-5: tanpa grace/kroborasi broker, perpindahan monitor di tengah
   khotbah bisa menjatuhkan ruang ke slide.

**(c) `projector-media-status` di AD-29 — aman dan tepat batas? Bentuknya ya, semantiknya belum.**
Bentuknya patut dipuji: satu varian, tipenya ketat, taxonomi reason tertutup, tanpa index/blank/
transition, dan otoritas kembali ke deck tetap di operator. Itu **tidak** membuat proyektor menjadi
secondary controller dalam arti AD-29 melarang (ia tidak mengirim *nilai* yang diadopsi presenter).
Tetapi ada dua hal yang harus diakui jujur:
1. **Ini tetap melampaui kalimat asli AD-29.** AD-29 mengikat: *"receiving one may move the liveness
   verdict and nothing else"* dan *"Exactly one acknowledgement variant exists"*. Round 2 menambah varian
   kedua **dan** membuat pesan itu memicu perubahan state global. Amandemen DEC-088 memang mengizinkannya
   secara prosedural (dan itu cara yang benar — B-3 tutup), tetapi teks amandemen sebaiknya menyatakan
   dengan eksplisit bahwa ia **menyempitkan** klausa "and nothing else", bukan sekadar "mengakui telemetry".
   Kalau tidak, pembaca berikutnya akan menyimpulkan AD-29 mengizinkan telemetri apa pun yang "tidak
   membawa state".
2. **Batasnya belum dijaga di kedua ujung.** Pengirim: tidak ada aturan yang mencegah **dua** window
   proyektor mengirim telemetry (N-3 membuat window kedua tetap mungkin). Penerima: tidak ada filter id
   sesi, tidak ada grace window, tidak ada debounce (N-5). Dengan tiga aturan kecil itu — *satu consumer
   aktif*, *id sesi harus cocok*, *`unavailable` hanya dieksekusi bila `consumerCount === 0` setelah N ms*
   — celah split-brain tertutup secara struktural, bukan berdasarkan keberuntungan urutan pesan.

### 3.2 Mitigasi celah detail

**(a) `Escape` capture-phase menjamin panic selalu menyala? Ya untuk `<select>`, dan justru merusak di
tempat lain.** Capture-phase memang menyelesaikan masalah focus `<select>` (guard lama di `:1141` adalah
penyebabnya). Tetapi `Escape` adalah kunci yang **sudah** dipakai untuk: menutup jump grid
(`gridOpen`, `:1134`), dismiss dialog Base UI/shadcn, dan keluar fullscreen (native browser). Handler
capture-phase **tidak mewarisi** guard mana pun, jadi satu tekanan `Escape` kini bisa menutup dialog
**dan** menjatuhkan guest feed ke deck sekaligus. Aturan yang harus ditulis: **precedence eksplisit** —
bila ada dialog/grid terbuka, `Escape` menutup dialog dan **tidak** menyentuh projection; bila tidak ada,
`Escape` = revert. Plus satu test: "`Escape` saat jump grid terbuka tidak mengubah `projection`".
Dan `G`: **replikasi guard `INPUT`/`TEXTAREA`/`SELECT` dan `gridOpen`**, atau huruf `g` yang diketik di
kolom pencarian/editor lirik/emergency canvas akan **menayangkan tamu ke jemaat**. Ini insiden
accidental-on-air paling mungkin di seluruh fitur, dan saat ini tidak dijaga satu kalimat pun. Terakhir:
jadikan `G` **one-shot** (hanya valid dari `ready`), revert satu arah lewat `Escape`/`Shift+G` — di bawah
panik orang menekan berulang, dan toggle berarti tekanan kedua menayangkan tamu kembali.

**(b) Mengganti `rel="noreferrer"` dengan `window.open` menutup celah opener? Tidak — ia menutup celah
dengan cara menciptakan celah lain.** Lihat N-3: anchor itu ada justru karena `window.open` sudah gagal.
Perbaikan minimal yang benar: `rel="opener"` + `target={projectorWindowName(serviceId)}` pada anchor yang
ada, dan disable Switch selama `projectorBlocked`.

**(c) Eksklusivitas scripture ↔ guest logis dan aman bagi jemaat? Logis ya, aman belum.**
Aman bagi jemaat dalam arti tidak pernah menampilkan dua hal bertumpuk — itu benar dan lebih baik daripada
 Round 1 (yang membiarkan overlay tersembunyi di bawah video). Dua catatan:
1. **Titik penegakan** harus satu choke point, atau jalur ponsel menembusnya (N-7).
2. **Biaya produknya belum diakui**: selama khotbah tamu, gereja kehilangan kemampuan menampilkan ayat —
   padahal "pembicara tamu mengutip ayat, operator menampilkannya" adalah salah satu momen paling sering
   dalam ibadah. Round 1 menawarkan opsi (ii): overlay di atas video pada z bernama (mis. `z-35`) dengan
   latarnya sendiri. Round 2 memilih opsi (i) secara implisit lewat prosa tiket. Pilihan itu sah, tetapi
   ia **mempersempit FR-19** (N-9) dan harus diputuskan di tempat yang benar (SRS/UC-13 atau sebuah
   `DEC-`), bukan di dalam tiket.

**(d) `acquireProjectorConsumer(guestSessionId): { stream, release }` kedap kebocoran? Tidak.**
Lihat N-4. Kontrak berbasis callback lintas realm tidak bisa kedap: pemanggilnya bisa mati tanpa
sempat memanggil. Yang membuat registry kedap adalah **kepemilikan di sisi broker** — sapu consumer yang
track-nya `ended` pada poll `.closed` yang sudah ada (`:1120-1129`), dan paksa satu consumer aktif dengan
semantik *replace*. Tanpa itu, HIL §5.5 ("assert zero memory leaks in consumer registry") adalah klaim
yang tidak punya mekanisme untuk gagal, yaitu jenis test yang paling berbahaya karena ia selalu lulus.

### 3.3 SOP audio fisik & latensi — cukup jelas sebagai panduan teknisi sound?

**Belum. Ia menyebut angka lalu berhenti.** Yang sudah benar dan layak dipertahankan: `audio: false` di
level API, kedua `<video>` `muted`, penegasan jalur analog 3.5mm/DI → mixer, peringatan Windows default
playback ke HDMI, dan larangan "Listen to this device".

Yang kurang, dan semuanya bisa dikerjakan teknisi:
1. **Tidak ada tindakan korektif untuk offset A/V.** Audio analog **mendahului** video 150–300 ms. Itu di
   luar batas toleransi lip-sync yang berlaku umum (ITU-R BT.1359: audio-lead terdeteksi sekitar +45 ms,
   tidak dapat diterima di atas ~+125 ms). SOP hari ini hanya berkata teknisi "must be aware". Wajib
   tambahkan: **set per-channel delay di mixer** (hampir semua digital desk, dan banyak DSP analog,
   mendukung 0–500 ms) sebesar offset terukur; atau nyatakan **video klip dengan audio lip-sync di luar
   scope jalur ini**.
2. **Angkanya belum diukur dan tidak ditandai `[ASSUMED]`.** "150–300 ms" adalah estimasi yang muncul di
   spesifikasi sebagai fakta. Method repo ini punya penandanya; pakai. Lalu ukur sekali (rekam clap/timecode
   dari laptop tamu, foto di layar proyektor dan di mixer) dan catat angka sebenarnya di folder spec.
3. **Endpoint UAC dari capture card** akan muncul di Windows Sound sebagai perangkat audio. Larangan
   "Listen to this device" sudah ada; yang belum: **jangan pernah memilih endpoint itu sebagai input
   mixer** — itu jalur howling yang sesungguhnya (Round 1 §1.3 butir 3, hilang di Round 2).
4. **Ground loop / hum**: 3.5mm unbalanced consumer-line ke input balanced adalah resep dengung 50 Hz di
   gedung gereja. Satu kalimat: pakai stereo isolator atau DI dengan ground lift.
5. **Speaker laptop tamu harus mati** (audio ganda + jalur feedback), dan mic podium yang menyala
   bersamaan dengan klip video akan menghasilkan offset yang jauh lebih mengganggu daripada 300 ms —
   karena suara manusia hidup (0 ms) berada di ruangan yang sama dengan wajah yang tertunda 300 ms.
6. Tidak ada **runbook Windows** sama sekali: camera privacy ("Let desktop apps access your camera"),
   aplikasi lain memegang capture card (`NotReadableError` dari OBS/Zoom/Teams — kegagalan lapangan paling
   sering), dan pengaturan power laptop operator agar tidak sleep/dim selama ibadah.

### 3.4 Kesiapan pengujian & CI — ada yang terlewat?

**Ya, dan yang terlewat adalah yang paling menentukan.**

- **CI merah (N-1)** dan **kunci duplikat (N-2)**: harus diperbaiki sebelum apa pun.
- **Tidak ada bukti browser nyata.** Empat klaim keselamatan fitur ini tidak bisa dibuktikan mock:
  readiness frame nyata, klon lintas window dengan opener nyata, fallback saat sinyal benar-benar hilang,
  dan blanking yang benar-benar menutupi video di layar nyata. Repo ini **sudah punya** semuanya:
  `tests/helpers/browser-harness.mjs:151-154` (Chromium asli) dan CI yang meng-install Chromium
  (`.github/workflows/test.yml:47`). Yang kurang hanya tiga flag launch
  (`--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`,
  `--use-file-for-fake-video-capture=<path>`) dan `page.waitForEvent('popup')` untuk opener asli.
  **Wajib:** `tests/smoke-spec-101.test.mjs` — arm → badge ready dari frame nyata; switch → popup
  menampilkan frame (assert `videoWidth > 0`, `readyState >= 2` **di popup**); `track.stop()` di master →
  popup jatuh ke deck dalam N ms; blank menutupi video; popup tanpa opener → deck + peringatan operator;
  revert terlukis < 250 ms (angka, bukan "instantly").
- **Absence guard belum injection-proof (B-10)**, padahal `AGENTS.md` mengikat dan seluruh fitur ini
  bersandar pada absensi: (1) tidak ada audio track, (2) tidak ada `MediaStream`/binary di
  `BroadcastChannel`, (3) tidak ada `localStorage` untuk kontrol stream, (4) tidak ada operator
  chrome/`controls`/label device di permukaan projected, (5) tidak ada `video.requestFullscreen()`
  (bila elemen video yang di-fullscreen, subtree blanking `z-50` berada **di luar** fullscreened element →
  `B` tidak menutupi apa pun → AD-24 rusak dalam diam; fullscreen hanya pada `documentElement`, seperti
  yang sudah dilakukan `ProjectorClient.tsx:85-86`), (6) tidak ada auto-arm saat mount, (7) tidak ada
  video saat `stalePlan`. Masing-masing butuh bukti inject→fail→revert tercatat di tiket.
- **Batas platform yang terlewat:** HDCP; fourcc YUY2 vs MJPG (1080p bisa jadi ~5 fps tanpa error);
  pergantian resolusi/aspect mid-stream (`resize` pada track/`<video>` — belum ada penanganan);
  replug capture card → **`deviceId` berubah** → `OverconstrainedError` (butuh re-select berbasis label +
  `devicechange`); WebView2/desktop mode belum diputuskan; `LISTEN_HOST=0.0.0.0` → `navigator.mediaDevices`
  **undefined** (bukan "ditolak"); port drift → origin berubah → permission & deviceId hilang.
- **Skenario regresi yang terlewat di test tiket:** index maju saat live mempertahankan `projection: guest`
  (dijanjikan amandemen AD-10, tidak ada di daftar test Tiket 02); dua tab Presenter armed bersamaan;
  `serviceId` berganti saat live (channel name berubah, popup lama masih di channel lama);
  blank → revert → un-blank (urutan z di tiga langkah); presenter unmount saat armed (auto-disarm,
  B-16); remote ponsel push scripture saat live (N-7); relocate saat live (N-5).
- **HIL §5 bagus sebagai bentuk, lemah sebagai gate.** Lima langkahnya benar (termasuk pemisahan
  HDMI-loss vs USB-unplug, dan reload/relocate). Yang kurang: **kolom hasil terukur** (fps nyata, resolusi
  nyata, latensi ms, suhu, dropped frames), **legibility teks 20–24 pt dari baris belakang** sebagai
  acceptance gate (dua hop wireless + kompresi 4:2:0 membuat tepi huruf berdarah — ini kriteria yang
  sebenarnya menentukan apakah fitur ini berguna untuk slide khotbah), dan **langkah HDCP**.
  Simpan sebagai `MANUAL-HARDWARE-VERIFICATION` di folder spec mengikuti preseden
  `tests/manual-live-smoke-verification.mjs`.
- **Spike 1 hari tetap tidak ada.** HIL adalah *acceptance* (menguji desain). Tiga pengukuran — fps nyata,
  latensi nyata, perilaku signal-loss pada card ini — **membentuk** desain, jadi ia harus terjadi sebelum
  Tiket 01, bukan di dalamnya.

### 3.5 Final clearance

**Belum CLEAR TO IMPLEMENT.** Yang sudah layak dibangun hari ini adalah **Tiket 01 versi operator-side**
(broker, enumerasi, guard secure-context, preview, health) *setelah* N-1, B-13, B-16, B-17, B-20 ditutup —
bagian itu bernilai, rendah risiko, tidak menyentuh AD-24, dan berguna dengan sendirinya (operator bisa
melihat apa yang akan ditayangkan tamu *sebelum* memindah sumber, dan tahu lebih dulu bila link wireless
mati). Yang belum layak adalah **permukaan ruang** (Tiket 03) selama N-3, N-4, N-5, N-8, B-5, B-10, B-18
terbuka, karena semuanya gagal dalam diam di depan jemaat.

Rekomendasi urutan yang saya pertahankan dari Round 1 dan tetap berlaku: **pecah menjadi 101-A
(operator-side) dan 101-B (room-facing)**, bangun 101-A lebih dulu, dan jadikan 101-B bersyarat pada hasil
spike. Kalau owner memilih tetap tiga tiket, terapkan hard-stop §4 lebih dulu dan naikkan `size` dari `S`
ke `M` — spec yang mengamandemen dua `AD` dan menambahkan pesan channel baru bukan `S` menurut aturan
registry sendiri.

**Skor: 6.5 / 10.**

---

## 4. Hard Stop — 6 item sebelum satu baris kode

| # | Item | Mendarat di |
|---|---|---|
| **H-1** | Perbaiki `main`: keluarkan 3 path test yang belum ada dari `npm test` (atau daratkan berkasnya di commit yang sama), hapus kunci duplikat `smoke:spec-100`, tambah guard "setiap path di `scripts.test` ada + tidak ada kunci JSON duplikat" | `package.json`, test guard baru |
| **H-2** | Aturan hotkey lengkap: `G` one-shot dari `ready` **dengan** guard `INPUT`/`TEXTAREA`/`SELECT`/`gridOpen`; `Escape` capture-phase **dengan** precedence dialog (dialog menang); Revert **tidak pernah** disabled — termasuk oleh `presentationLock` (`:488`, `:1884-1885`) dan saat state `lost`/`error` | Tiket 02 |
| **H-3** | Batalkan penggantian anchor fallback dengan `window.open`; ganti `rel="noreferrer"` → `rel="opener"` + `target={projectorWindowName(serviceId)}`; disable Switch selama `projectorBlocked`; satu kalimat UI mengapa | Tiket 03 (+ `PresenterOperator.tsx:1895-1906`) |
| **H-4** | Reaper consumer di sisi broker: sapu track `ended` pada poll `.closed` (`:1120-1129`) + invarian **satu consumer proyektor aktif** (acquire melepas yang lama) | Tiket 01 |
| **H-5** | Definisikan `guestSessionId` (dibuat saat `arm`, stabil live↔deck, baru per `arm`); broker menolak id tak cocok; proyektor re-akuisisi saat **id berubah**; operator membuang telemetry bersesi basi dan hanya mengeksekusi `unavailable` bila `consumerCount === 0` setelah N ms / grace window pasca-open-relocate | Tiket 01, 02, 03 |
| **H-6** | Empat aturan permukaan ruang: `stalePlan` ⇒ tanpa video (keputusannya ditulis); hint `z-40` di-suppress saat guest; **tidak pernah** `video.requestFullscreen()` dan **tidak pernah** ada atribut `controls`; `play()` rejection ⇒ `video-error` + fallback deck. Semua dengan absence guard injection-proof | Tiket 03 |

**Harus tutup sebelum tiket ditutup (`[High]`):** B-5 HDCP dalam scope statement · B-8 i18n key
`presenter.guestFeed.*` di tiga berkas · B-9 smoke browser-nyata · B-10 tujuh injection proof ·
B-11 keputusan desktop in/out + guard runtime · B-13 taksonomi 5 error + `devicechange` + re-select label ·
B-16 auto-disarm pada unmount/`pagehide`/pindah rute · B-17 badge fps **terukur** (rVFC `mediaTime` delta),
bukan `getSettings().frameRate` · N-6 `isProjectorMessage` + komentar kontrak · N-7 choke point
eksklusivitas + `projection` di `RemoteControlSessionState` · N-9 koreksi tag FR-19.

**Harus diputuskan dan dicatat (`[Medium]`):** B-12 traceability/`size`/`risk_accepted` (lewati
`wdi-build to-spec` + `wdi-init` intent `risk`) · B-14 verifikasi premis Problem Statement #1 di spike ·
B-19 freeze transisi saat live, DOM slide tetap mount (revert harus *cut*, bukan efek — prinsip yang sudah
ditulis kode blanking `:365-370`) · B-20 memori device terakhir (persisted-local **label**, legal AD-24;
tetap dilarang untuk kontrol stream) · B-21 satu kalimat consent/privasi · B-22 minimum spec + power
Windows · N-10 jalankan review-trace sebelum G5 · §3.3 butir 1-6 untuk SOP audio · satu kalimat jujur
tentang AD-1: **segmen khotbah tamu tidak punya offline guarantee di dalam produk** — PPTX tidak bisa
menampilkan laptop tamu, jadi jalur hardware (switcher 2×1 atau input kedua proyektor) tetap menjadi
jaring pengaman, apa pun hasil spec ini.

---

## 5. Catatan / Instruksi Terakhir bagi Tim Pelaksana

1. **Perbaiki `main` dulu (H-1).** Jangan mulai fitur di atas suite yang merah; rem autopilot DEC-088
   adalah `npm test`, dan rem yang sudah merah tidak mengerem apa pun.
2. **Jangan jalankan autopilot pada Tiket 03.** Permukaan ruang adalah bagian yang kegagalannya tidak
   terlihat oleh siapa pun di dalam produk (AD-24 melarang error di layar jemaat). Tiket 01 dan 02 boleh
   jalan setelah H-1/H-2/H-4/H-5; Tiket 03 tunggu H-3 dan H-6.
3. **Satu aturan emas untuk fitur ini:** *setiap kegagalan harus mendarat di mata operator, tidak pernah
   di mata jemaat, dan tidak pernah hanya di `console.warn`.* Uji setiap jalur kegagalan dengan pertanyaan:
   "apakah manusia di konsol **tahu** dalam ≤3 detik?" Untuk bridge, sumber kebenaran termurah adalah
   broker (`consumerCount`), bukan pesan yang bisa datang terlambat, ganda, atau dari window yang sedang
   mati.
4. **Tulis angka, bukan kata sifat.** "instantly restores", "zero memory leaks", "150–300 ms" tidak bisa
   gagal. Ganti dengan ambang: revert < 250 ms, registry kembali ke 0 consumer setelah close paksa,
   offset A/V terukur = X ms, fps terukur ≥ 24.
5. **Tandai asumsi.** `[ASSUMED]` untuk latensi, `[NEEDS CONFIRMATION]` untuk premis eksklusivitas UVC dan
   keputusan desktop mode. Spec yang tidak menandai asumsinya akan dibaca sebagai fakta oleh implementer
   berikutnya — itu persis cara B-1 (asumsi `onended`) lahir di Round 1.
6. **Jangan biarkan implementer memilih diam-diam.** Empat keputusan masih terbuka dan masing-masing punya
   dua jawaban yang masuk akal: `stalePlan` vs video (N-8), liveness atau bukan untuk
   `projector-media-status` (N-6), di mana eksklusivitas ditegakkan (N-7), dan measured vs nominal fps
   (B-17). Putuskan di dokumen, dengan alasan satu kalimat.
7. **Method:** saya tidak memanggil skill apa pun (AGENTS.md). Yang saya sarankan untuk owner:
   `wdi-question` untuk keputusan desktop-mode & `stalePlan`-vs-video (default `assumptions.md`),
   `wdi-decision` bila eksklusivitas scripture/guest akan mempersempit FR-19 (N-9), dan `wdi-build to-spec`
   untuk amandemen traceability/`size` (B-12). `wdi-init` intent `risk` untuk `risk_accepted` presenter —
   catatan risikonya hari ini berbunyi "displays names and verses", dan fitur ini menampilkan **wajah dan
   layar orang hidup** ke ruang.

---

## Appendix — Indeks Bukti (sitasi baru di Round 2)

| Klaim | Bukti |
|---|---|
| 3 file test terdaftar tapi tidak ada; `npm test` tak bisa GREEN | `package.json:17`; `node --test <hilang>` ⇒ exit 1; `npm run smoke:spec-101` ⇒ "Could not find" |
| CI jalan pada push ke `main` dan memanggil `npm test` | `.github/workflows/test.yml:8-9,49` |
| Kunci JSON duplikat `smoke:spec-100`, diperkenalkan `1960274f` | `package.json:20-21`; `git show 1960274f -- package.json` |
| Anchor fallback hanya muncul saat popup blocked; flag diset dari `window.open() === null` | `PresenterOperator.tsx:739-747`, `:1895-1906` (`rel="noreferrer"` di `:1902`) |
| Named-window reuse adalah backstop dua proyektor | `PresenterOperator.tsx:304-312` |
| Relocate menutup window lama dari sisi operator | `PresenterOperator.tsx:731-737`, `:756-758` |
| Poll `.closed` yang sudah ada (tempat reaper seharusnya menumpang) | `PresenterOperator.tsx:1120-1129` |
| Guard hotkey lama (`gridOpen`, `INPUT`/`TEXTAREA`/`SELECT`) | `PresenterOperator.tsx:1131-1165` (`:1134`, `:1141`) |
| `broadcast()` men-null overlay untuk setiap `sync` | `PresenterOperator.tsx:785-787` |
| Presenter mount terkunci; kontrol disabled saat locked | `PresenterOperator.tsx:488`, `:1884-1885` |
| `currentState()` hari ini (tempat `projection` harus masuk) | `PresenterOperator.tsx:1007-1016`, `:1030-1034`, `:1070` |
| `stalePlan` early return "Unable to continue." | `ProjectorClient.tsx:269` |
| Hint F11 di `z-40`, menyala lagi setelah reload | `ProjectorClient.tsx:345-347`, `:70` |
| Blanking `z-50` sebagai *cut* | `ProjectorClient.tsx:365-371` |
| Fullscreen hanya pada `documentElement` | `ProjectorClient.tsx:85-86` |
| Gate adopsi shared state fail-closed | `ProjectorClient.tsx:143-176`; `present-channel.ts:226-238` |
| `isProjectorMessage` + komentar "one place that distinction is made" | `present-channel.ts:216-218`; `PresenterOperator.tsx:1021-1032` |
| Heartbeat proyektor + alasan sizing vs throttling tab latar | `ProjectorClient.tsx:242-249`; `projector-liveness.ts:85-102` |
| State remote tidak membawa projection | `presenter-remote-client.ts:340-347`; intent scripture `:102-160` |
| Harness Chromium ada; flag fake-media belum | `tests/helpers/browser-harness.mjs:151-154` |
| FR-16 / FR-19 tidak menjanjikan sumber video eksternal | `requirements-operator-turn.yaml:69-72`, `:81-84` |
| UC-12 murni slide+blank, `critical: false`, satisfies FR-16 | `.what/presenter/04-usecases/UC-12-two-screen-presenter.md:1-30` |
| `presenter`: `mode: deep`, `risk_accepted: medium`, risk note "names and verses" | `components.yaml:44-49` |
| SPEC-101: `size: S`, `fr: [FR-16, FR-19]`, 3 tiket, tanpa AC | `specs.yaml:4240-4274` |
| DEC-088 mandate: `from_gate: G5`, `parked: [ad-n]`, `expires: 2026-10-11` | `decisions.yaml:1872-1884` |
| Baris SDD yang ditambahkan Round 2 | `SDD-presenter.md:64` (AD-10), `:72` (AD-29), `:90` (Guest media bridge) |
| `validate.py --generate --baseline` = GREEN, dengan advisory `review-trace` stale menunjuk spine & SDD | dijalankan di worktree ini, 2026-10-04 |
| HDCP / WebView2 / desktop / presentationLock / devicechange / consumerCount / `[ASSUMED]` **tidak muncul** di berkas SPEC-101 | grep atas `.scratch/SPEC-101-*/` (nol kecocokan) |

---

*Catatan hygiene: file ini berada di `.work/handover-reviews/` (scratch yang dikosongkan saat task tutup).
Tidak ada data jemaat, nama asli, atau informasi production host di dalamnya. Tidak ada kode yang diubah,
tidak ada skill yang dipanggil, dan tidak ada commit yang dibuat selama review ini — penyimpanan berkas
ini ke git saya serahkan kepada owner.*

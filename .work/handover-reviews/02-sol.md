# Review Handover: Sol — SPEC-101

**Tanggal:** 2026-10-04
**Penugasan reviewer:** Sol; host eksekusi sesi ini: Codex
**Target:** Guest Speaker HDMI Video Capture Input
**Status:** Review selesai; Accept with Changes; belum layak untuk implementasi sebagaimana tiket sekarang
**Skor kesiapan rancangan:** **4/10**

## Ringkasan Eksekutif & Verdict

**Verdict: Accept with Changes.** Capture UVC melalui browser merupakan pendekatan yang masuk akal untuk fitur opsional. Pemisahan media dari BroadcastChannel, operator sebagai pemilik capture, preview sebelum tayang, dan blank overlay adalah fondasi yang baik. Namun janji failover saat kehilangan HDMI belum ditopang mekanisme yang cukup; `onended` mendeteksi berakhirnya track, bukan seluruh kegagalan rantai HDMI.

Tiga masalah paling mendesak:

1. **Capture hidup tidak membuktikan HDMI pembicara sehat.** Capture card dapat terus menghasilkan video hitam, frame terakhir, atau layar “No Signal” ketika HDMI upstream hilang. Ini kemungkinan perilaku perangkat yang harus diuji, bukan fakta yang sudah dibuktikan pada perangkat gereja. `canplay` dan `getSettings()` juga tidak membuktikan konten pembicara benar atau frame rate aktual yang tersampaikan.
2. **Preview siap tidak membuktikan proyektor siap.** Tiket menayangkan video setelah broadcast intent, sebelum membuktikan video pada jendela proyektor sudah bermain. Broker siap tetapi opener putus, popup reload, atau playback gagal dapat menghasilkan layar hitam dengan UI operator tetap mengklaim live.
3. **Kontrak authority belum lengkap dan sebagian bertentangan dengan AD-29.** Perlu aturan snapshot/reload, session invalidation, fallback lokal, serta komunikasi error media yang diizinkan. Menambahkan media ACK yang membuat presenter mengganti state tanpa keputusan terlebih dahulu bertentangan dengan batas pesan balik dalam spine saat ini.

**Rekomendasi operasional:** pertahankan jalur HDMI langsung yang sudah terbukti untuk ibadah terdekat. Evaluasi switcher fisik sebagai jalur utama pergantian sumber; jangan menganggap switcher murah otomatis berpindah tanpa blank. Fitur browser dapat diteruskan sebagai jalur opsional setelah blocker rancangan ditutup dan kombinasi hardware nyata lulus uji. Dokumen ini merupakan review independen satu reviewer, bukan persetujuan gate atau pengganti kuorum lintas keluarga model.

### Batas dan dasar bukti

Review membaca master prompt, SPEC-101 dan ketiga tiket, lalu membandingkannya dengan implementasi sekarang di `PresenterOperator.tsx`, `ProjectorClient.tsx`, `present-channel.ts`, `display-target.ts`, `SlideView.tsx`, jalur desktop WebView2, serta AD-1/10/24/29. Lembar reviewer lain tidak dijadikan sumber.

Tidak ada capture card, wireless HDMI, atau projector fisik yang diuji pada sesi ini. Model capture card, driver/firmware, format UVC, latency, dan perilaku no-signal belum diketahui. Klaim kompatibilitas 100%, stabilitas dua jam, dan perpindahan tanpa satu frame hitam tidak dapat diberikan dari dokumen atau mock.

Routing WDI: tugas ini termasuk `review-gate` untuk rancangan kritikal/fondasi; perubahan desain inti berpadanan dengan `sdd-inti`/`spine`. Rekomendasi kapten rancangan: Sol bersama pemilik. Review formal memerlukan dua reviewer lintas keluarga sesuai §4, dengan satu dari DeepSeek Pro/GLM-5.3/Qwen Max bersama Composer, setelah keluarga penulis aktual diperiksa. Sesi ini hanya mengerjakan slot Sol yang ditugaskan pemilik; tidak mendispatch model atau menutup gate.

## Analisis Mendalam per 6 Pertanyaan

### 1. Keamanan & Kelayakan Teknis

#### getUserMedia di Windows/Chromium

**Realistis, tetapi tidak 100% aman atau kompatibel.** Windows memiliki driver UVC bawaan; Chromium memiliki jalur capture Windows dengan DirectShow dan Media Foundation. Itu mendukung kelayakan umum, bukan sertifikasi untuk setiap HDMI capture card. Sumber: [Microsoft UVC driver](https://learn.microsoft.com/en-us/windows-hardware/drivers/stream/usb-video-class-driver-overview), [Chromium video capture architecture](https://www.chromium.org/developers/design-documents/video-capture/).

Pernyataan SPEC bahwa perangkat Windows “almost universally locked exclusively by the first client or window” terlalu absolut. Satu broker tetap keputusan yang baik untuk mengurangi perebutan perangkat dan menyatukan ownership. Jangan menjadikan kegagalan pasti pada panggilan kedua sebagai dasar kompatibilitas: perilakunya bergantung pada browser, driver, perangkat, dan aplikasi lain. Uji OBS, Teams, Camera, tab presenter kedua, dan permission Windows secara terpisah.

`videoinput` mencakup webcam internal dan virtual camera; API ini bukan detektor HDMI. Sebelum permission, daftar perangkat juga dapat dibatasi. Label fallback saja belum menyelesaikan bootstrap pemilihan capture card. Tetapkan alur pemberian izin, enumerasi ulang, konfirmasi preview, dan `devicechange`; jangan langsung menayangkan default webcam bila pilihan capture tidak tersedia.

Tiket menargetkan browser, tetapi produk juga mempunyai host WebView2 (`internal/desktop/window_windows.go`). Validasi camera permission dan perilaku popup pada host itu, atau nyatakan dukungan pertama hanya untuk Chrome/Edge eksternal. Kamera merupakan jenis permission tersendiri pada [WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/winrt/microsoft_web_webview2_core/corewebview2permissionkind?view=webview2-winrt-1.0.2210.55). Tidak ditemukan validasi capture/popup bridge SPEC-101 dalam kode desktop yang diperiksa; ini celah bukti, bukan bukti host pasti gagal.

#### Crash, deadlock, dan leak selama ibadah

Risikonya ada, tetapi tidak ada bukti bahwa perangkat tertentu di sini akan crash atau deadlock. Browser API tidak memberi jaminan pemulihan driver/kernel/GPU. Fallback DOM hanya dapat bekerja bila jendela proyektor masih dapat menjalankan JavaScript dan menggambar.

Risiko aplikasi yang konkret: `Set<MediaStream>` menyimpan consumer yang sudah berhenti sampai Disarm; late result `getUserMedia` setelah cancel; callback session lama; listener/timer berulang; `srcObject` tersisa; dan remount React membuka capture lagi. Tetapkan release consumer idempotent yang menghapus registry dan membersihkan elemen, callback, serta timer. Menghentikan track saja tidak menghapus strong reference.

Raw YUY2 1920×1080×60×2 sekitar **249 MB/s atau 1,99 Gbit/s**, sebelum overhead. Ini perhitungan kapasitas, bukan pengukuran capture card. Bentuk port USB 3.0 tidak membuktikan perangkat benar-benar menegosiasikan SuperSpeed atau mengirim 1080p60. Mulai dengan profil kualitas yang lolos uji; `ideal: 60` tidak berarti 60 fps terjamin. Hindari sampling canvas penuh per frame untuk watchdog sederhana.

Soak test minimal dua jam perlu mencatat CPU/GPU, memori proses, dropped frames, consumer aktif, perpindahan sumber, dan kemampuan aplikasi lain memperoleh perangkat setelah Disarm. Pertumbuhan memori tanpa batas atau consumer yang bertambah setiap reload adalah gagal; batas numerik ditetapkan dari baseline mesin target.

#### Audio loop/howling

**`audio: false` menutup jalur capture audio yang diminta fitur ini; tidak menutup seluruh routing audio Windows/HDMI/PA.** Stream yang diberikan ke consumer harus berisi video saja, kedua elemen muted, tanpa Web Audio atau unmute path. HDMI receiver, Windows “Listen to this device”, aplikasi lain, atau mixer masih bisa mengalirkan audio di luar fitur.

Audio video khotbah juga akan hilang pada jalur browser ini bila tidak disediakan jalur PA tersendiri. Tentukan siapa menyalurkan audio, bagaimana mute/unmute dilakukan, dan apakah delay PA cocok dengan video yang melewati dua hop wireless dan capture. `audio: false` bukan sinkronisasi bibir atau sertifikat bebas feedback ruangan.

#### Secure context dan laptop non-host

`http://localhost`/loopback dapat dipercaya untuk secure context; HTTP ke IP LAN biasa tidak demikian. HTTPS perlu konfigurasi kepercayaan yang benar. Sumber: [W3C Secure Contexts](https://www.w3.org/TR/secure-contexts/).

Capture terjadi **di mesin yang menjalankan browser operator**, bukan di mesin Go server. Laptop operator non-host dapat capture card lokal lewat HTTPS, tetapi projector dengan opener bridge tetap harus berada pada perangkat dan konteks browser yang terhubung dengannya. HTTPS tidak membuat capture card pada server bisa diakses browser laptop lain, dan tidak membawa BroadcastChannel lintas perangkat.

Periksa `window.isSecureContext`, keberadaan `navigator.mediaDevices` dan metode yang dipakai, permission, serta origin presenter/projector. `localhost`, `127.0.0.1`, dan port berbeda bukan origin yang sama. Berikan pesan operator yang tepat sebelum Arm; jangan merekomendasikan flag penonaktif keamanan browser untuk ibadah.

### 2. Risiko Regresi terhadap Fitur yang Sudah Ada

#### SPEC-99: dual-monitor dan popup

`PresenterOperator.tsx:739` membuka proyektor dengan nama stabil dan konfigurasi display. Relokasi menutup popup lama lalu membuka yang baru (`:725`). Setiap relokasi harus me-release consumer lama dan menyiapkan consumer baru tanpa membunuh master.

Ada boundary nyata: tautan fallback saat popup diblokir di `PresenterOperator.tsx:1899` memakai `target="_blank"` dan `rel="noreferrer"`. `noreferrer` memutus opener menurut [HTML window opening rules](https://html.spec.whatwg.org/multipage/nav-history-apis.html#dom-open). Jalur fallback tetap berguna untuk deck, tetapi bridge guest tidak tersedia di jalur tersebut. UI perlu mengatakan “proyektor tersedia, guest bridge tidak tersedia”; jangan mengubah kebijakan opener seluruh aplikasi secara serampangan.

Keberadaan window handle dan heartbeat tidak membuktikan capture sedang ter-render atau gambar tiba pada proyektor fisik. Popup yang dipindahkan monitor, reload, dan fullscreen ditolak perlu diuji sebagai lifecycle media tersendiri.

#### SPEC-100: scripture continuation dan fallback

Projector sekarang memilih `ScriptureOverlayView` **atau** `SlideView` di layer incoming (`ProjectorClient.tsx:328`). Scripture bukan sekadar elemen overlay yang pasti berada di atas semua sumber. Penambahan guest layer z-30 akan menutupnya kecuali policy lain ditentukan.

Tetapkan satu pilihan eksplisit: selama guest live, scripture tetap disiapkan di belakang lalu kembali ketika Revert, atau scripture Push mengganti sumber. Jangan biarkan z-index menentukan kebijakan produk. Tentukan pula apakah panic kembali ke slide dasar atau ke komposisi deck+scripture yang terakhir dicue. Label “Revert to Deck” harus sesuai hasilnya.

#### Canvas dan stacking context

`SlideView.tsx` merender `ArtifactSlide` dari artifact slide; authoring Fabric.js tidak perlu dijadikan jalur decoding video. Tempatkan guest video sebagai sibling layer di projected viewport, pertahankan deck fallback mounted, dan hindari transform/container yang diwarisi editor. Jika deck di-unmount saat live, font, gambar, dan transition bisa belum siap ketika panic.

Blank z-50 harus menutup video dalam stacking context yang sama, tanpa animasi. Jangan fullscreen-kan elemen video secara terpisah: video di fullscreen top layer dapat meninggalkan sibling blank overlay. Pertahankan fullscreen document seperti jalur sekarang. Banner F11 yang sudah ada berada di z-40 (`ProjectorClient.tsx:346`), sehingga bisa muncul di atas guest z-30 pada reload awal; tentukan perlakuannya sesuai pengecualian UX yang sudah disahkan.

#### Navigasi saat guest live

Ini risiko regresi langsung. `setIndexAndSync` mengirim snapshot saat navigasi (`PresenterOperator.tsx:801`); `currentState` menjawab reload (`:1007`); ada pengirim sync lain untuk perubahan deck. Menambahkan dua optional field pada tipe saja belum membuat semua pengirim membawa state guest yang konsisten.

Jika field absen ditafsirkan sebagai deck pada setiap sync, ArrowRight akan mematikan guest. Jika selalu diabaikan, snapshot reload bisa mempertahankan session yang sudah tidak berlaku. Bedakan **full snapshot** dari pesan yang tidak mengubah sumber; snapshot lengkap memuat source/session dan semua state deck yang relevan. Audit seluruh pengirim, termasuk remote intent, scripture, patch, blank, pergantian plan, dan sync awal.

Fallback mesti kembali ke posisi **cue terbaru**, tetap menghormati blank, continuation, patch, background, dan transition yang berlaku. Media lifecycle tidak boleh menutup atau membuka ulang channel setiap pergantian sumber.

### 3. Ketepatan Rancangan Arsitektur

#### Broker + clone + opener

Pola ini pilihan V1 yang cukup ringan untuk dua window dalam browser lokal yang sama. Cloning track memberikan ownership consumer terpisah, tetapi semua clone tetap berbagi source; clone bukan salinan frame yang kebal terhadap kegagalan sumber. `stop()` juga tidak memancarkan `ended` pada track yang dihentikan aplikasi. Sumber: [Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/).

Konsekuensi desain: Disarm harus lebih dulu menetapkan deck, menginvalidasi session, dan memerintahkan teardown secara eksplisit; jangan menunggu `onended` dari track yang baru dihentikan. Consumer release tidak menghentikan master; master stop saja tidak menjamin semua clone sudah dilepas.

Singleton module berlaku per realm/window, bukan otomatis per browser atau laptop. Dua tab operator dapat menciptakan dua broker. Tetapkan scope satu operator capture owner dan respons tab kedua. Penguncian ownership bukan alasan membuat channel media baru di luar AD-10.

Bridge sebaiknya mengekspos API sempit bertipe: acquire/release dengan identitas service, plan, session, dan consumer. Jangan mengekspos operasi Arm/Disarm bebas kepada popup. Same-origin adalah trust boundary akses, bukan jaminan data API selalu benar; tangani opener null/closed, akses yang melempar, object hilang, versi tidak cocok, dan session stale.

#### Reload, opener hilang, dan recovery

**Fail-closed ke deck tepat**, dengan syarat deck fallback sudah siap dan blank tidak dilepas. Pada reload, mulai dengan surface aman, jalankan `request-sync`, validasi plan/session, acquire consumer baru, lalu tampilkan video setelah playback pada window itu siap. BroadcastChannel tidak menyimpan pesan untuk window yang belum terpasang.

Operator reload/route change meniadakan owner lama; jangan menerima guest intent session lama dari queue atau popup tersisa. Recovery memerlukan Arm/Take baru yang disengaja. Opener yang masih ada tetapi bernavigasi ke dokumen lain juga perlu invalidation. Setelah gangguan, jangan otomatis kembali guest live ketika sinyal pulih.

Bila proyektor dibuka tanpa opener, deck tetap berfungsi. Guest tidak boleh diklaim live oleh operator hanya karena intent terkirim. Tidak perlu menambahkan WebRTC/server relay untuk menutup boundary V1 ini; itu perlu scope dan review berbeda.

#### Konflik authority dengan AD-29

AD-29 sebenarnya berada di `.how/_platform/ARCHITECTURE-SPINE.md:255`. Ia menetapkan heartbeat state-free, tanpa sequence atau request/response pairing; penerimaan pesan projector hanya boleh mengubah verdict liveness. Implementasi memakai `projector-alive`, bukan protokol ping-pong seperti deskripsi prompt.

SPEC-101 meminta projector fallback kemudian operator menerima error dan menyelaraskan source. Jalur laporan itu tidak dijelaskan. Menambahkan `guest-ready`/`guest-failed` yang menyebabkan presenter mengadopsi source baru **tidak otomatis diizinkan** oleh AD-29. Session/revision media juga tidak boleh ditempel pada heartbeat untuk mengakali larangan.

Sebelum implementasi, pilih kontrak yang patuh pada keputusan sekarang dengan keterbatasannya dinyatakan, atau buka keputusan yang secara eksplisit mengizinkan observasi readiness/fault media sambil mempertahankan presenter sebagai satu authority. Jika menerima opsi kedua, jelaskan bagaimana laporan kondisi diverifikasi, session lama ditolak, dan heartbeat tetap independen. Review ini tidak mengubah AD atau membuat DEC.

#### Dua tahap readiness

Pisahkan kesiapan capture operator dari kesiapan rendering proyektor. Untuk peralihan yang cepat, calon consumer proyektor perlu disiapkan **sebelum Take**, bukan baru diperoleh setelah source menjadi guest. Elemen dapat tetap di belakang surface aman; validasi di browser nyata karena elemen tersembunyi dapat membatasi observasi compositor.

`loadeddata`/`canplay` berarti ketersediaan data/readiness media, bukan bukti frame sudah muncul di layar. `requestVideoFrameCallback` memberi observasi frame yang diserahkan ke compositor, bukan sensor HDMI atau bukti proyektor fisik menampilkan gambar. Sumber: [video frame callback specification](https://wicg.github.io/video-rvfc/). Handle `video.play()` success/rejection dan timeout consumer secara tersendiri; [Chrome autoplay](https://developer.chrome.com/blog/autoplay/) mengizinkan muted autoplay, tetapi pemasangan source tetap harus diuji.

### 4. Kelengkapan Test Case & Failure Modes

Daftar tiket mencakup dasar yang berguna: filtering device, insecure context, audio exclusion, timeout awal, clone isolation, disarm, transisi utama, opener missing, blank, dan ended fallback. **Belum cukup untuk klaim live-production reliable.** Terutama mock `onended` tidak mewakili seluruh jenis kehilangan HDMI.

| Skenario yang perlu ditambahkan | Oracle / hasil yang diharapkan | Tiket |
|---|---|---|
| Permission tidak dijawab; user cancel Arm lalu permission akhirnya disetujui | Hasil terlambat langsung dilepas; state/session tidak hidup kembali | 01/02 |
| Arm dua kali; Disarm saat arming; device/session diganti sebelum resolve | Satu operasi pemilik, hasil stale ditolak, tanpa leak | 01/02 |
| Webcam default, virtual camera, daftar dibatasi sebelum izin, ID berubah | Enumerasi ulang; pilihan dikonfirmasi; tidak ada Take otomatis | 01/02 |
| USB capture dicabut atau permission dicabut | Deck/blank tetap aman; session invalid; seluruh consumer dilepas | 01–03 |
| HDMI pembicara dicabut, sleep, TX/RX kehilangan listrik, wireless putus | Bedakan track ended, mute, frame macet, dan frame no-signal yang terus mengalir | 01–03 + hardware |
| Slide pembicara statis/hitam selama 10 menit | Tidak terjadi auto-fallback hanya karena pixel tidak berubah/hitam | 01 + hardware |
| UVC tetap live tetapi frame berhenti; mute sementara lalu pulih | Watchdog terukur; recovery tidak otomatis menayangkan guest | 01–03 |
| Projector `play()` gagal atau tidak memperoleh first frame | Guest layer tidak menutup fallback; operator tidak mengklaim live | 03 |
| Take → Panic sebelum acquire consumer selesai | Completion stale dibuang; layer guest tidak muncul kembali | 02/03 |
| Re-arm/device change saat live | Kebijakan deterministik: ditolak atau Revert dulu; tanpa session campur | 01/02 |
| Projector reload/ditutup/relokasi; opener reload atau bernavigasi | Release consumer idempotent, session invalid, safe reacquisition | 01–03 |
| Opener terputus akibat noreferrer/noopener/COOP; cross-origin; API bridge mismatch | Deck tetap tersedia; batas dukungan ditunjukkan hanya kepada operator | 02/03 |
| Presenter kedua, plan/service berubah, pesan stale/duplikat | Ownership jelas; session/plan admission menolak sumber yang salah | 01–03 |
| Navigasi/remote cue/patch/scripture/transition saat guest live | Source tetap guest sampai perintah sah; fallback memakai cue terbaru | 02/03 |
| Blank → signal loss → Revert → unblank | Tetap blank sampai unblank disengaja; tidak bocor satu frame guest | 02/03 |
| Resolusi/aspect/FPS berubah; USB hub lambat; EDID/HDCP | Letterbox benar, status diperbarui, unsupported input gagal aman | 01/03 + hardware |
| Tab operator tidak fokus; popup fullscreen; sleep/resume; tekanan GPU | Tidak salah mengklaim live; panic/fallback diukur pada kondisi ini | 01–03 + hardware |
| Dua jam playback, 100 siklus Take/Revert, 20 reload | Consumer/listener/timer bounded; perangkat bebas setelah Disarm | 01–03 + hardware |

**Batas deteksi yang tidak bisa diselesaikan mock:** rVFC/watchdog dapat mendeteksi tidak adanya frame baru, tetapi capture card yang menghasilkan ulang frame beku atau no-signal masih tampak sehat. Hash pixel dan detektor hitam berisiko mematikan slide pembicara yang memang statis/hitam. Tanpa telemetry hardware, jangan menjanjikan deteksi pasti seluruh kehilangan HDMI. Gunakan manual panic sebagai jalur wajib; bila auto-failover HDMI penuh wajib, pilih hardware dengan status input yang terverifikasi.

Rencana pengujian perlu tiga lapis:

1. **Unit perilaku:** state machine, stale completion, release registry, admission session/plan, ordering Disarm/Panic, dan mock `stop()` yang tidak memancarkan `ended`. Guard audio/media-in-channel perlu dibuktikan gagal melalui defect injection untuk setiap bentuk yang diklaim dicegah.
2. **Browser integration:** Chrome/Edge target dengan dua window sungguhan dan fake video device untuk source attachment, reload, focus, channel, playback, fullscreen document, serta occlusion visual blank. Assert CSS string saja tidak membuktikan stacking/top-layer benar. Fake device tidak membuktikan HDMI/driver.
3. **Hardware qualification:** mesin, port/hub, model capture card, firmware, Windows/browser, kedua pasangan wireless bersamaan, dan projector sebenarnya. Uji setidaknya 1080p30, mode lain yang diklaim didukung, perubahan aspect, no-signal, contention, audio routing, dan dua jam soak. Rekam pola sintetis; jangan menyimpan slide atau identitas jemaat di repo/.work.

Tetapkan SLO yang bisa diuji. Usulan awal untuk dikalibrasi pemilik: Panic-to-fallback compositor frame p95 ≤250 ms pada mesin supported; event `ended` sampai fallback ≤250 ms; no-frame stall sampai fallback ≤1 detik termasuk timeout deteksi. Ini **target usulan, bukan hasil pengukuran atau jaminan HDMI upstream**, dan blank disengaja tetap blank. Catat p95 dan worst case, bukan sekadar rata-rata. Crash seluruh browser atau putus HDMI-Out tidak termasuk recovery yang dapat dilakukan DOM.

### 5. Ketepatan Ergonomi & UI/UX Operator

Alur pilih → Arm → preview → Take → Revert → Disarm cukup aman bila sebagian besar persiapan selesai sebelum ibadah. Lima langkah preparasi tidak perlu dilakukan di saat pembicara mulai berbicara. Pisahkan setup yang jarang dari dua tindakan live yang besar dan berlabel jelas.

Perbaikan penting:

- Tampilkan **capture siap**, **bridge proyektor tersedia**, dan **sumber yang diminta** sebagai informasi berbeda. Klaim “LIVE di proyektor” membutuhkan kontrak observasi rendering yang sah dan tetap tidak membuktikan sinyal HDMI fisik sampai ruangan.
- Badge `getSettings()` adalah mode capture yang dinegosiasikan; jangan menyebutnya FPS terukur. Jika frame rate terukur ditampilkan, gunakan metrik terpisah dan nyatakan periode ukur. Capture 1080p juga tidak membuktikan laptop pembicara mengirim native 1080p.
- Take wajib eksplisit dan disabled ketika consumer proyektor belum siap/bridge tak tersedia. Jangan otomatis Take saat Arm berhasil atau sinyal pulih.
- Panic berupa perintah idempotent “Kembali ke slide”, tetap tersedia selama live, arming, recovery, dan error. Kirim intent deck tanpa menunggu `stop()`/cleanup, fetch, atau retry media. Disarm saat live juga harus kembali deck terlebih dahulu.
- Pertahankan Blank sebagai tindakan berbeda: Panic mengembalikan komposisi fallback; Blank menyembunyikan semuanya. Panic ketika blank tidak boleh unblank.
- Lindungi `G` dari key repeat, modifier, input, textarea, select, `contenteditable`, dan modal. Toggle `G` berisiko berpindah dua kali saat tombol tertahan; perintah eksplisit lebih mudah diuji. `Escape` bertabrakan dengan penutupan dialog serta browser fullscreen. Tetapkan prioritas, scope fokus, dan fallback tombol besar; jangan menjanjikan hotkey global lintas window/browser.
- Device picker dikunci ketika live, atau perubahan harus Revert dulu. Jangan membuat dropdown pilihan perangkat menjadi jalan pintas Take perangkat lain.
- Perlihatkan cue fallback yang akan muncul saat Panic. Navigasi di belakang guest perlu indikator “slide berikut yang disiapkan”, agar operator tidak mengira slide itu sedang dilihat jemaat.

Test dengan operator sukarelawan dan tugas terukur: menyiapkan guest, kembali slide saat sinyal hilang, blank/unblank, serta memulihkan projector tanpa mengambil sumber yang salah. Tekanan waktu dan fokus popup perlu disimulasikan, bukan hanya screenshot komponen.

### 6. Ketepatan Desain & Analisa Keseluruhan

| Pilihan | Kelebihan untuk skenario ini | Batas penting |
|---|---|---|
| Native browser capture | Preview dan kendali sumber terpadu; komposisi bisa dikelola aplikasi | Capture/driver/browser/GPU/opener ikut menjadi titik kegagalan; audio dan end-to-end latency perlu penanganan tersendiri |
| Switcher HDMI sederhana 2×1 | Pergantian sumber tidak memerlukan browser capture | Perubahan EDID/resolusi/HDCP dapat memaksa sink/wireless relock; blank saat switch mungkin terjadi; tanpa preview guest bawaan |
| Hardware switcher/scaler dengan switching yang sudah diuji | Dapat mempertahankan format output dan bypass kegagalan aplikasi | Biaya dan fitur bergantung perangkat; klaim seamless harus dibuktikan pada rangkaian nyata |

Ini perbandingan arsitektur, bukan rekomendasi membeli model tertentu. Tanpa data perangkat dan hasil uji, tidak ada dasar menjamin latency atau switch seamless untuk opsi hardware mana pun.

Topologi switcher di meja operator yang mempertahankan jalur proyektor:

```text
Laptop WorshipDeck HDMI-Out ───────────────────────► input A switcher
Laptop pembicara → TX2 ~~~ RX2 HDMI-Out ────────────► input B switcher
                                                     │
                                               switcher HDMI-Out
                                                     │
                                                TX1 ~~~ RX1 → proyektor
```

Pada input B, perintah Blank dari WorshipDeck tidak dapat menutupi gambar guest yang membypass aplikasinya. Switcher perlu tindakan black/mute sendiri atau operator kembali input A yang sudah blank. Jalur hardware ini juga tidak memberi scripture overlay di atas guest. Akui tradeoff tersebut; jangan menjual hardware sebagai pemenuhan otomatis AD-24 milik surface aplikasi.

Guest pada kedua pilihan tetap melewati Pair 2 lalu Pair 1; browser menambahkan capture/render di antaranya. Dua sistem wireless berdekatan menambah risiko interferensi yang perlu diuji bersama. Switcher menghilangkan ketergantungan pada browser untuk sumber guest, tetapi tidak menghilangkan kegagalan RF, EDID, sumber, atau proyekturnya.

**Keputusan yang direkomendasikan:** lanjutkan desain fitur browser sebagai jalur opt-in, dengan deck/offline PPTX dan jalur HDMI operasional yang telah diuji tetap tersedia. Untuk kebutuhan wajib tayang dalam ibadah terdekat, pilih alur hardware yang sudah rehearsal. Bila syaratnya “otomatis mendeteksi semua kehilangan HDMI dan selalu switch instan tanpa freeze”, **tolak klaim itu untuk rancangan UVC generik ini**.

AD-1 asli (`ARCHITECTURE-SPINE.md:62`) menjadikan **PPTX offline** jaminan Sabbath; DOM browser adalah staging convenience. Fallback dari guest ke DOM tidak menyelamatkan crash browser, laptop hang, atau HDMI-Out putus. Siapkan PPTX sebelum ibadah dan rehearsal perpindahan manual. Jangan mendeskripsikan DOM fallback sebagai pengganti jaminan tersebut.

## Daftar Celah / Blindspot yang Terlewatkan

| ID | Dampak | Celah utama | Bukti / alasan |
|---|---|---|---|
| SOL-01 | Blocking | HDMI loss disamakan dengan `ended`; no-signal frame belum dimodelkan | SPEC bagian readiness/lost; tiket 03 §3 hanya ended/error |
| SOL-02 | Blocking | Consumer proyektor belum pre-warm dan siap sebelum Take | Tiket 03 acquire ketika source sudah guest |
| SOL-03 | Blocking | Laporan fault/readiness yang mengubah presenter state belum memiliki izin AD-29 | SPEC fail-safe; spine :255–259 membatasi reverse message pada liveness |
| SOL-04 | Blocking | Full sync, absence semantics, session invalidation, dan late completion belum ditentukan | Tiket 02 optional fields; `setIndexAndSync` :801 dan `currentState` :1007 |
| SOL-05 | Blocking | Release registry dan cross-tab ownership belum jelas | Tiket 01 memiliki Set dan Disarm, tanpa kontrak consumer release/in-flight cancellation |
| SOL-06 | Blocking | Fallback composition/scripture/blank dan Panic budget belum operasional | Projector merender scripture/deck secara eksklusif; tiket hanya menguji happy-path source switch |
| SOL-07 | Blocking untuk klaim dukungan | Matriks platform/hardware dan batas promise belum disepakati | Generic UVC, browser/desktop host, HTTPS non-host, dan dua wireless belum qualified |
| SOL-08 | High | Fallback projector link memutus opener; liveness bisa tetap hidup | `PresenterOperator.tsx:1899–1902`, jalur deck-only yang sah |
| SOL-09 | High | Permission bootstrap dan identifikasi capture belum aman dari salah webcam | Filtering videoinput bukan klasifikasi HDMI |
| SOL-10 | High | 1080p60 badge, audio exclusion, serta signal health berpotensi overclaim | Mode UVC ≠ input HDMI/FPS aktual; jalur PA berada di luar browser |
| SOL-11 | High | Fullscreen video/top-layer dan banner F11 dapat mengalahkan layer yang diasumsikan | Fullscreen/stacking perlu behavioral browser test |
| SOL-12 | High | Panic key bergantung focus; G repeat dan Escape modal/fullscreen belum ditetapkan | Tiket 02 hanya menyebut hotkey triggers |

“Blocking” berarti kontrak ini perlu diselesaikan sebelum implementasi tiket produksi. Uji hardware penuh/soak merupakan gate sebelum fitur dipakai saat ibadah; sebelum kode produksi, cukup tetapkan matriksnya dan buktikan feasibility minimum pada perangkat target melalui spike yang terpisah dan diotorisasi.

## Rekomendasi Tindakan Nyata bagi Tim

1. **Tutup SOL-01 dan SOL-07 dengan bukti perangkat.** Inventarisasi model capture/format/USB, Windows/browser/host; coba permission → capture → preview → cloned stream di popup sebenarnya. Cabut HDMI dan USB secara terpisah, matikan TX/RX, dan jalankan kedua pair wireless bersama. Catat mana yang memancarkan ended, mute, stall, atau tetap mengirim no-signal.
2. **Putuskan SOL-03 sebelum menambahkan pesan balik.** Klarifikasi AD-29 dan media-observation authority bersama pemilik. Bila kontraknya bertentangan dengan AD, perubahan keputusan melalui alur `wdi-decision` perlu go-ahead; review ini tidak menginisiasikannya.
3. **Perbaiki kontrak SPEC/tiket lewat alur yang dimiliki repo.** `wdi-build` adalah alur yang cocok untuk penyesuaian spec/tiket dan membutuhkan go-ahead pemilik. Definisikan capture vs projection state, snapshot lengkap, consumer preparation, fallback composition, idempotent panic, stale-session refusal, dan release. Dokumen review ini tidak mengedit SPEC/tiket.
4. **Pastikan V1 mempunyai batas dukungan yang jujur.** Satu operator owner, satu konteks browser terhubung ke projector, secure context, video-only, no-opener deck-only, dan HDMI no-signal tidak diklaim selalu terdeteksi. Tolak auto-recover-to-live.
5. **Tambahkan acceptance behavior dari tabel failure modes.** Susun unit + browser integration + hardware qualification. Review test yang hanya membaca string source tidak dianggap bukti playback, occlusion, atau teardown runtime.
6. **Lakukan rehearsal sebelum enabling saat ibadah.** Uji dua jam pada rangkaian sebenarnya, latensi guest termasuk audio PA, Panic/Blank, popup recovery, dan failover manual ke jalur hardware/offline. Putuskan rollout opt-in berdasarkan hasil, bukan karena unit test mock hijau.

### Pemeriksaan yang dijalankan pada sesi review

Perintah:

```powershell
node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/public-repo-guard.test.mjs tests/present-channel.test.mjs tests/projector-liveness.test.mjs tests/display-target-resolver.test.mjs tests/scripture-continuation-presentation.test.mjs
```

Hasil: **48 test lulus; 1 test-file gagal dimuat**, total runner 49. `tests/projector-liveness.test.mjs` gagal dengan `ERR_MODULE_NOT_FOUND` untuk paket `typescript` yang belum tersedia di checkout ini. Public-repository guard, present-channel, display-target resolver, dan scripture continuation lulus. Ini baseline terbatas sebelum implementasi, **bukan** hasil test SPEC-101 atau full CI. Tidak ada dependency yang diinstal, kode yang dimutasi, atau perbaikan lingkungan yang dilakukan dalam review ini.

### Penutupan reviewer

**Yang dikerjakan:** Review independen SPEC-101 dan ketiga tiket diselesaikan pada lembar Sol, dengan enam pilar analisis, 12 temuan, blocker, dan usulan pengujian.
**Hambatan / ketidakpastian:** Hardware belum diuji; keluarga penulis aktual belum diketahui untuk validasi kuorum formal. Test liveness belum dapat dimuat karena dependency `typescript` tidak tersedia.
**Berikutnya:** Pemilik menyelaraskan review para model, memutuskan kontrak AD-29 dan batas dukungan, lalu mengotorisasi penyesuaian spec/tiket sebelum implementasi.

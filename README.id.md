# WorshipDeck

> Aplikasi penampil dan staging ibadah gereja mandiri (*local-first church presentation and staging suite*) yang mengubah susunan acara ibadah menjadi slide presentasi siap pakai: menghasilkan file PowerPoint (.pptx) dengan font tertanam untuk kebutuhan luring (*offline*), konsol presenter dua layar untuk layar jemaat, dan remote smartphone Wi-Fi lokal.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.id/worship-deck) | [Unduh untuk Windows](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

> **Pemberitahuan terjemahan:** Berkas ini merupakan terjemahan dari [README.md](README.md) untuk kenyamanan pembaca. Jika terdapat perbedaan makna atau penafsiran, berkas resmi berbahasa Inggris (`README.md`) yang menjadi acuan otoritatif. Seluruh dokumen teknis mendalam dan dokumen hukum dikelola dalam Bahasa Inggris.

Dibangun untuk jemaat liturgis dan Masehi Advent Hari Ketujuh, tetapi tata letak slide disimpan sebagai data terkelola (bukan kode), sehingga jemaat dengan tata ibadah serupa dapat langsung menyesuaikannya lewat peramban.

## Masalah yang Dipecahkan

Menyiapkan slide kebaktian secara manual membutuhkan waktu 2 hingga 4 jam setiap pekan, sebagian besar dihabiskan untuk mengetik ulang lirik lagu yang sebenarnya sudah pernah diketik. Perubahan lagu secara mendadak di hari ibadah memaksa pembuatan ulang slide dari awal. Selain itu, keterampilan teknis penyiapan slide sering kali hanya dikuasai oleh satu relawan.

Aplikasi ini menerima susunan acara yang ditulis oleh pengatur kebaktian dalam pesan chat atau formulir dan otomatis merangkai slide ibadah yang rapi dan konsisten.

```text
teks susunan acara  ->  kebaktian terurai  ->  rencana slide  ->  +->  file PowerPoint (luring)
                                                                  +->  slideshow layar penuh
                                                                  +->  konsol presenter + layar jemaat
```

Lirik lagu diambil dari korpus database lokal berdasarkan nomor lagu. Tata letak slide dikelola melalui registri SQLite yang dapat disunting langsung di peramban. Begitu file PowerPoint diunduh, penayangan ibadah tidak membutuhkan koneksi internet sama sekali, hal yang krusial agar kebaktian tetap berjalan lancar saat jaringan gereja bermasalah.

## Fitur Utama

- **Penerimaan Susunan Acara:** Tempel teks ke formulir web. Baris teks yang tidak dikenali akan ditampilkan secara transparan, tidak pernah dibuang diam-diam. (Fitur webhook intake akan hadir pada rilis mendatang.)
- **Pencarian dan Pemecahan Bait Lagu Otomatis:** Lagu yang dirujuk berdasarkan nomor otomatis dipecah menjadi slide judul, bait, dan refrein berulang yang nyaman dibaca jemaat.
- **Tata Letak Slide yang Dapat Disunting:** Kelola tata letak slide di registri SQLite dengan editor canvas peramban. Pindahkan dan ubah ukuran elemen, atur teks dan gaya, tambahkan kotak teks atau bentuk baru, atau impor tata letak dari presentasi PowerPoint. Kumpulan 38 contoh tata letak opsional tersedia melalui demo seed untuk eksplorasi.
- **Satu Tata Letak untuk Semua Output:** Satu struktur slide terhidrasi menggerakkan file PowerPoint, tayangan slideshow web, layar jemaat, dan pratinjau langsung dalam format lebar 16:9 bawaan. Tanpa kode tata letak per format.
- **Mode Presenter Dua Layar:** Layar kontrol operator dilengkapi pratinjau slide aktif dan berikutnya, filmstrip miniatur, daftar urutan slide, kisi lompat ke slide mana pun, lembar susunan acara, dan jendela layar jemaat mandiri yang dapat ditarik ke layar kedua.
- **Tombol Layar Hitam (Blank Screen):** Gelapkan tampilan layar jemaat seketika dan pulihkan kembali tanpa kehilangan posisi slide (`B`).
- **Pilihan Efek Transisi:** Dukungan transisi none, cut, fade, dissolve, atau push, diterapkan identik pada tayangan web maupun file PowerPoint.
- **Pencarian Ayat Alkitab Cepat:** Tampilkan perikop Alkitab (KJV) ke layar jemaat di tengah ibadah secara cepat dan bersihkan kembali setelah selesai dibaca.
- **Warta dan Flyer Pengumuman:** Daftar flyer terkelola dengan gambar yang diunggah langsung atau diambil dari URL yang diizinkan.
- **Tipografi Kustom:** 41 keluarga font lokal yang dibundel luring, serta dukungan impor berkas font kustom dengan pengelompokan varian otomatis dan enkapsulasi ECMA-376 PowerPoint.
- **Manajemen Akun dan Sesi:** Akun admin dan operator terpisah, pembatasan laju login, serta token sesi kriptografis yang dapat dicabut seketika.
- **Tata Letak Formulir dan Parsing Dinamis:** Konfigurasi Predefined Fields dengan aturan regex ekstraksi kustom dan susun pengelompokan formulir Layanan langsung dari panel admin, tanpa perlu mengubah kode.
- **Pustaka Media (Media Library):** Kumpulan gambar latar dan flyer yang dapat dipakai ulang lintas tata letak, terpisah dari tata letak mana pun.
- **Sinkronisasi Manual Antar-Perangkat (Eksperimental):** Kirim dan tarik data Layanan, entri Song Set, latar belakang, dan pengumuman antara dua instance WorshipDeck di jaringan lokal yang sama, atas permintaan operator. Tanpa cloud, tanpa sinkronisasi latar belakang otomatis. Teruji pada satu host; sinkronisasi lintas mesin masih bersifat eksperimental.

## Persyaratan Sistem

- **Pemasangan Server (Direkomendasikan):** Linux (diuji pada Ubuntu), Windows 10/11, atau host POSIX dengan Go 1.24+ dan Node.js 22.12+. Dibangun dengan React 19. Database menggunakan SQLite internal bawaan; tidak memerlukan server database eksternal.
- **Aplikasi Desktop Windows (Eksperimental):** Windows 10/11 64-bit.
- **macOS:** Belum diuji secara resmi.

## Panduan Instalasi

### Pemasangan Server Mandiri (Direkomendasikan)

Menjalankan WorshipDeck sebagai server lokal mandiri merupakan model penerapan utama yang direkomendasikan:

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck
npm install
npm run setup
npm run dev
```

`npm run setup` akan menghasilkan berkas `.env` dengan kredensial baru, menginisiasi database SQLite, dan menampilkan kata sandi akun `admin` yang dibuat otomatis. `npm run dev` menjalankan server Go API pada <http://localhost:3000> dan frontend React SPA pada <http://localhost:5173> (Vite meneruskan `/api` ke Go). Masuk sebagai `admin` pada SPA. Untuk penyajian produksi satu asal (*single origin*), jalankan `npm run spa:build && npm start` lalu buka port 3000. Menjalankan ulang setup aman dilakukan: konfigurasi `.env` dan data yang sudah ada tidak akan ditimpa.

Baca [`.constitution/project/private-data.md`](.constitution/project/private-data.md) sebelum memasukkan data jemaat Anda.

### Pemasangan Installer Windows (Eksperimental)

Unduh `WorshipDeck-0.1.0-x64-setup.exe` dan `SHA256SUMS` dari [Halaman Rilis Resmi](https://github.com/wiradeltaid/worship-deck/releases) dan jalankan wizard instalasi.

Verifikasi berkas sebelum dijalankan: bandingkan hash SHA-256 yang dihitung dengan catatan di `SHA256SUMS`.

> **Catatan Windows SmartScreen:** Karena rilis biner ini belum ditandatangani sertifikat EV komersial, Windows SmartScreen mungkin menampilkan peringatan ("Windows protected your PC"). Klik **More info** lalu pilih **Run anyway** untuk melanjutkan.

### Membuat Kebaktian Baru

Buka **Services -> New**. Tempel susunan acara ke kotak teks. Format yang diharapkan adalah sebagai berikut:

```text
SABBATH, MARCH 14, 2026

BIBLE TALK (09.30-10.50 / 80 min)
>> welcome remarks: Mrs. Lestari
Song Leader : Ms. Ayu
[  ] Opening song : SDAH #159 The Old Rugged Cross
Memory Verse & Opening Prayer : Mr. Bagas
Closing Prayer : Mr. Damar (1m)

DIVINE SERVICE (10.50-12.05 / 75 min)
Song Leader : Ms. Kirana
[  ] Opening Song : SDAH #83 O Worship the King
Intercessory Prayer: Mr. Farid (5m)
Sermon : Pr. Andi Hartono "Working Out" (45m)
[  ] Closing Song : SDAH #249 Praise Him! Praise Him!
```

Klik tombol **Baca susunan acara** (atau **Parse** dalam bahasa Inggris). Informasi peran, perkiraan durasi, dan nomor lagu akan dipilah otomatis ke dalam formulir; lirik lagu otomatis ditarik dari database lokal. Teks yang tidak dikenali parser akan ditampilkan transparan, tidak pernah dibuang diam-diam.

Unggah flyer khotbah dan foto keluarga atau kegiatan pemuda jika ada, lalu simpan kebaktian.

### Mengoperasikan Presentasi

Dari halaman kebaktian:

- **Download PPTX:** File presentasi PowerPoint luring. File ini yang menjamin kebaktian tetap berjalan saat laptop, internet, atau server bermasalah.
- **Present:** Konsol presenter untuk operator. Dilengkapi pratinjau slide aktif dan berikutnya, miniatur filmstrip, daftar urutan slide, dan menu **All slides** untuk melompat ke slide mana pun seketika.
- **Open congregation screen:** Jendela terpisah tanpa kontrol untuk ditarik ke layar kedua atau layar jemaat. Tombol panah menggerakkan kedua layar serempak. Tombol `B` menggelapkan layar jemaat dan memulihkannya kembali tanpa memindahkan posisi slide.

### Fitur Tambahan

**Pencarian Ayat Alkitab:** Mode presenter dapat menampilkan perikop Alkitab (KJV) langsung ke layar jemaat. Korpus teks tersedia di `data/en/bible-translation/kjv.json` dan otomatis diverifikasi setiap kali aplikasi dinyalakan.

**Penerimaan Susunan Acara via Bot Chat:** Endpoint webhook intake akan hadir pada rilis mendatang.

### Penyelesaian Masalah (Troubleshooting)

**`Missing song book corpus`:** Berkas `data/song-book/sdah.json` hilang. Berkas ini disertakan dalam repositori, pulihkan via git: `git checkout -- data/song-book/sdah.json` lalu jalankan `npm run corpus:verify`.

**Lupa kata sandi admin:** Jalankan `npm run auth:set-password -- admin` untuk menyetel kata sandi baru dari prompt interaktif. Jalankan `npm run auth:unlock -- --list` untuk memeriksa dan membuka blokir laju login.

**Gambar slide tidak muncul:** Gambar dari URL eksternal harus mematuhi aturan keamanan URL. Mengunggah gambar langsung ke penyimpanan lokal aplikasi selalu berhasil.

## Penyesuaian untuk Jemaat Anda

Pemasangan standar dimulai dengan registri slide yang bersih untuk desain Anda sendiri:

1. **Tata letak slide:** Masuk sebagai administrator dan buka `/admin/artifacts`. Tata letak dapat dibuat di editor canvas atau diimpor dari PowerPoint. Kumpulan 38 contoh tata letak opsional dapat disemai dengan `npm run seed:demo`.
2. **Penyimpanan lokal:** Jika Anda ingin menjaga registri jemaat Anda di luar git, letakkan berkas di `data/local/default-registry.json` dan aplikasi akan membacanya secara otomatis. Jalur ini sudah diabaikan oleh git (`.gitignore`). Lihat [`.constitution/project/private-data.md`](.constitution/project/private-data.md).

## Korpus Bawaan

Dua korpus teks terverifikasi disertakan secara bawaan:

| Berkas | Isi | Saat Aplikasi Dijalankan |
| --- | --- | --- |
| `data/song-book/sdah.json` | 695 lagu Seventh-day Adventist Hymnal | judul dan bait lagu dibaca langsung dari berkas |
| `data/en/bible-translation/kjv.json` | 66 kitab, 1.189 pasal, 31.102 ayat Alkitab KJV | disinkronkan dari berkas lokal (~130 hingga 150 ms) |

Jalankan `npm run corpus:verify` untuk memverifikasi keutuhan korpus. Berkas ini adalah sumber rekaman; pulihkan dari kontrol versi jika dibutuhkan.

Baca [ATTRIBUTIONS.md](ATTRIBUTIONS.md). Berkas ini mencantumkan pemegang hak cipta, tujuan ibadah jemaat non-komersial, dan kontak penghapusan materi. Setiap korpus juga menyertakan lisensinya di dalam berkas.

Jika Anda menyesuaikan aplikasi untuk buku lagu lain, tambahkan korpus di `data/song-book/<book-code>.json` dengan struktur serupa. Lagu diindeks berdasarkan `(book_code, number)`.

## Penerapan (Deployment)

Build API Go dan SPA, lalu jalankan `./api` (atau `npm start`) di host dengan Node 22 di `PATH` untuk PPTX worker. Lihat [`.constitution/project/deployment.md`](.constitution/project/deployment.md). SQLite, gambar yang diunggah, dan cache deck semuanya membutuhkan jalur host yang persisten.

## Riwayat Proyek dan Privasi

Proyek ini bermula dari repositori privat satu jemaat lokal. Riwayat tersebut tidak dibawa ke repositori publik ini karena memuat nama asli jemaat, foto anak di bawah umur, tangkapan layar percakapan privat, dan QR code donasi rekening asli. Repositori publik ini dimulai dari komit awal yang bersih menggunakan data jemaat contoh sintetis (*Harborlight Adventist Fellowship*). Struktur sistem dijelaskan pada `.what/` dan `.how/` (DEC-001).

Kontributor diwajibkan membaca [`.constitution/project/private-data.md`](.constitution/project/private-data.md) sebelum melakukan komit. Terdapat pengujian otomatis (`tests/public-repo-guard.test.mjs`) yang akan menggagalkan build jika data jemaat riil terdeteksi masuk ke git.

## Lisensi dan Atribusi

- **Lisensi Kode:** Didistribusikan di bawah [Lisensi MIT](LICENSE).
- **Atribusi dan Korpus Himne:** Buku lagu gereja, terjemahan Alkitab, dan lisensi komponen pihak ketiga dicatat lengkap di [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
- **Pemberitahuan Font Pihak Ketiga:** Rincian hak cipta dan lisensi lengkap SIL OFL 1.1 serta Apache 2.0 untuk 41 keluarga font disediakan di [THIRD-PARTY-NOTICES](THIRD-PARTY-NOTICES).
- **Privasi dan Keamanan:** 100% offline-first. Data jemaat tetap sepenuhnya di mesin lokal Anda; nol telemetri, nol analitik (lihat [PRIVACY.md](PRIVACY.md) dan [SECURITY.md](SECURITY.md)).
- **Nama dan Ikon:** Lisensi MIT memberikan hak atas kode sumber aplikasi. Lisensi ini tidak memberikan hak merek dagang atas nama atau logo: hak atas nama **WorshipDeck**, **Wira Delta Indonesia**, dan logo produk tetap merupakan hak milik eksklusif PT Wira Delta Indonesia.

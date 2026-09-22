# WorshipDeck

> Aplikasi penampil dan staging ibadah gereja mandiri (*local-first church presentation & staging suite*) yang mengubah susunan acara (*rundown*) ibadah menjadi slide presentasi siap pakai — menghasilkan file PowerPoint (.pptx) untuk kebutuhan luring (*offline*), konsol presenter dua layar untuk proyektor jemaat, dan remote smartphone Wi-Fi lokal.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.id/worship-deck) | [Unduh untuk Windows](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

> **Pemberitahuan terjemahan:** Berkas ini merupakan terjemahan dari [README.md](README.md) untuk kenyamanan pembaca. Jika terdapat perbedaan makna atau penafsiran, berkas resmi berbahasa Inggris (`README.md`) yang menjadi acuan otoritatif. Seluruh dokumen teknis mendalam dan dokumen hukum dikelola dalam Bahasa Inggris.

Dibangun dengan arsitektur lokal (*local-first*); template slide disimpan sebagai data terkelola (bukan kode), sehingga jemaat dengan tata ibadah serupa dapat langsung menyesuaikannya lewat peramban.

## Masalah yang Dipecahkan

Menyiapkan slide kebaktian secara manual membutuhkan waktu 2–4 jam setiap pekan, sebagian besar dihabiskan untuk mengetik ulang lirik lagu yang sebenarnya sudah pernah diketik. Perubahan lagu secara mendadak di hari ibadah memaksa pembuatan ulang slide dari awal. Selain itu, keterampilan teknis penyiapan slide sering kali hanya dikuasai oleh satu relawan.

Aplikasi ini menerima susunan acara yang ditulis oleh pengatur kebaktian — baik ditempel ke formulir web atau dikirim dari bot chat — dan otomatis merangkai slide ibadah yang rapi dan konsisten.

```text
teks rundown  →  kebaktian terurai  →  rencana slide  →  ┬→  file PowerPoint (luring)
                                                         ├→  slideshow layar penuh
                                                         └→  konsol presenter + proyektor
```

Lirik lagu diambil dari korpus database lokal berdasarkan nomor lagu. Tata letak slide dikelola melalui registri SQLite yang dapat disunting langsung di peramban. Begitu file PowerPoint diunduh, penayangan ibadah tidak membutuhkan koneksi internet sama sekali — hal ini krusial agar kebaktian tetap berjalan lancar saat jaringan gereja bermasalah.

## Fitur Utama

- **Penerimaan Susunan Acara (Rundown):** Tempel teks ke formulir web, atau kirimkan via `POST` dari bot chat ke endpoint webhook berotentikasi rahasia. Baris teks yang tidak dikenali akan ditampilkan secara transparan, tidak pernah dibuang diam-diam.
- **Pencarian & Pemecahan Bait Lagu Otomatis:** Lagu yang dirujuk berdasarkan nomor otomatis dipecah menjadi slide judul, bait, dan refrein berulang yang nyaman dibaca jemaat.
- **Editor Template Slide (Canvas WYSIWYG):** 28 template slide di registri SQLite dengan kontrol canvas interaktif: geser, ubah ukuran, atur gaya tipografi, tambah kotak teks/bentuk, dan reset template ke bentuk awal kapan pun.
- **Satu Tata Letak untuk Semua Output (16:9 Widescreen):** Satu struktur slide terhidrasi menggerakkan file PowerPoint, tayangan slideshow web, jendela proyektor, dan pratinjau langsung secara presisi 1:1.
- **Mode Presenter Dua Layar:** Layar kontrol operator dilengkapi pratinjau slide aktif dan berikutnya, filmstrip miniatur, lembar urutan acara, dan jendela kedua mandiri yang dapat ditarik ke layar proyektor.
- **Tombol Layar Hitam (Blank Screen):** Gelapkan tampilan layar proyektor jemaat seketika dan pulihkan kembali tanpa kehilangan posisi slide (`B`).
- **Pilihan Efek Transisi:** Dukungan transisi *none*, *cut*, *fade*, *dissolve*, atau *push*, diterapkan identik pada tayangan web maupun file PowerPoint.
- **Pencarian Ayat Alkitab Cepat:** Tampilkan perikop Alkitab (KJV) ke proyektor di tengah ibadah secara cepat dan bersihkan kembali setelah selesai dibaca.
- **Warta & Flyer Pengumuman:** Daftar flyer terkelola dengan gambar yang diunggah langsung atau diambil dari URL yang diizinkan.
- **Tipografi Kustom & Font Embedding:** Impor berkas font kustom dengan pengelompokan varian otomatis dan enkapsulasi ECMA-376 untuk rendering offline sempurna di Microsoft PowerPoint Desktop.
- **Manajemen Akun & Sesi:** Akun admin dan operator terpisah, pembatasan laju login anti *brute-force*, serta token sesi kriptografis yang dapat dicabut seketika.

## Persyaratan Sistem

- **Aplikasi Desktop:** Windows 10/11 64-bit.
- **Build dari Sumber:** Go 1.24+ dan Node.js 22+. Database menggunakan SQLite internal bawaan; tidak memerlukan server database eksternal.

## Panduan Instalasi

### Pemasangan Installer Windows (Direkomendasikan)

Unduh `WorshipDeckSetup.exe` dari [Halaman Rilis Resmi](https://github.com/wiradeltaid/worship-deck/releases) dan jalankan wizard instalasi.

> **Catatan Windows SmartScreen:** Karena rilis biner ini belum ditandatangani sertifikat EV komersial berbiaya tinggi, Windows SmartScreen mungkin menampilkan peringatan ("Windows protected your PC"). Klik **More info** lalu pilih **Run anyway** untuk melanjutkan.

### Menjalankan dari Kode Sumber

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck
npm install
npm run setup
npm run dev
```

`npm run setup` akan menghasilkan berkas `.env` dengan kredensial baru, menginisiasi database SQLite, menyemai registri slide bawaan, dan menampilkan kata sandi akun `admin` yang dibuat otomatis.

- `npm run dev` menjalankan server Go API pada <http://localhost:3000> dan frontend React SPA pada <http://localhost:5173>.
- Untuk penyajian produksi satu asal (*single origin*): jalankan `npm run spa:build && npm start` lalu buka port 3000.
- Menjalankan ulang perintah setup aman dilakukan: konfigurasi `.env` dan data yang sudah ada tidak akan ditimpa.

Baca [`.constitution/project/private-data.md`](.constitution/project/private-data.md) sebelum memasukkan data jemaat Anda.

### Membuat Kebaktian Baru

Buka **Services → New**. Tempel susunan acara (rundown) ke kotak teks. Format yang diharapkan adalah sebagai berikut:

```text
SABBATH, MARCH 14, 2026

BIBLE TALK (09.30-10.50 /80 min)
》welcome remarks: Mrs. Lestari
Song Leader : Ms. Ayu
[  ] Opening song : SDAH #159 The Old Rugged Cross
Memory Verse & Opening Prayer : Mr. Bagas
Closing Prayer : Mr. Damar (1m)

DIVINE SERVICE (10.50- 12.05/ 75 min)
Song Leader : Ms. Kirana
[  ] Opening Song : SDAH #83 O Worship the King
Intercessory Prayer: Mr. Farid (5m)
Sermon : Pr. Andi Hartono "Working Out" (45m)
[  ] Closing Song : SDAH #249 Praise Him! Praise Him!
```

Klik tombol **Parse**. Informasi peran, perkiraan durasi, dan nomor lagu akan dipilah otomatis ke dalam formulir; lirik lagu otomatis ditarik dari database lokal. Teks yang tidak dikenali parser akan ditampilkan transparan, tidak pernah dibuang diam-diam.

Unggah flyer khotbah dan foto kegiatan jika ada, lalu simpan kebaktian.

### Mengoperasikan Presentasi

Dari halaman kebaktian:

- **Download PPTX** — file presentasi PowerPoint luring. File ini yang menjamin kebaktian tetap berjalan saat laptop, internet, atau server bermasalah.
- **Present** — konsol presenter untuk operator. Dilengkapi pratinjau slide aktif dan berikutnya, miniatur filmstrip, daftar urutan slide, dan menu **All slides** untuk melompat ke slide mana pun seketika.
- **Open projector** — jendela terpisah tanpa kontrol untuk ditarik ke layar kedua / proyektor jemaat. Tombol panah menggerakkan kedua layar serempak. Tombol `B` menggelapkan layar proyektor dan memulihkannya kembali tanpa memindahkan posisi slide.

### Fitur Tambahan

**Pencarian Ayat Alkitab:** Mode presenter dapat menampilkan perikop Alkitab (KJV) langsung ke proyektor. Korpus teks tersedia di `data/en/bible-translation/kjv.json` dan otomatis diverifikasi setiap kali aplikasi dinyalakan.

**Penerimaan Susunan Acara via Bot Chat:** Endpoint `POST /api/webhook` dengan header `x-webhook-secret` menerima susunan acara dalam format JSON, memungkinkan bot perpesanan membuat atau memutakhirkan jadwal kebaktian secara otomatis.

### Penyelesaian Masalah (Troubleshooting)

**`Missing song book corpus`** — berkas `data/song-book/sdah.json` hilang. Berkas ini disertakan dalam repositori, pulihkan via git: `git checkout -- data/song-book/sdah.json` lalu jalankan `npm run corpus:verify`.

**Lupa kata sandi admin** — jalankan `npm run auth:set-password -- admin` untuk menyetel kata sandi baru. Jalankan `npm run auth:unlock -- --list` untuk memeriksa dan membuka blokir laju login.

**Gambar slide tidak muncul** — gambar dari URL eksternal harus mematuhi daftar domain yang diizinkan (*allow-list*). Mengunggah gambar langsung ke penyimpanan lokal aplikasi selalu berhasil.

## Penyesuaian untuk Jemaat Anda

Registri bawaan yang disertakan adalah contoh kebaktian nyata. Dua hal utama yang dapat disesuaikan:

1. **Template Slide:** Masuk sebagai administrator dan buka `/admin/artifacts`. Setiap template dapat disunting langsung di canvas visual; slide rutin (persembahan, doa rabu malam, kontak) dapat diisi data jemaat Anda.
2. **Penyimpanan Lokal:** Jika Anda ingin menjaga registri jemaat Anda di luar git, letakkan berkas di `data/local/default-registry.json` dan aplikasi akan membacanya secara otomatis. Jalur ini sudah diabaikan oleh git (`.gitignore`). Lihat [`.constitution/project/private-data.md`](.constitution/project/private-data.md).

## Korpus Bawaan

Dua korpus teks terverifikasi disertakan secara bawaan:

| Berkas | Isi | Saat Aplikasi Dijalankan |
| --- | --- | --- |
| `data/song-book/sdah.json` | 695 lagu Seventh-day Adventist Hymnal | judul dan bait lagu dibaca langsung dari berkas |
| `data/en/bible-translation/kjv.json` | 66 kitab, 1.189 pasal, 31.102 ayat Alkitab KJV | disinkronkan dari berkas lokal (~130–150 ms) |

Jalankan `npm run corpus:verify` untuk memverifikasi keutuhan korpus. Baca [ATTRIBUTIONS.md](ATTRIBUTIONS.md) untuk rincian pemegang hak cipta dan kontak penghapusan materi.

## Riwayat Proyek & Privasi

Proyek ini bermula dari repositori privat satu jemaat lokal. Riwayat tersebut tidak dibawa ke repositori publik ini karena memuat nama asli jemaat, foto anak di bawah umur, tangkapan layar percakapan privat, dan QR code donasi rekening asli. Repositori publik ini dimulai dari komit awal yang bersih menggunakan data jemaat contoh sintetis (*Harborlight Adventist Fellowship*).

Kontributor diwajibkan membaca [`.constitution/project/private-data.md`](.constitution/project/private-data.md) sebelum melakukan komit. Terdapat pengujian otomatis (`tests/public-repo-guard.test.mjs`) yang akan menggagalkan build jika data jemaat riil terdeteksi masuk ke git.

## Lisensi dan Atribusi

- **Lisensi Kode:** Didistribusikan di bawah [Lisensi MIT](LICENSE).
- **Atribusi & Korpus Himne:** Buku lagu gereja, terjemahan Alkitab, dan lisensi komponen pihak ketiga dicatat lengkap di [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
- **Privasi & Keamanan:** 100% lokal (*local-first*). Data jemaat Anda tersimpan di mesin lokal; nol telemetri, nol analitik (lihat [PRIVACY.md](PRIVACY.md) dan [SECURITY.md](SECURITY.md)).
- **Nama dan Ikon:** Lisensi MIT memberikan hak atas kode sumber aplikasi. Lisensi ini tidak memberikan hak merek dagang atas nama atau logo — hak atas nama **WorshipDeck**, **Wira Delta Indonesia**, dan logo produk tetap merupakan hak milik eksklusif PT Wira Delta Indonesia.

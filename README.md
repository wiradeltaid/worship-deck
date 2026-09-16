> Read in [English](README.en.md)

# Worship Presenter Web

Aplikasi penampil ibadah gereja mandiri (*self-hosted*) yang mengubah susunan acara (*rundown*) ibadah menjadi slide presentasi siap pakai — menghasilkan file PowerPoint (.pptx) untuk kebutuhan luring (*offline*) dan konsol presenter dua layar untuk proyektor jemaat.

Dibangun dengan arsitektur lokal (*local-first*); template slide disimpan sebagai data terkelola (bukan kode), sehingga jemaat dengan tata ibadah serupa dapat langsung menyesuaikannya lewat peramban.

## Masalah yang Dipecahkan

Menyiapkan slide kebaktian secara manual membutuhkan waktu 2–4 jam setiap pekan, sebagian besar dihabiskan untuk mengetik ulang lirik lagu yang sebenarnya sudah pernah diketik. Perubahan lagu secara mendadak di hari ibadah memaksa pembuatan ulang slide dari awal. Selain itu, keterampilan teknis penyiapan slide sering kali hanya dikuasai oleh satu relawan.

Aplikasi ini menerima susunan acara yang ditulis oleh pengatur kebaktian — baik ditempel ke formulir web atau dikirim dari bot chat — dan otomatis merangkai slide ibadah yang rapi dan konsisten.

```
teks rundown  →  kebaktian terurai  →  rencana slide  →  ┬→  file PowerPoint (luring)
                                                         ├→  slideshow layar penuh
                                                         └→  konsol presenter + proyektor
```

Lirik lagu diambil dari korpus database lokal berdasarkan nomor lagu. Tata letak slide dikelola melalui registri SQLite yang dapat disunting langsung di peramban. Begitu file PowerPoint diunduh, penayangan ibadah tidak membutuhkan koneksi internet sama sekali — hal ini krusial agar kebaktian tetap berjalan lancar saat jaringan gereja bermasalah.

## Panduan Memulai Cepat (Instalasi Mandiri)

Aplikasi dijalankan langsung dari sumber menggunakan Go dan Node.js:

```bash
git clone https://github.com/wiradeltaid/worship-presenter-web.git
cd worship-presenter-web
npm install
npm run setup
npm run dev
```

`npm run setup` akan menghasilkan berkas `.env` dengan kredensial baru, menginisiasi database SQLite, menyemai registri slide bawaan, dan menampilkan kata sandi akun `admin` yang dibuat otomatis.

- `npm run dev` menjalankan server Go API pada <http://localhost:3000> dan frontend React SPA pada <http://localhost:5173>.
- Untuk penyajian produksi satu asal (*single origin*): jalankan `npm run spa:build && npm start` lalu buka port 3000.
- Menjalankan ulang perintah setup aman dilakukan: konfigurasi `.env` dan data yang sudah ada tidak akan ditimpa.

Baca [`.constitution/project/private-data.md`](.constitution/project/private-data.md) sebelum memasukkan data jemaat Anda.

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

- Go versi 1.24 atau lebih baru.
- Node.js versi 22 atau lebih baru.
- SQLite (terintegrasi murni di Go tanpa server database terpisah).

## Membuat Kebaktian Baru

**Services → New.** Tempel teks susunan acara ke kotak teks. Pola yang dikenali memiliki format natural berikut (nama contoh sintetis):

```
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

Klik **Parse**. Peran pelayan, waktu, dan nomor lagu akan dipetakan ke dalam formulir secara otomatis; lirik lagu langsung terisi dari korpus lokal.

## Korpus Bawaan

Dua korpus bawaan disertakan secara offline:

| Berkas | Muatan | Saat Boot |
| --- | --- | --- |
| `data/song-book/sdah.json` | 695 lagu Seventh-day Adventist Hymnal | Judul dan lirik disinkronkan dari berkas |
| `data/en/bible-translation/kjv.json` | 66 kitab, 1.189 pasal, 31.102 ayat KJV | Direkonsiliasi dari berkas pada setiap boot (~130–150 ms) |

Jalankan `npm run corpus:verify` untuk memvalidasi keutuhan kedua korpus. Baca [ATTRIBUTIONS.md](ATTRIBUTIONS.md) untuk pernyataan hak cipta non-komersial liturgis dan jalur permohonan penghapusan materi.

## Penataan untuk Jemaat Anda

1. **Template Slide:** Masuk sebagai administrator dan buka menu `/admin/artifacts`. Setiap template dapat disesuaikan pada canvas visual.
2. **Override Registri Privat:** Jika gereja Anda ingin menjaga data registri tetap berada di luar git, simpan berkas di `data/local/default-registry.json` (jalur ini diabaikan oleh git). Lihat [`.constitution/project/private-data.md`](.constitution/project/private-data.md).

## Penerbitan & Deployment

Bangun Go API dan SPA (`npm run build`), lalu jalankan `./api` (atau `npm start`) pada host yang memiliki Node.js 22 pada `PATH` untuk melayani worker generator PPTX. Lihat panduan lengkap di [`.constitution/project/deployment.md`](.constitution/project/deployment.md).

## Lisensi

Kode aplikasi dilisensikan di bawah [MIT License](LICENSE). Konten pihak ketiga dijelaskan terpisah di [ATTRIBUTIONS.md](ATTRIBUTIONS.md). Kebijakan privasi tersedia di [PRIVACY.md](PRIVACY.md) dan kebijakan keamanan di [SECURITY.md](SECURITY.md).

## Nama dan Ikon (The Name and the Icon)

Lisensi MIT pada [LICENSE](LICENSE) memberikan hak yang luas atas kode sumber perangkat lunak. Lisensi tersebut tidak mencakup hak atas nama dagang atau logo — perlindungan terpisah berlaku untuk nama **Worship Presenter Web**, nama studio **Wira Delta Indonesia** (**WDI**), serta ikon dan logo grafis proyek.

Anda diperkenankan menyebut nama-nama tersebut untuk merujuk pada proyek ini (misalnya: *"berdasarkan Worship Presenter Web"*, *"fork dari Worship Presenter Web"*, atau *"kompatibel dengan Worship Presenter Web"*). Anda tidak diperkenankan menggunakannya sebagai nama produk turunan Anda sendiri atau dengan cara yang mengesankan adanya afiliasi maupun dukungan resmi dari proyek ini.

Jika Anda mempublikasikan build modifikasi — dan adaptasi untuk tradisi liturgi gereja lain sangat dianjurkan — gunakan nama produk Anda sendiri agar jemaat yang menggunakannya mengetahui pihak yang bertanggung jawab atas dukungan teknisnya. Kode sumber bebas untuk Anda kembangkan; nama dan tanda merek tetap dilindungi.

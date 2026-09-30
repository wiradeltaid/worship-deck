# WorshipDeck

> Aplikasi penampil dan staging ibadah gereja mandiri (*local-first church presentation and staging suite*) yang mengubah susunan acara ibadah menjadi slide presentasi siap pakai: menghasilkan file PowerPoint (.pptx) dengan font tertanam untuk kebutuhan luring (*offline*), konsol presenter dua layar untuk layar jemaat, dan remote smartphone Wi-Fi lokal.

[English](README.md) | [Bahasa Indonesia](README.id.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Deutsch](README.de.md) | [Français](README.fr.md) | [Português (Brasil)](README.pt-BR.md) | [Русский](README.ru.md)  
[Website](https://wiradelta.com/worship-deck) | [Unduh v0.1.0](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe) | [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [Semua Rilis](https://github.com/wiradeltaid/worship-deck/releases) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md) | [License](LICENSE) | [Security](SECURITY.md) | [Privacy](PRIVACY.md) | [Attributions](ATTRIBUTIONS.md)

---

Dibangun untuk jemaat liturgis dan Masehi Advent Hari Ketujuh, tetapi tata letak slide disimpan sebagai data terkelola (bukan kode), sehingga jemaat dengan tata ibadah serupa dapat langsung menyesuaikannya lewat peramban.

## Masalah yang Dipecahkan

Menyiapkan slide kebaktian secara manual membutuhkan waktu berjam-jam, sebagian besar dihabiskan untuk mengetik ulang lirik lagu yang sudah pernah diketik. Perubahan lagu secara mendadak memaksa pembuatan ulang slide dari awal.

Aplikasi ini menerima susunan acara yang ditulis oleh pengatur kebaktian dan otomatis merangkai slide ibadah yang konsisten:

```text
teks susunan acara  ->  kebaktian terurai  ->  rencana slide  ->  +->  file PowerPoint (luring)
                                                                  +->  konsol presenter + layar jemaat
```

Lirik lagu diambil dari korpus database lokal. Tata letak slide dikelola melalui registri SQLite yang dapat disunting langsung di peramban. Begitu file PowerPoint diunduh, penayangan ibadah tidak membutuhkan koneksi internet sama sekali.

## Panduan Instalasi

### Server Mandiri (Direkomendasikan)

Menjalankan WorshipDeck sebagai server lokal mandiri merupakan model penerapan utama yang direkomendasikan:

```bash
git clone https://github.com/wiradeltaid/worship-deck.git
cd worship-deck && npm install && npm run setup && npm run dev
```

`npm run setup` membangkitkan berkas `.env` dengan kredensial baru, menginisialisasi SQLite, dan menampilkan akun admin. `npm run dev` menjalankan Go API di `http://localhost:3000` dan Vite SPA di `http://localhost:5173`. Lihat [docs/deployment.md](docs/deployment.md) untuk penerapan produksi.

### Installer Desktop Windows (Eksperimental)

Unduh panduan instalasi mandiri untuk konfigurasi satu komputer gereja:

- **Unduhan Langsung:** [WorshipDeck-0.1.0-x64-setup.exe](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/WorshipDeck-0.1.0-x64-setup.exe)
- **Checksum Integritas:** [SHA256SUMS](https://github.com/wiradeltaid/worship-deck/releases/download/v0.1.0/SHA256SUMS) | [Semua Rilis](https://github.com/wiradeltaid/worship-deck/releases)

> **Catatan Windows SmartScreen:** Karena rilis ini belum ditandatangani sertifikat EV komersial, Windows SmartScreen mungkin memunculkan peringatan. Klik **More info** lalu **Run anyway** untuk melanjutkan.

## Fitur Utama

- **Penerimaan Susunan Acara:** Tempel teks ke formulir web. Baris teks yang tidak dikenali akan ditampilkan secara transparan.
- **Pencarian Bait Lagu Otomatis:** Lagu yang dirujuk berdasarkan nomor otomatis dipecah menjadi slide judul, bait, dan refrein berulang.
- **Tata Letak Slide yang Dapat Disunting:** Kelola tata letak slide di registri SQLite dengan editor canvas peramban atau impor dari PowerPoint.
- **Mode Presenter Dua Layar:** Layar kontrol operator, layar jemaat terpisah dengan tombol layar hitam (`B`), dan remote smartphone Wi-Fi lokal.
- **Ekspor PowerPoint 16:9 Widescreen:** Menghasilkan file `.pptx` mandiri dengan font tertanam untuk penayangan luring sejati.
- **Pencarian Ayat Alkitab Cepat:** Tampilkan perikop KJV ke layar jemaat di tengah kebaktian secara instan.
- **Tipografi Luring:** 41 keluarga font lokal yang dibundel luring, serta dukungan impor berkas font kustom.
- **Sinkronisasi Manual (Eksperimental):** Kirim dan tarik data antar-perangkat WorshipDeck di jaringan lokal atas permintaan operator.

## Dokumentasi

- **[Getting Started](docs/getting-started.md):** Petunjuk pemasangan server dan installer desktop.
- **[Features and Workflows](docs/features.md):** Panduan alur kerja dan fitur lengkap operator.
- **[Configuration and Administration](docs/configuration.md):** Tata letak formulir dinamis dan administrasi SQLite.
- **[Customization and Slide Layouts](docs/customization.md):** Pembuatan tata letak canvas, impor PowerPoint, dan demo seed.
- **[Shipped Corpora](docs/corpora.md):** Rincian korpus SDAH dan KJV serta buku lagu tambahan.
- **[Production Deployment](docs/deployment.md):** Panduan layanan persistent systemd dan reverse proxy.
- **[Project History](docs/history.md):** Asal-usul, silsilah publik, dan jaminan perlindungan privasi.

## Persyaratan Sistem

- **Server (Direkomendasikan):** Linux (Ubuntu), Windows 10/11, atau host POSIX dengan Go 1.24+ dan Node.js 22.12+. Dibangun dengan React 19. Database SQLite internal.
- **Aplikasi Desktop Windows (Eksperimental):** Windows 10/11 64-bit.

## Lisensi dan Atribusi

- **Lisensi Kode:** Didistribusikan di bawah [MIT License](LICENSE).
- **Atribusi Korpus dan Font:** Pemberitahuan hak cipta font pihak ketiga, korpus lagu, dan Alkitab dirinci dalam [ATTRIBUTIONS.md](ATTRIBUTIONS.md).

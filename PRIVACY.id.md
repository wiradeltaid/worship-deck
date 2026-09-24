# Kebijakan Privasi
<!-- Copied from the Wira Delta Indonesia legal source (worship-deck/privacy.id.md) on 2026-09-24.
     Edit the source, then copy it here again. -->

Naskah ini adalah naskah resmi dalam bahasa Indonesia. Terjemahan bahasa Inggris tersedia di [PRIVACY.md](PRIVACY.md).

**Berlaku sejak:** 24 September 2026 · berlaku untuk WorshipDeck 0.1.0

WorshipDeck adalah software (perangkat lunak) presentasi ibadah yang Anda pasang dan jalankan sendiri. Di naskah ini, "Anda" berarti gereja atau organisasi yang memasang dan menjalankan WorshipDeck, dan "server" berarti komputer tempat WorshipDeck berjalan, termasuk laptop yang memakai installer Windows. Data yang disimpan WorshipDeck tetap berada di server Anda, kecuali Anda sendiri mengirimnya ke tempat lain. Wira Delta Indonesia menulis software ini. Wira Delta Indonesia tidak menjalankan instalasi Anda, tidak menerima salinan data Anda, dan tidak punya akses ke data itu.

Pembagian ini menentukan siapa bertanggung jawab atas apa, jadi kami menuliskannya dengan jelas:

| | Wira Delta Indonesia | Anda |
|---|---|---|
| Menulis dan memelihara kode | Ya | Tidak |
| Menjalankan server dan menyimpan data | Tidak | Ya |
| Menentukan siapa yang mendapat akun | Tidak | Ya |
| Menjawab jemaat yang bertanya data apa yang disimpan tentang dirinya, atau yang meminta data itu dihapus | Tidak bisa, karena tidak punya akses | Ya |

Menurut Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP) dan undang-undang serupa di negara lain, pembagian ini menjadikan **Anda** pengendali data pribadi untuk instalasi Anda. Naskah ini menjelaskan apa yang dilakukan software dengan data, supaya Anda bisa memenuhi tanggung jawab itu. Naskah ini bukan kebijakan privasi yang bisa langsung Anda berikan kepada jemaat. Lihat bagian "Yang Tetap Menjadi Tugas Anda" di akhir.

## Yang Disimpan Aplikasi

| Data | Asalnya | Untuk apa |
|---|---|---|
| **Susunan acara dan isi ibadah** | Diketik atau ditempel oleh pemegang akun | Membuat slide ibadah dan menayangkannya lagi |
| **Nama orang** | Diketik di kolom susunan acara, misalnya nama petugas | Menampilkan siapa yang bertugas di tiap bagian ibadah. WorshipDeck tidak punya daftar anggota tersendiri; nama hanya ada di dalam data ibadah |
| **Foto dan gambar** | Diunggah, diambil dari alamat web yang diberikan pemegang akun, atau diimpor dari file PowerPoint | Ditampilkan di slide, di pengumuman, dan di Background Library |
| **Slide rancangan Anda** | Dibuat di editor slide, atau diimpor dari file PowerPoint | Tampilan slide ibadah. Instalasi baru mulai kosong, tanpa template |
| **Font yang diunggah** | Diunggah admin | Dipakai di slide dan disematkan ke file PowerPoint hasil ekspor |
| **Akun** | Dibuat admin. Akun admin pertama dibuat di layar setup saat installer Windows pertama kali dijalankan, atau, pada instalasi dari kode sumber, dari `AUTH_BOOTSTRAP_USER` dan `AUTH_BOOTSTRAP_PASSWORD` saat belum ada akun sama sekali | Masuk ke aplikasi dengan peran admin atau operator. Kata sandi disimpan sebagai hash scrypt, bukan teks biasa |
| **Daftar sesi yang dicabut** | Dicatat saat seseorang keluar atau sesinya dicabut admin | Menolak sesi itu sampai masa berlakunya habis |
| **Catatan percobaan masuk** | Dicatat setiap kali percobaan masuk gagal | Menahan tebakan kata sandi. Berisi nama pengguna yang diketik dan alamat IP asal permintaan |
| **Pengaturan** | Diisi admin | Bahasa antarmuka, transisi slide, terjemahan Alkitab default, dan pengaturan sejenis |

Sesi masuk sendiri tidak disimpan di server. Sesi dibawa oleh cookie `auth_session` bertanda tangan di browser, berlaku paling lama 7 hari.

**Foto orang diperlakukan lebih ketat daripada data lain** oleh hukum Indonesia dan oleh sebagian besar aturan pelindungan data di negara lain. Bila jemaat Anda memotret anak, aturannya lebih ketat lagi. WorshipDeck tidak bisa membedakan foto orang dari unggahan lain, dan tidak bisa menilai apa yang ditulis di susunan acara. Penilaian itu, dan persetujuan dari orang yang bersangkutan, menjadi tanggung jawab Anda.

## Tempat Data Disimpan

| Path | Isi | Retensi |
|---|---|---|
| File database SQLite: `data.db` di folder tempat server dijalankan, atau path di `DB_PATH`. Pada installer Windows: `%LOCALAPPDATA%\WorshipDeck\data.db` | Semua data di tabel sebelumnya, kecuali file gambar dan font | Sampai dihapus lewat aplikasi atau dihapus dari server. Uninstall tidak menghapus folder `%LOCALAPPDATA%\WorshipDeck\` |
| Folder unggahan: `data/uploads/` di folder tempat server dijalankan, atau path di `UPLOADS_DIR`. Pada installer Windows: `%LOCALAPPDATA%\WorshipDeck\uploads\` | Foto dan gambar yang diunggah, diambil dari alamat web, atau diimpor dari PowerPoint; font yang diunggah di subfolder `fonts` | Lihat "Penghapusan" di bawah |
| `%LOCALAPPDATA%\WorshipDeck\runtime.json` (installer Windows) | Alamat dan port server yang sedang berjalan | Dihapus saat aplikasi ditutup dengan normal |
| `AUTH_SECRET` di folder `%LOCALAPPDATA%\WorshipDeck\` (installer Windows) | Secret acak untuk menandatangani sesi masuk, dibuat otomatis saat installer pertama kali dijalankan | Sampai folder itu dihapus. Uninstall tidak menghapusnya |
| File `.env` (instalasi dari kode sumber) | `AUTH_SECRET` dan kata sandi akun admin pertama dalam teks biasa, ditulis oleh `npm run setup` | Sampai Anda mengubah atau menghapusnya |

Installer Windows juga membuat folder `%LOCALAPPDATA%\WorshipDeck\logs\`. Versi ini tidak menulis apa pun ke folder itu; catatan server hanya tampil di jendela terminal atau log layanan yang Anda pakai untuk menjalankannya.

File PowerPoint hasil ekspor dibuat saat diminta dan langsung dikirim ke browser. Server tidak menyimpan salinannya.

Semua file di atas berada di penyimpanan yang **Anda** kendalikan. Keamanannya adalah keamanan server itu: izin file, cadangan (backup), enkripsi disk, dan siapa yang bisa masuk ke server. WorshipDeck tidak mengenkripsi file ini, dan tidak berpura-pura mengenkripsinya. Anggap file ini bisa dibaca oleh apa pun yang berjalan dengan akun Windows atau akun server yang sama.

### Penghapusan

- **Menghapus ibadah** menghapus datanya dari database, lalu menghapus file unggahan yang dipakai ibadah itu bila tidak ada data lain yang masih memakainya.
- **Menghapus slide pengumuman atau gambar di Background Library** hanya menghapus datanya dari database. File gambarnya tetap ada di folder unggahan sampai dihapus langsung dari file system server. Bila sebuah foto harus hilang sepenuhnya, hapus dari kedua tempat.
- **Menghapus font yang diunggah** menghapus file fontnya juga.
- **Tidak ada tong sampah.** Penghapusan lewat aplikasi bersifat permanen dan tidak bisa dibatalkan dari aplikasi. Data yang sudah dihapus hanya bisa kembali dari cadangan yang Anda buat sendiri.

## Yang Disimpan di Browser

| Nama | Isi | Retensi |
|---|---|---|
| Cookie `auth_session` | Sesi masuk bertanda tangan: nomor akun, peran, dan masa berlaku | 7 hari, atau sampai Anda keluar |
| `localStorage` `theme` | Pilihan tema terang atau gelap | Sampai data situs di browser dihapus |
| `localStorage` `wpw_presenter_loop_interval` | Jeda putar ulang pengumuman di konsol operator | Sampai data situs di browser dihapus |
| `localStorage` `wpw_device_id`, `wpw_sync_remote_url`, `wpw_sync_device_token` | Identitas perangkat, alamat instance tujuan, dan token yang diisi di halaman Manual Sync | Sampai data situs di browser dihapus |
| `sessionStorage` `wpw_canvas_clipboard` | Objek slide yang disalin di editor slide | Sampai tab ditutup |

Semua ini disimpan di browser pada alamat server Anda sendiri, dan tidak dikirim ke Wira Delta Indonesia.

## Aktivitas Jaringan

Semua yang dijelaskan di bawah adalah permintaan yang dibuat atau diterima **server Anda**, atau browser yang membuka server Anda. WorshipDeck tidak membuat permintaan apa pun ke Wira Delta Indonesia, lewat jalur mana pun. Tidak ada telemetri, tidak ada analitik, tidak ada laporan crash, dan tidak ada cek lisensi atau cek update.

### Gambar dari Alamat Web

Pemegang akun bisa memasukkan alamat web sebuah gambar, untuk diunggah ke server atau dipasang langsung di slide dan pengumuman.

- **Yang dikirim.** Permintaan biasa untuk alamat gambar itu. Tidak ada data ibadah, nama, atau foto yang ikut dikirim.
- **Yang tetap terungkap.** Situs yang menyimpan gambar itu melihat alamat IP server Anda dan waktu permintaan. Bila gambar dipasang langsung dari alamat web, browser yang menampilkannya (konsol operator, layar jemaat, editor) juga memintanya ke situs itu, sehingga situs itu melihat alamat IP browser tersebut. Server juga memintanya lagi setiap kali membuat file PowerPoint yang memuat gambar itu.
- **Yang tidak dikirim, dan tidak mungkin dikirim.** Permintaan ini tidak membawa cookie sesi, susunan acara, atau isi database. Server tidak mengikuti pengalihan (redirect), menolak alamat loopback, jaringan privat, link-local, dan metadata cloud, hanya menerima gambar JPG, PNG, GIF, dan WebP, berhenti sesudah 16 MB, dan menyerah sesudah 8 detik.
- **Cara membatasinya.** Isi `IMAGE_URL_ALLOWLIST` dengan daftar nama host yang boleh dipakai; sesudah itu hanya host di daftar itu yang diterima. Bila `IMAGE_URL_ALLOWLIST` kosong, yang berlaku secara default, semua host publik lewat `http` maupun `https` diterima. Untuk berhenti sama sekali, pakai hanya gambar yang diunggah dari komputer. Tidak ada yang rusak selain fitur ambil dari alamat web.

### Remote Ponsel

Pada instalasi server, operator bisa memasangkan ponsel sebagai remote dengan kode 6 digit yang berlaku 60 detik.

- **Yang dikirim.** Perintah remote (pindah slide, kosongkan layar, ganti latar, tampilkan atau hapus ayat) dari ponsel ke server Anda, dan status tayangan dari server ke ponsel.
- **Yang tetap terungkap.** Server melihat alamat IP ponsel di jaringan Anda.
- **Yang tidak dikirim.** Tidak ada yang keluar dari jaringan antara ponsel dan server Anda. Ponsel harus masuk dengan akun WorshipDeck lebih dulu.
- **Cara mematikannya.** Jangan pasangkan ponsel. Installer Windows hanya mendengarkan di `127.0.0.1`, sehingga remote ponsel tidak bisa dipakai di sana sama sekali.

### Manual Sync (Eksperimental)

Bila Anda menjalankan lebih dari satu instance WorshipDeck, admin bisa mengirim dan mengambil data ibadah, entri Song Set, gambar latar, dan pengumuman antara dua instance, termasuk nama dan foto di dalamnya, ke alamat yang diketik admin sendiri.

- **Yang dikirim.** Data yang disebut di atas, dari browser admin langsung ke alamat instance tujuan.
- **Yang tetap terungkap.** Instance tujuan melihat alamat IP browser admin.
- **Yang tidak dikirim.** Tidak ada yang dikirim ke pihak ketiga atau ke Wira Delta Indonesia. Sync hanya berjalan saat admin menekannya, tidak pernah otomatis.
- **Cara mematikannya.** Jangan pakai halaman Manual Sync. Tidak ada fitur lain yang bergantung padanya.

**Bila Anda memakai sync, instance kedua menjadi salinan kedua data itu,** dan Anda juga pengendali data untuk salinan itu. **Fitur ini eksperimental.** Sync baru dibuktikan dengan satu server yang bertukar data dengan dirinya sendiri. Sync antara dua komputer yang benar-benar terpisah belum terbukti berjalan, dan aturan lintas-origin browser bisa menolak permintaannya sebelum ada data yang berpindah. Jangan mengandalkannya sebagai satu-satunya cara menjaga dua instance tetap sama.

### Endpoint Webhook

Kode WorshipDeck memuat endpoint `POST /api/webhook` untuk menerima susunan acara dari bot chat. Fitur ini belum ditawarkan di rilis ini dan akan menyusul (coming soon). Sampai fitur itu siap, endpoint ini dimatikan di kode: setiap permintaan dijawab dengan galat dan isinya tidak dibaca.

### Yang Tidak Membuat Permintaan Jaringan

- **Ayat Alkitab.** Teks King James Version adalah file korpus di dalam aplikasi (`data/en/bible-translation/kjv.json`) yang dimasukkan ke database saat server pertama kali berjalan. Pencarian ayat membaca database Anda sendiri.
- **Lirik lagu.** Lirik berasal dari file korpus yang dibawa aplikasi. Pencarian lagu tidak keluar dari server Anda.
- **Font.** Semua font, termasuk ke-35 keluarga font di pemilih font, dibawa di dalam aplikasi. Konsol operator, layar jemaat, dan ekspor PowerPoint tidak meminta apa pun ke Google Fonts atau CDN font lain. Font yang disematkan ke file PowerPoint diambil dari file lokal.

Sesudah file PowerPoint diunduh, ibadah bisa berjalan tanpa jaringan sama sekali. Ini disengaja, karena file itulah yang menjalankan ibadah bila yang lain gagal.

## Yang Tidak Dilakukan Software Ini

- Tidak mengirim apa pun ke Wira Delta Indonesia.
- Tidak memuat skrip analitik, piksel pelacak, atau permintaan font atau CDN pihak ketiga yang memberi tahu pihak luar siapa yang memakainya.
- Tidak membuat akun sendiri. Setiap akun ada karena admin membuatnya, karena Anda membuat akun admin pertama di layar setup installer, atau karena Anda mengisi `AUTH_BOOTSTRAP_USER` dan `AUTH_BOOTSTRAP_PASSWORD`.

## Yang Tetap Menjadi Tugas Anda

Software yang menjaga privasi tidak membuat instalasi Anda otomatis patuh hukum. Paling tidak:

1. **Tulis pemberitahuan sendiri untuk jemaat Anda.** Lihat [`docs/operator-privacy-template.md`](docs/operator-privacy-template.md) untuk template yang bisa disesuaikan. Pemberitahuan itu menyebut apa yang disimpan gereja Anda, untuk apa, berapa lama, dan kepada siapa jemaat meminta penghapusan. Naskah ini menjelaskan software, bukan kebiasaan gereja Anda, dan memang tidak bisa.
2. **Minta persetujuan sebelum memotret orang**, dan minta lagi secara terpisah sebelum foto itu ditayangkan di slide, terutama untuk anak.
3. **Jalankan instalasi server WorshipDeck di belakang HTTPS**, juga bila server hanya dibuka dari jaringan gereja, dengan `AUTH_SECRET` yang unik untuk instalasi Anda dan tidak pernah di-commit. Kebijakan Keamanan menyatakan bahwa instalasi yang melewatkan ini tidak aman, apa pun kodenya, dan itu tetap berlaku. Installer Windows dikecualikan dari syarat HTTPS karena hanya mendengarkan di `127.0.0.1`, sehingga lalu lintasnya tidak keluar dari komputer itu. `AUTH_SECRET`-nya dibuat otomatis dan unik untuk setiap instalasi.
4. **Hapus akun saat seseorang berhenti bertugas**, dan cabut sesinya.
5. **Tentukan berapa lama Anda menyimpan ibadah lama dan foto**, lalu benar-benar hapus. Tidak ada data di aplikasi yang kedaluwarsa sendiri.
6. **Bila Anda memakai Manual Sync**, perlakukan instance kedua sebagai salinan kedua setiap data yang diterimanya. Menghapus data seseorang di satu instance tidak menghapusnya di instance lain, dan keduanya butuh keputusan retensinya sendiri.

## Pertanyaan

Tentang software ini: **support@wiradelta.id**. Tentang data di satu instalasi tertentu, tanyakan kepada pihak yang menjalankannya. Wira Delta Indonesia tidak bisa melihat data itu dan tidak bisa menjawab untuknya.

## Bahasa

Bahasa. Naskah ini dibuat dalam bahasa Indonesia dan diterjemahkan ke bahasa Inggris. Bila terdapat perbedaan tafsir antara keduanya, naskah bahasa Indonesia yang berlaku.

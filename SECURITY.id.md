# Kebijakan Keamanan
<!-- Copied from the Wira Delta Indonesia legal source (worship-deck/security.id.md) on 2026-09-26.
     Edit the source, then copy it here again. -->

Naskah ini adalah naskah resmi dalam bahasa Indonesia. Terjemahan bahasa Inggris tersedia di [SECURITY.md](SECURITY.md).

**Berlaku sejak:** 24 September 2026 · berlaku untuk WorshipDeck 0.1.0

WorshipDeck menyimpan nama dan foto orang yang bukan pengguna langsungnya, yaitu data pribadi jemaat dan petugas. Server menerima unggahan file, termasuk file PowerPoint yang dibongkar di server. Server mengambil gambar dari alamat web yang diberikan pemegang akun, dan secara default menerima semua host publik. Pada instalasi server, WorshipDeck bisa dibuka dari komputer dan ponsel lain di jaringan Anda. Hal-hal ini layak diperiksa. Lihat "Dua Fakta yang Paling Ingin Diketahui" di bawah, [`docs/threat-model.md`](docs/threat-model.md) untuk analisis lengkap komponen dan jalur serangannya, dan [Kebijakan Privasi](PRIVACY.id.md) untuk apa yang disimpan dan di mana.

Di naskah ini, "Anda" berarti gereja atau organisasi yang memasang dan menjalankan WorshipDeck, dan "server" berarti komputer tempat WorshipDeck berjalan.

## Dua Fakta yang Paling Ingin Diketahui

1. **Apakah WorshipDeck mengirim data jemaat ke mana-mana?** Tidak ada permintaan di kode yang mengirim nama, foto, atau isi ibadah ke pihak ketiga atau ke Wira Delta Indonesia. Server membuat tepat dua jenis permintaan keluar, dan keduanya hanya mengambil gambar dari alamat web yang dipilih pemegang akun: mengunggah gambar dari alamat web (`postUploadFromURL`), dan memasukkan gambar dari alamat web ke file PowerPoint saat file itu dibuat. Tidak ada permintaan ke Google Fonts, cek update, telemetri, atau laporan crash. Data ibadah hanya keluar dari server lewat file PowerPoint dan halaman yang dibuka pemegang akun, dan lewat Manual Sync yang eksperimental, ke alamat yang diketik admin sendiri.
2. **Masukan jaringan apa yang diterima, dan bagaimana dibatasi?** Tanpa sesi yang sah, server hanya menerima halaman masuk, permintaan masuk dan keluar, file statis di `/assets` dan `/branding`, permintaan penyiapan admin pertama (khusus pada mode desktop, hanya dari komputer itu sendiri / loopback, dan hanya selama belum ada akun), dan endpoint webhook. Endpoint webhook belum ditawarkan di rilis ini dan dimatikan di kode sampai fiturnya siap. Semua endpoint lain membutuhkan cookie sesi yang ditandatangani dengan `AUTH_SECRET` dan diperiksa ulang ke database pada setiap permintaan. Jalur admin, termasuk impor PowerPoint, unggah font, dan Manual Sync, juga membutuhkan peran admin. Pengambilan gambar dari alamat web tidak mengikuti pengalihan (redirect), menolak alamat loopback, jaringan privat, link-local, dan metadata cloud, dan hanya menerima host di `IMAGE_URL_ALLOWLIST` bila daftar itu diisi.

## Melaporkan Celah Keamanan

Jangan membuka issue publik untuk masalah keamanan.

Laporkan secara tertutup lewat [GitHub Security Advisories](https://github.com/wiradeltaid/worship-deck/security/advisories/new) di repositori WorshipDeck. Kode sumber WorshipDeck terbuka, jadi jalur ini bisa dijangkau pelapor dari luar, dan laporan tetap tertutup sampai ada perbaikan. Pertanyaan yang bukan soal keamanan bisa dikirim ke support@wiradelta.com.

Anda akan menerima tanda terima, lalu perbaikan atau penjelasan mengapa laporan itu bukan celah. Tidak ada program bug bounty dan tidak ada jaminan waktu tanggap. Ini proyek kecil, dan jujur soal itu lebih berguna daripada janji yang tidak bisa ditepati. Hanya rilis terbaru yang menerima perbaikan. Tidak ada cabang dukungan jangka panjang.

## Cakupan

**Termasuk cakupan**, dan sangat diharapkan:

- masuk, sesi, dan pencabutan sesi;
- pemisahan peran admin dan operator;
- pengambilan gambar dari alamat web, termasuk cara melewati penolakan alamat privat;
- unggahan file dan impor file PowerPoint;
- pemasangan dan perintah remote ponsel;
- Manual Sync, walaupun masih eksperimental, dan setiap cara membuat endpoint webhook yang dimatikan itu menerima permintaan;
- teks dari susunan acara atau data lain yang tampil sebagai HTML di layar jemaat, bukan sebagai teks.

**Tidak termasuk cakupan**, dengan alasannya:

- Penyerang yang sudah memegang akun admin. Admin memang boleh mengubah semua isi, mengunggah file, dan menjalankan sync; memakai hak itu bukan celah.
- Penyerang yang sudah bisa membaca file system server atau berjalan dengan akun yang sama dengan server. Orang itu bisa membaca `data.db`, `.env`, dan `AUTH_SECRET` di folder data secara langsung, jadi tidak ada yang bisa dilindungi aplikasi darinya.
- Instalasi server tanpa HTTPS, dengan `AUTH_SECRET` yang dibagikan atau diambil dari contoh `.env.example`, atau dengan `NODE_ENV` yang bukan `production` di belakang HTTPS. Syarat ini tertulis di "Syarat Pemasangan"; instalasi yang melewatkannya tidak aman, apa pun kodenya.
- Risiko di "Risiko yang Diketahui" di bawah. Risiko itu sudah dicatat, bukan diperbaiki. Laporan tentang cara baru memanfaatkannya tetap diterima.

## Tampilan Proyeksi dan Konten yang Disisipkan

Susunan acara, nama, dan teks ibadah sampai ke layar jemaat sebagai data, bukan sebagai markup. Kode frontend tidak memakai `dangerouslySetInnerHTML` atau penulisan `innerHTML` langsung di mana pun di `src/` dan `spa/src/`, jadi render JSX default React meng-escape teks sebelum tampil di layar yang dilihat jemaat. Laporan yang menunjukkan jalur di mana teks dari pemegang akun tampil sebagai HTML adalah temuan yang sah dan termasuk cakupan.

## Syarat Pemasangan

Kode tidak memaksakan syarat berikut. Kode hanya berasumsi syarat ini dipenuhi, dan instalasi yang melewatkannya tidak aman, apa pun kodenya.

1. **HTTPS untuk instalasi server, juga di jaringan gereja.** Jalankan instalasi server WorshipDeck di belakang reverse proxy HTTPS (misalnya Caddy, Nginx, atau Cloudflare Tunnel), juga bila server hanya dibuka dari jaringan gereja. Tanpa HTTPS, kata sandi dan cookie sesi bisa dibaca siapa pun di jaringan yang sama, termasuk Wi-Fi tamu. Installer Windows dikecualikan dari syarat ini: installer hanya mendengarkan di `127.0.0.1`, sehingga lalu lintasnya tidak keluar dari komputer itu.
2. **Secret yang unik.** Isi `AUTH_SECRET` dengan nilai acak minimal 16 karakter, unik untuk setiap instalasi, dan jangan pernah di-commit. `npm run setup` membuatnya secara acak. Installer Windows membuatnya sendiri saat pertama kali dijalankan dan menyimpannya di folder `%LOCALAPPDATA%\WorshipDeck\`; akun admin pertama dibuat di layar setup. Bila `AUTH_SECRET` kosong atau lebih pendek dari 16 karakter, tidak ada yang bisa masuk.
3. **`NODE_ENV=production` di belakang HTTPS.** Cookie sesi hanya diberi tanda `Secure` bila `NODE_ENV` bernilai `production`. Tanpa itu, browser mau mengirim cookie sesi lewat HTTP biasa.
4. **Batasi sumber gambar.** Isi `IMAGE_URL_ALLOWLIST` dengan host gambar yang Anda pakai. Tanpa daftar itu, server mau mengambil gambar dari host publik mana pun.
5. **Dengarkan hanya di alamat yang perlu.** Server hanya mendengarkan di `127.0.0.1` kecuali `LISTEN_HOST` atau `--host` diisi. Isi hanya bila komputer atau ponsel lain memang harus membukanya, dan hanya di belakang HTTPS.
6. **Penyimpanan di bawah kendali Anda.** Letakkan database dan folder unggahan di penyimpanan yang Anda kendalikan, batasi siapa yang bisa masuk ke server, dan buat cadangan secara rutin.

## Risiko yang Diketahui

Risiko berikut sudah dicatat, bukan diperbaiki. Uraian lengkapnya ada di [`docs/threat-model.md`](docs/threat-model.md).

- **Alamat IP untuk pembatasan percobaan masuk.** Pembatas percobaan masuk membaca alamat klien dari header `CF-Connecting-IP` atau `X-Forwarded-For` bila header itu ada. Bila server bisa dijangkau tanpa melewati proxy yang menimpa header itu, klien bisa memilih alamatnya sendiri dan menghindari batas per alamat IP. Letakkan server di belakang proxy yang menimpa header itu, dan jangan buka port server langsung.
- **Manual Sync.** `POST /api/sync/push` dan `POST /api/sync/assets/check` tidak membatasi ukuran isi permintaan. Kolom "Device Authorization Token" di halaman Manual Sync dikirim tetapi tidak dibaca server, jadi kolom itu bukan kontrol keamanan. Tanpa dukungan CORS, sync antara dua origin yang berbeda belum bisa berjalan.
- **Sumber gambar terbuka secara default.** Lihat syarat nomor 4.

## Penghapusan Bersifat Permanen

Tidak ada tong sampah di WorshipDeck. Data yang dihapus lewat aplikasi hilang dari database dan tidak bisa dipulihkan dari aplikasi. Menghapus slide pengumuman atau gambar Background Library tidak menghapus file gambarnya dari folder unggahan. Rinciannya ada di Kebijakan Privasi, bagian "Penghapusan".

## Keaslian Rilis

Membangun sendiri dari kode sumber selalu tersedia: clone repositori pada commit atau tag yang Anda pilih, build sendiri, dan yang Anda jalankan persis kode yang bisa Anda baca.

Installer Windows diterbitkan di GitHub Releases untuk setiap tag, dengan nama `WorshipDeck-<versi>-x64-setup.exe`. Installer ini masih eksperimental; cara utama memakai WorshipDeck adalah instalasi server. Installer di-build oleh CI (`.github/workflows/release.yml`) langsung dari kode sumber tag itu. Workflow menjalankan tes Go, pemeriksaan tipe, dan tes penjaga sebelum membuat installer, dan menolak merilis bila tag, versi di `package.json`, dan bagian yang sesuai di `CHANGELOG.md` tidak cocok.

Installer ini **tidak ditandatangani kode (code signing)**. Karena itu Windows SmartScreen kemungkinan besar memperingatkan saat pertama kali dijalankan. Peringatan itu wajar untuk installer yang tidak ditandatangani, dan karena itu pula peringatan tersebut tidak bisa membantu Anda membedakan installer asli dari yang palsu.

Yang bisa Anda periksa adalah checksum SHA-256. Setiap rilis menerbitkan file `SHA256SUMS` di samping installer. Hitung hash file yang Anda unduh, lalu bandingkan sebelum menjalankannya. Batasnya perlu diketahui: checksum yang disajikan dari tempat yang sama dengan unduhannya membuktikan file itu utuh selama pengiriman, **bukan** membuktikan asal-usulnya. Penandatanganan kode adalah perbaikan yang sesungguhnya, dan belum dilakukan.

## Privasi

Bila repositori ini suatu saat memuat data tentang orang sungguhan yang tidak menyetujuinya, itu masalah keamanan dan akan ditangani sebagai masalah keamanan. Lihat [`.constitution/project/private-data.md`](.constitution/project/private-data.md).

## Bahasa

Bahasa. Naskah ini dibuat dalam bahasa Indonesia dan diterjemahkan ke bahasa Inggris. Bila terdapat perbedaan tafsir antara keduanya, naskah bahasa Indonesia yang berlaku.

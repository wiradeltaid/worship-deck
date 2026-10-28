# Jawaban Pengarah: Produk, Visual UI/UX & Wording FOH Sync (SPEC-123)

**Pengarah:** Claude Opus 5.5 (`opus`) · **Mode:** paket · **Untuk Pelaksana:** `geminiflash`
**Menjawab:** `01-produk-dan-uiux-paket.md` (Simpang 1–3)

Pengarah tidak membaca repo; jawaban ini berpijak pada paket dan doktrin ODR-019. Butir bertanda
`[ASSUMED]` harus dicocokkan Pelaksana dengan kode/console; butir bertanda `→ TEKNIS` adalah janji produk
yang harus dikonfirmasi ke handover teknis (`sol-codex`) sebelum UI menjanjikannya.

---

## 0. Keputusan lintas-simpang

| # | Keputusan | Alasan singkat |
|---|---|---|
| K0.1 | **Contoh/placeholder memakai jemaat sintetis**: `https://gereja-anda.worshipdeck.org` (ID) / `https://your-church.worshipdeck.org` (EN). Contoh `bic.worshipdeck.org` di paket **tidak boleh** masuk UI, test, atau fixture. | Repo publik; aturan `public-repository.md`. |
| K0.2 | **Satu istilah**: EN `Workspace` (bukan campur `Workplace`). ID: "workspace cloud" (istilah industri dibiarkan Inggris). Pelaksana mendaftarkannya di `.control/product-glossary.md` lewat jalur yang berlaku. | Paket memakai dua istilah; satu benda satu nama. |
| K0.3 | **Status tidak dibawa emoji.** Pakai ikon SVG + warna + teks. Teks wajib bisa dibaca tanpa warna. | Emoji render tidak konsisten di Windows luring; warna saja gagal untuk buta warna. |
| K0.4 | **Sentence case, tanpa tanda seru, tanpa huruf kapital semua** di teks sumber. Bila desain ingin gaya kapital kecil, lakukan via CSS (`text-transform`), bukan di string. | Kapital semua terbaca "berteriak" dan lebih sulit dibaca. |
| K0.5 | **Ketenangan = bukti konkret, bukan klaim.** Setiap status "siap" selalu menyertakan **waktu sinkron terakhir** dan **jumlah aset terverifikasi**. | "Tersinkronisasi penuh" tanpa waktu tidak menenangkan; "07.42 · 8 aset terverifikasi" menenangkan. |
| K0.6 | **Arah sinkron satu jalur (cloud → FOH).** Ikon tombol `cloud-download` (↓), **bukan** ⇅. | ⇅ menyiratkan dua arah; doktrin hanya menarik. |
| K0.7 | **Waktu memakai format lokal**: ID `07.42`, `Min 07.42`; EN `7:42 AM`, `Sun 7:42 AM`. Hari disebut bila bukan hari ini. | Operator menilai kesegaran dari jam. |

### Janji produk yang harus dijamin teknis (→ TEKNIS)

- **T1 Atomik:** sinkron yang gagal/dibatalkan **tidak pernah** meninggalkan panggung setengah-jadi. Panggung tetap
  memakai snapshot lengkap terakhir sampai snapshot baru selesai terverifikasi. Seluruh wording error di §3
  bergantung pada janji ini. Bila teknis tidak bisa menjamin, wording "data panggung tetap aman" **dilarang**.
- **T2 Lanjut-unduh:** berkas yang sudah lolos checksum disimpan; "Coba lagi" melanjutkan, tidak mengulang dari nol.
  Bila tidak didukung, hapus kalimat "berkas yang sudah terunduh disimpan".
- **T3 Uji koneksi tanpa mengikat:** "Uji koneksi" memverifikasi URL + token **tanpa** membuat pairing, dan
  mengembalikan nama gereja.
- **T4 Deteksi pembaruan:** FOH bisa tahu "cloud punya revisi lebih baru" (minimal saat app dibuka, saat panel dibuka,
  dan berkala ketika daring). Frekuensi ditetapkan teknis.

---

## 1. Simpang 1 — Modal "Hubungkan ke Cloud / Connect to Cloud"

### 1.1 Judul & pengantar

| | ID | EN |
|---|---|---|
| Judul | Hubungkan laptop ini ke cloud | Connect this laptop to the cloud |
| Pengantar | Siapkan ibadah bersama tim di cloud, lalu tarik semuanya ke laptop ini sebelum ibadah. Saat tayang, panggung berjalan tanpa internet. | Your team prepares the service in the cloud. Pull everything to this laptop before the service — the stage then runs without internet. |

### 1.2 Urutan visual (atas → bawah)

1. Judul + pengantar (2 baris maks).
2. **Kotak panduan bernomor** (latar netral, bukan peringatan).
3. Field **Alamat workspace**.
4. Field **Token pairing**.
5. **Area hasil uji** (inline, di bawah field; kosong saat idle).
6. Baris tombol: kiri `Batal` (teks), kanan `Uji koneksi` (sekunder) → `Hubungkan` (primer).

### 1.3 Kotak panduan mendapatkan token

| ID | EN |
|---|---|
| **Cara mendapatkan token** | **How to get a token** |
| 1. Di perangkat mana pun, buka **console.worshipdeck.org** dan masuk sebagai pengelola gereja. | 1. On any device, open **console.worshipdeck.org** and sign in as a church admin. |
| 2. Buka **Perangkat FOH → Buat token pairing**. `[ASSUMED]` | 2. Go to **FOH devices → Create pairing token**. `[ASSUMED]` |
| 3. Salin token, lalu tempel di bawah. Token hanya ditampilkan sekali. | 3. Copy the token and paste it below. It is shown only once. |
| Bukan pengelola? Minta token ke admin gereja Anda. | Not an admin? Ask your church admin for a token. |

`[ASSUMED]` nama menu harus disamakan persis dengan label di console. Domain `console.worshipdeck.org` ditampilkan
sebagai teks (boleh tautan eksternal), **bukan** tombol yang menavigasi app.

### 1.4 Field

**Alamat workspace / Workspace address**
- Placeholder: `https://gereja-anda.worshipdeck.org` / `https://your-church.worshipdeck.org`.
- Helper: "Alamat yang dipakai tim Anda untuk menyiapkan ibadah." / "The address your team uses to prepare services."
- Normalisasi saat blur: terima `gereja-anda`, `gereja-anda.worshipdeck.org`, atau URL penuh → tampilkan bentuk
  `https://gereja-anda.worshipdeck.org`. Buang path/trailing slash. Tolak `http://`.
- Error inline: "Alamat belum lengkap. Contoh: gereja-anda.worshipdeck.org" / "That address looks incomplete. Example: your-church.worshipdeck.org".

**Token pairing / Pairing token**
- Placeholder: `foh_xxxxxxxx.xxxxxxxxxxxxxxxx`.
- Input font monospace, **tersamar** default, tombol ikon `Tampilkan`/`Show` dan `Tempel`/`Paste`.
- Trim spasi/baris baru otomatis (hasil salin sering membawa spasi).
- Validasi format lokal `foh_<id>.<secret>`; error: "Token harus diawali foh_ dan berisi titik. Salin ulang dari console." /
  "Tokens start with foh_ and contain a dot. Copy it again from the console."
- Token **tidak pernah** ditampilkan ulang setelah terhubung, tidak masuk log, tidak ada di toast.

### 1.5 Mikro-interaksi tombol

**Aturan gerbang:** `Hubungkan` **nonaktif sampai `Uji koneksi` berhasil untuk nilai field saat ini.** Mengubah salah
satu field mengembalikan hasil uji ke idle dan menonaktifkan lagi `Hubungkan`. Alasan: operator melihat **nama
gerejanya sendiri** sebelum mengikat laptop — itu titik ketenangan utama dan pencegah salah-workspace.

| State `Uji koneksi` | Tampilan | ID | EN |
|---|---|---|---|
| Nonaktif | field belum valid | — | — |
| Idle | tombol sekunder | Uji koneksi | Test connection |
| Berjalan | spinner di tombol, field read-only | Menguji… | Testing… |
| Berhasil | centang hijau inline di area hasil | Terhubung ke **{Nama Gereja}** · gereja-anda.worshipdeck.org | Reached **{Church Name}** · your-church.worshipdeck.org |
| Gagal | ikon info amber inline (bukan merah) | lihat tabel 1.6 | lihat tabel 1.6 |

Setelah uji berhasil, fokus pindah ke `Hubungkan`.

| State `Hubungkan` | ID | EN |
|---|---|---|
| Idle (aktif) | Hubungkan ke {Nama Gereja} | Connect to {Church Name} |
| Berjalan | Menghubungkan… | Connecting… |
| Berhasil | modal berganti ke **tampilan terhubung** (§1.7) + tawaran sinkron pertama | — |

Tawaran sinkron pertama (di tampilan terhubung, sekali saja):
"Laptop ini sudah terhubung. Tarik data ibadah sekarang?" `[ Sinkronkan sekarang ]` `[ Nanti ]` /
"This laptop is connected. Pull the service data now?" `[ Sync now ]` `[ Later ]`.

### 1.6 Pesan gagal uji/hubungkan

Pola: **apa yang terjadi → apa yang dilakukan**. Kode teknis hanya di "Detail teknis" yang dilipat.

| Penyebab | ID | EN |
|---|---|---|
| Alamat tak terjangkau | Alamat ini tidak bisa dijangkau. Periksa ejaan dan koneksi internet bilik. | We couldn't reach this address. Check the spelling and the booth's internet. |
| Bukan workspace WorshipDeck | Alamat ini bukan workspace WorshipDeck. Pastikan Anda memakai alamat dari tim Anda. | This isn't a WorshipDeck workspace. Make sure you're using your team's address. |
| Token salah/kedaluwarsa/dicabut | Token tidak diterima. Buat token baru di console, lalu tempel lagi. | The token wasn't accepted. Create a new one in the console and paste it again. |
| Token milik workspace lain | Token ini milik workspace lain. Periksa alamat atau minta token yang sesuai. | This token belongs to a different workspace. Check the address or get the matching token. |
| Token sudah dipakai perangkat lain `[ASSUMED]` | Token ini sudah dipakai laptop lain. Buat token baru untuk laptop ini. | This token is already used by another laptop. Create a new token for this one. |
| Cloud error 5xx | Cloud sedang tidak merespons. Ini bukan masalah di laptop Anda — coba lagi sebentar lagi. | The cloud isn't responding right now. It's not your laptop — try again shortly. |

### 1.7 Tampilan terhubung (modal yang sama, isi berganti)

Urutan:
1. Ikon cloud tercentang + **{Nama Gereja}** (teks terbesar di modal).
2. `gereja-anda.worshipdeck.org` (sekunder, monospace boleh).
3. Baris status (sama dengan badge §2, versi panjang), mis. "Siap ibadah · sinkron terakhir Min 07.42".
4. Rincian kecil: "Terhubung sejak 12 Okt 2026" · "Token: foh_ab12…" (prefix id saja).
5. Tombol utama: `Sinkronkan dari cloud` (§3).
6. Paling bawah, terpisah garis: tombol teks destruktif `Putuskan hubungan` / `Disconnect`.

### 1.8 Putuskan hubungan — safety prompt

- **Nonaktif saat panggung tayang**, tooltip: "Tidak bisa diputus saat panggung sedang tayang." / "Can't disconnect while the stage is live."
- **Keputusan produk:** memutus hubungan **tidak menghapus** data lokal. Panggung tetap bisa dipakai dengan data
  sinkron terakhir. Karena dapat dipulihkan (token baru), tidak perlu ketik-konfirmasi; cukup dialog dua tombol.

| | ID | EN |
|---|---|---|
| Judul | Putuskan laptop ini dari {Nama Gereja}? | Disconnect this laptop from {Church Name}? |
| Isi | Laptop ini tidak akan menerima pembaruan dari cloud. Data ibadah yang sudah ada tetap tersimpan dan tetap bisa ditayangkan. Untuk menyambung lagi, Anda perlu token baru dari console. | This laptop will stop receiving cloud updates. Service data already on it stays and can still be presented. To reconnect, you'll need a new token from the console. |
| Tombol | `Batal` (default fokus) · `Putuskan` (destruktif) | `Cancel` (default focus) · `Disconnect` (destructive) |
| Sesudah | toast netral: "Terputus dari {Nama Gereja}. Data lokal tetap tersimpan." | "Disconnected from {Church Name}. Local data is kept." |

Bila teknis memutuskan disconnect **menghapus** data lokal, keputusan ini kembali ke Pengarah (wording dan tingkat
konfirmasi berubah).

---

## 2. Simpang 2 — Badge kesiapan panggung

### 2.1 Koreksi atas usulan paket

- "Siap ibadah **Minggu**" → **"Siap ibadah"**. Ibadah tidak selalu Minggu (Sabtu pemuda, malam Natal, KKR);
  label yang salah hari justru menimbulkan ragu.
- **Belum terhubung ≠ merah.** Doktrin "Offline Stage" berarti laptop tanpa pairing tetap bisa menayangkan konten
  lokal. Merah untuk kondisi ini memicu panik palsu. Belum terhubung = **abu-abu netral**.
- **"Beku" ditolak.** Di telinga operator, "nge-freeze/beku" = aplikasi hang. Pakai **"sinkron dijeda"**.
- Merah dipakai **hanya** untuk kondisi yang memang menuntut tindakan sebelum ibadah.

### 2.2 Daftar state (final)

| # | State | Warna/ikon | Label ID · subteks | Label EN · subteks | Kondisi |
|---|---|---|---|---|---|
| S1 | Siap | hijau · check-circle | **Siap ibadah** · Sinkron Min 07.42 · 8 aset terverifikasi | **Ready for service** · Synced Sun 7:42 AM · 8 assets verified | Terhubung, snapshot lokal lengkap & terverifikasi, tidak ada revisi cloud lebih baru yang diketahui |
| S1b | Siap, cloud tak terjangkau | hijau · check-circle + titik abu | **Siap ibadah** · Memakai sinkron Min 07.42 · cloud tidak terjangkau | **Ready for service** · Using sync from Sun 7:42 AM · cloud unreachable | Seperti S1 tetapi cek pembaruan gagal karena luring. Jujur: tidak mengklaim "terbaru" |
| S2 | Ada pembaruan | amber · cloud-arrow-down | **Ada pembaruan di cloud** · Sinkron terakhir Sab 20.15 | **Updates in the cloud** · Last synced Sat 8:15 PM | Revisi cloud lebih baru dari snapshot lokal |
| S2b | Belum pernah sinkron | amber · cloud-arrow-down | **Belum disinkronkan** · Tarik data ibadah sebelum tayang | **Not synced yet** · Pull service data before going live | Terhubung tapi belum ada snapshot |
| S3 | Sinkron terhenti | amber · alert-triangle | **Sinkron belum tuntas** · Memakai data Sab 20.15 | **Sync didn't finish** · Using data from Sat 8:15 PM | Sinkron terakhir gagal/batal; snapshot sebelumnya utuh (T1) |
| S4 | Perlu perhatian | merah · alert-octagon | **Perlu perhatian** · Akses laptop dicabut / Aset hilang di laptop | **Needs attention** · Laptop access revoked / Assets missing on this laptop | Token dicabut, ATAU snapshot lokal rusak/tidak lengkap. Satu subteks per penyebab |
| S5 | Sedang sinkron | biru · spinner | **Menyinkronkan…** · Aset 3 dari 8 | **Syncing…** · Asset 3 of 8 | Proses berjalan |
| S6 | Panggung tayang | biru tua/ungu · lock | **Panggung tayang** · Sinkron dijeda | **Live** · Sync paused | Presenter aktif. Bila ada revisi cloud: subteks "Sinkron dijeda · ada pembaruan menunggu" / "Sync paused · updates waiting" |
| S0 | Belum terhubung | abu-abu · cloud-off | **Belum terhubung ke cloud** · Konten lokal tetap bisa ditayangkan | **Not connected to cloud** · Local content can still be presented | Belum ada pairing |

### 2.3 Prioritas bila kondisi tumpang tindih

`S6 Tayang` > `S5 Sinkron` > `S4 Perlu perhatian` > `S3 Terhenti` > `S2/S2b Pembaruan` > `S1b` > `S1` ; `S0` berdiri sendiri.

### 2.4 Perilaku & aksesibilitas

- Badge di header operator shell, kanan; lebar tetap secukupnya agar header tidak melompat saat state berganti.
  Versi ringkas (label saja) di header; subteks tampil di tooltip **dan** di popover.
- Badge **dapat diklik** → popover/panel berisi baris status panjang + tombol `Sinkronkan dari cloud` (§3), atau
  `Hubungkan ke cloud` saat S0.
- `role="status"` + `aria-live="polite"`; perubahan ke S4 boleh `assertive`. Teks label selalu terbaca screen reader;
  ikon `aria-hidden`.
- Kontras teks badge memenuhi 4.5:1 di kedua tema (validasi penuh tetap butuh uji manual).
- Tidak berkedip/berdenyut kecuali S5 (spinner), dan hormati `prefers-reduced-motion`.

---

## 3. Simpang 3 — Tombol sinkron & umpan balik

### 3.1 Tombol

| | ID | EN |
|---|---|---|
| Label | Sinkronkan dari cloud | Sync from cloud |
| Ikon | cloud-download (↓), bukan ⇅ | sama |
| Penekanan | **primer** saat S2/S2b/S3; **sekunder** saat S1/S1b | sama |
| Nonaktif S6 | tooltip: "Sinkron dijeda selama panggung tayang. Lanjutkan setelah ibadah." | "Sync is paused while live. Continue after the service." |
| Nonaktif S0 | diganti tombol `Hubungkan ke cloud` | `Connect to cloud` |

Lokasi: popover badge dan tampilan terhubung (§1.7). Tidak perlu tombol ketiga di tempat lain.

### 3.2 Fase umpan balik (inline di popover/panel, bukan modal penghalang)

| Fase | Visual | ID | EN |
|---|---|---|---|
| 0 Cek | spinner | Memeriksa pembaruan… | Checking for updates… |
| 1 Data | spinner (indeterminate) | Mengambil liturgi dan lagu… | Fetching liturgy and songs… |
| 2 Media | progress bar **berbasis byte**; label hitungan + ukuran | Mengunduh media 3 dari 8 · 124 dari 310 MB | Downloading media 3 of 8 · 124 of 310 MB |
| 2b Verifikasi | bar penuh, spinner kecil | Memeriksa keutuhan berkas… | Checking files… |
| 3 Terapkan | spinner singkat | Menyiapkan panggung… | Preparing the stage… |
| Selesai | centang hijau (animasi ≤ 400 ms, reduced-motion = statis) + toast 4 detik + badge → S1 | Siap ibadah · 8 aset terverifikasi · 07.42 | Ready for service · 8 assets verified · 7:42 AM |
| Tak ada perubahan | toast netral | Sudah yang terbaru. Sinkron 07.42. | Already up to date. Synced 7:42 AM. |

Catatan:
- Bar berbasis **byte**, bukan jumlah berkas: satu video besar membuat "3 dari 8" tampak macet.
- "Checksum" tidak muncul di UI; operator cukup tahu berkas diperiksa utuh.
- Tombol `Batalkan` / `Cancel` tersedia di fase 0–2. Konfirmasi tidak perlu; toast: "Sinkron dibatalkan. Panggung
  memakai data Sab 20.15." (bergantung T1).
- Operator tetap bisa menelusuri app selama sinkron. Bila operator **mulai tayang** saat sinkron berjalan: sinkron
  dijeda otomatis, panggung memakai snapshot sebelumnya, badge → S6 "Sinkron dijeda · ada pembaruan menunggu".
  Tidak ada dialog penghalang di momen tayang.

### 3.3 Pesan gagal yang menenangkan

Pola tetap: **(1) keselamatan dulu → (2) apa yang terjadi, spesifik → (3) satu langkah berikut.**
Tanpa "Gagal!", tanpa kode di depan, tanpa merah untuk gangguan jaringan biasa (amber). Kode/teknis di lipatan
"Detail teknis" untuk tim pendukung.

| Kasus | Judul ID | Isi ID | Judul EN | Isi EN | Aksi |
|---|---|---|---|---|---|
| Internet putus di tengah (ada snapshot) | Sinkron terhenti — panggung tetap aman | Koneksi internet terputus saat mengunduh media (5 dari 8). Panggung tetap memakai data Sab 20.15 dan siap dipakai. Berkas yang sudah terunduh disimpan; coba lagi saat koneksi pulih. | Sync stopped — the stage is safe | The internet dropped while downloading media (5 of 8). The stage is still using data from Sat 8:15 PM and is ready. Downloaded files are kept; try again when you're back online. | `Coba lagi` · `Tutup` |
| Internet putus, belum pernah sinkron | Sinkron terhenti | Laptop ini belum punya data dari cloud. Periksa internet bilik lalu coba lagi. Konten lokal tetap bisa ditayangkan bila diperlukan. | Sync stopped | This laptop has no cloud data yet. Check the booth's internet and try again. Local content can still be presented if needed. | `Coba lagi` · `Tutup` |
| Berkas rusak setelah 2× ulang otomatis | Satu berkas belum bisa diunduh utuh | "{nama berkas}" rusak saat diunduh. Berkas lain sudah siap; panggung tetap memakai data Sab 20.15. Coba lagi, atau minta tim mengunggah ulang berkas itu. | One file couldn't be downloaded intact | "{file name}" arrived damaged. Everything else is ready; the stage is still using data from Sat 8:15 PM. Try again, or ask your team to re-upload that file. | `Coba lagi` · `Tutup` |
| Ruang disk kurang | Ruang penyimpanan tidak cukup | Pembaruan butuh 310 MB, tersedia 120 MB. Panggung tetap memakai data Sab 20.15. Kosongkan ruang lalu coba lagi. | Not enough storage | This update needs 310 MB; 120 MB is free. The stage is still using data from Sat 8:15 PM. Free up space and try again. | `Coba lagi` · `Tutup` |
| Cloud 5xx | Cloud sedang tidak merespons | Ini bukan masalah di laptop Anda. Panggung tetap memakai data Sab 20.15. Coba lagi beberapa menit lagi. | The cloud isn't responding | It's not your laptop. The stage is still using data from Sat 8:15 PM. Try again in a few minutes. | `Coba lagi` · `Tutup` |
| Token dicabut (badge S4) | Akses laptop ini dicabut | {Nama Gereja} tidak lagi mengizinkan laptop ini menerima pembaruan. Data yang sudah ada tetap bisa ditayangkan. Minta token baru ke pengelola di console.worshipdeck.org. | This laptop's access was revoked | {Church Name} no longer lets this laptop receive updates. Existing data can still be presented. Ask an admin for a new token at console.worshipdeck.org. | `Hubungkan ulang` · `Tutup` |

Aturan tampilan error:
- Muncul **inline di panel sinkron** dan badge berganti ke S3/S4; **bukan** modal yang menutup layar operator.
- Error tidak hilang sendiri (beda dengan toast sukses); ditutup operator atau tergantikan sinkron berhasil.
- Semua timestamp di pesan adalah waktu snapshot yang **sedang dipakai panggung**, agar operator tahu persis apa
  yang akan tayang.

---

## 4. Ringkasan untuk Pelaksana

- Keputusan Simpang 1–3 di atas **mengikat** untuk wording dan hirarki visual; tata letak piksel bebas mengikuti
  design system yang ada.
- Sebelum implementasi, Pelaksana **wajib** mengonfirmasi T1–T4 ke handover teknis. Bila T1 tidak terjamin, kalimat
  "panggung tetap aman / tetap memakai data …" tidak boleh dipakai dan simpang ini kembali ke Pengarah.
- Butir `[ASSUMED]`: nama menu console (§1.3), aturan satu-token-satu-laptop (§1.6).
- Simpang yang tidak dijawab di sini (di luar paket): copy di sisi `console.worshipdeck.org` untuk membuat token.

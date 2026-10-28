Ketiga simpang di paket sudah saya jawab. Jawabannya ada di `.work/wdi-captain/spec-123/handover/opus/01-produk-dan-uiux-jawaban.md`, berisi wording ID/EN, urutan visual, dan rincian tiap state. Saya tidak membaca repo dan tidak menulis kode, sesuai batas peran Pengarah.

Ada lima koreksi atas usulan di paket:
- **Contoh `bic.worshipdeck.org` tidak boleh dipakai.** Repo ini publik, jadi placeholder memakai jemaat sintetis: `gereja-anda.worshipdeck.org` / `your-church.worshipdeck.org`.
- **"Siap ibadah Minggu" menjadi "Siap ibadah".** Ibadah tidak selalu hari Minggu.
- **"Belum terhubung" berwarna abu-abu, bukan merah.** Menurut doktrin Offline Stage, laptop tanpa pairing tetap bisa menayangkan konten lokal. Merah hanya untuk akses yang dicabut atau aset rusak.
- **"Beku" menjadi "Sinkron dijeda".** Bagi operator, "beku" terdengar seperti aplikasi hang.
- **Ikon tombol sinkron ↓ (cloud-download), bukan ⇅.** Sinkronnya satu arah, dari cloud ke FOH.

Keputusan lain yang perlu diketahui:
- **Hubungkan menunggu Uji koneksi.** Tombol Hubungkan baru aktif setelah Uji koneksi berhasil. Dengan begitu operator melihat nama gerejanya sendiri sebelum laptop terikat.
- **Putuskan hubungan tidak menghapus data lokal.** Cukup dialog dua tombol, dan tombolnya nonaktif saat panggung tayang.
- **Badge punya 9 state** (S0–S6, termasuk S1b dan S2b) dengan urutan prioritas. Setiap status "siap" selalu menyertakan jam sinkron terakhir dan jumlah aset terverifikasi.
- **Pesan gagal mengikuti satu pola:** keselamatan dulu, lalu apa yang terjadi, lalu satu langkah berikut. Pesannya tampil di panel, bukan modal, dan gangguan jaringan biasa berwarna amber.

**Yang sudah dilakukan:** Simpang 1–3 sudah diputuskan dan berkas jawaban sudah ditulis di folder handover.
**Yang tertahan/belum pasti:** Wording keselamatan bergantung pada janji teknis T1–T4. Yang terpenting T1: sinkron yang gagal tidak boleh meninggalkan panggung setengah jadi. Nama menu di console dan aturan satu token untuk satu laptop masih `[ASSUMED]`.
**Langkah berikutnya:** `geminiflash` mengonfirmasi T1–T4 lewat handover teknis (`sol-codex`), lalu menulis komponen React berdasarkan jawaban ini.

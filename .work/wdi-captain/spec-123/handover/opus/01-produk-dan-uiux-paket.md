# Paket Pengarahan: Produk, Visual UI/UX & Wording FOH Sync (SPEC-123)

**Pengarah:** Claude Opus 5.5 (`opus`)  
**Mode:** paket  
**Pelaksana:** Gemini Flash (`geminiflash` / sesi `worship-deck-c8`)  
**Topik:** Wording, Visual UI/UX Modal Pairing, dan Sunday Stage Readiness Indicator Badge di Bilik FOH.  
**Rujukan SSOT:**
- `ODR-019` (Arsitektur SaaS Hybrid Multi-Tenant: Doktrin "Cloud Prep, Offline Stage")
- `SPEC-123` (`.scratch/SPEC-123-foh-cloud-pairing-and-delta-sync-client/SPEC.md`)
- `handover-teknis-admin-dan-web.md` §1.3

---

## 1. Keputusan Pemilik yang Sudah Mengikat (Tidak Dibuka Ulang)

1. **Doktrin "Cloud Prep, Offline Stage"**:
   - Persiapan ibadah kolaboratif di cloud `{slug}.worshipdeck.org`.
   - Minggu pagi: satu tombol di laptop FOH untuk menyinkronkan seluruh database dan aset lokal.
   - Panggung 100% luring saat ibadah.
2. **Kredensial FOH Pairing**:
   - Pairing token berformat `foh_<id>.<secret>`.
   - Diinput sekali pada laptop FOH bilik multimedia gereja.
3. **Indikator Kesiapan Panggung**:
   - Menampilkan status kesiapan yang memberi ketenangan batin (*peace of mind*) bagi operator dan pelayan multimedia Minggu pagi.

---

## 2. Simpang Produk & Wording UI/UX untuk Claude Opus 5.5

Mohon Claude Opus 5.5 menetapkan **Keputusan Produk, Wording Bilingual (ID/EN), dan Hirarki Visual UI/UX** untuk:

### Simpang 1: Dialog/Modal "Cloud Workplace Pairing"
- Bagaimana tata letak dan wording form input:
  - Label dan placeholder URL cloud instance (contoh: `https://bic.worshipdeck.org`).
  - Label dan placeholder Pairing Token (`foh_...`).
  - Teks instruksi: bagaimana memandu operator FOH mendapatkan token ini dari portal konsol pengelola (`console.worshipdeck.org`).
- Bagaimana mikro-interaksi tombol:
  - Tombol `[ Uji Koneksi / Test Connection ]`.
  - Tombol aksi utama `[ Hubungkan ke Cloud / Connect Workplace ]`.
  - Keadaan saat pairing aktif: menampilkan Nama Gereja, domain, status koneksi, dan tombol `[ Putus Hubungan / Disconnect ]` dengan konfirmasi keselamatan (*safety prompt*).

### Simpang 2: Sunday Stage Readiness Status Indicator Badge
- Di bilik operator FOH (header/operator shell), terdapat status badge kesiapan panggung Minggu pagi.
- Mohon rumuskan badge states dan copywriting-nya yang menenangkan:
  - **State 1 (Hijau - Siap)**: Apa wording yang paling tepat? Usulan: `🟢 SIAP IBADAH MINGGU` (subtext: `Tersinkronisasi penuh`).
  - **State 2 (Kuning - Pending)**: Wording saat cloud memiliki update baru atau sync belum dilakukan. Usulan: `🟡 PERLU SINKRONISASI` (subtext: `Ada perubahan di cloud`).
  - **State 3 (Merah - Unpaired/Offline)**: Wording saat belum terhubung. Usulan: `🔴 BELUM TERHUBUNG CLOUD`.
  - **State 4 (Terkunci - Freeze)**: Wording saat panggung sedang aktif menayangkan ibadah sehingga sync dibekukan demi kestabilan. Usulan: `🔒 PANGGUNG AKTIF (BEKU)`.

### Simpang 3: Tombol Pemicu & Feedback Sinkronisasi
- Desain tombol pemicu utama di bilik FOH:
  - Label tombol: `[ ⇅ Sinkronkan dari Cloud ]` / `[ ⇅ Sync from Cloud ]`.
  - Feedback visual selama proses berjalan:
    - Fase 1: Menarik data liturgi & lagu (spinner).
    - Fase 2: Mengunduh media & verifikasi checksum (progress bar: `Mengunduh aset 3 dari 8...`).
    - Fase 3: Selesai dengan toast / animasi centang hijau.
- Penanganan jika sync gagal (misal internet bilik terputus di tengah jalan):
  - Pesan error apa yang menenangkan operator agar tidak panik saat Minggu pagi menjelang ibadah?

---

## 3. Batas Penulisan Pengarah

Sesuai Playbook § 7a dan § 10d:
- Pengarah **menjawab simpang di atas secara terstruktur** (rekomendasi wording ID/EN, microcopy, visual state breakdown).
- Pengarah **TIDAK menulis file implementasi React atau CSS utuh**.
- Pelaksana (`geminiflash`) yang akan menulis komponen React berdasarkan keputusan Opus.

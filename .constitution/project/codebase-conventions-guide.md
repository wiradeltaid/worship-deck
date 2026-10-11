---
status: Accepted
ratified_by: 5903b59
---

# conventions — codebase guide

**Loaded when:** writing or reviewing code.

## WDI Engineering Playbook Integration

Proyek WorshipDeck ini mengadopsi Single Source of Truth (SSOT) rekayasa terpusat WDI:
- **Konvensi Inti (`03-essential-conventions.md`):** Tiga lapis penegakan `[L1-Tool]`, `[L2-Guard]`, `[L3-Review]`.
- **Backend & Jaringan Lokal (`stack/go.md` & `03`):**
  - Loopback binding eksklusif (`127.0.0.1`) pada listener presenter lokal (`[L2-Guard]`).
  - Dinamis port hunting tanpa kegagalan saat port terpakai.
  - Pembungkusan error kontekstual `%w` dan fail-closed boot configuration.
- **Frontend & Presentasi Realtime (`stack/react-typescript.md` & `05`):**
  - Heartbeat terikat dan tri-state liveness evaluation (`never-opened`, `live`, `lost`).
  - Safe object URL revocation pada media cache dan cleanup effect listeners.

## Mandatory Bilingual i18n & UI Chrome Separation (WDI Playbook 07 § 4)

- **Pemisahan Kamus i18n Terjaga `[L2-Guard]`:** Seluruh string antarmuka pengguna (UI chrome) operator dan admin WAJIB dipisahkan ke dalam kamus `src/lib/i18n/keys.ts`, `catalogue-en.ts`, dan `catalogue-id.ts` dengan paritas bilingual 100% (Inggris dan Bahasa Indonesia) yang diverifikasi otomatis melalui guard `tests/bilingual-i18n-parity.test.mjs`.
- **Larangan Teks Mentah (Raw String Prohibition) `[L2-Guard]`:** Komponen operator dan admin DILARANG menyematkan string teks terlihat pengguna mentah (hardcoded text) secara langsung dalam JSX; seluruh teks terlihat WAJIB dikonsumsi melalui hook `useT().t(key, params)` dengan dukungan interpolasi token `{variable}`.
- **Batasan Pengecualian Eksplisit:**
  - Konten dinamis database yang dimasukkan langsung oleh pengguna (judul lagu khusus, nama jemaat, tanggal ibadah spesifik).
  - Korpus statis Alkitab dan buku lagu pujian (`bible_verses`, `hymns`).
  - Rute proyeksi layar jemaat (`/projector`, `/slideshow`) yang independen terhadap locale bahasa antarmuka operator demi menjaga konsistensi tampilan panggung.

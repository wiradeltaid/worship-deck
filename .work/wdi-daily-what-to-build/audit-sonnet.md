# Audit Keselarasan SPEC-46 vs Prompting Asli — Hasil Review

Saya sudah membaca ulang verbatim Prompting 1 & 2, `SPEC.md`, dan keenam tiket (01–06) baris demi baris. Berikut jawaban untuk ketiga pertanyaan audit.

---

## 1. Kelengkapan Fitur (Feature Completeness)

### 🔴 Temuan Kritis #1 — Lokasi pengelolaan layout TIDAK sesuai prompt user
User menulis eksplisit: *"...disinilah kita kelola layout visual dari worship new/edit... bagaimana layoutingnya, adalah diatur dimenu ini."* — "menu ini" merujuk ke konteks form worship new/edit itu sendiri (RunSheetPage/EditForm/CreateForm), bukan menu Settings terpisah.

Namun implementasi di draf saat ini:
- Tiket 05 (`EditForm.tsx`/`CreateForm.tsx`) **hanya mengonsumsi** layout (fetch & render), tidak ada mode "Kelola Layout Visual" in-place.
- Seluruh CRUD layout (create/edit/reorder/delete grouping & slot) dipindah 100% ke `/admin/form-layout` dan `/admin/predefined-fields` di bawah **Settings** (SPEC poin 9, Tiket 06).

Ini adalah pergeseran keputusan arsitektur yang signifikan dari kata-kata user, dan **tidak didokumentasikan sebagai keputusan sadar** (tidak ada DEC- atau catatan asumsi yang menjelaskan mengapa lokasi dipindah ke Settings). Ini harus dikonfirmasi ulang ke user sebelum lanjut ke tiket — apakah Admin Layout Builder terpisah di Settings sudah cukup, atau user memang menginginkan toggle "Customize Layout" langsung di halaman form worship new/edit.

### 🟡 Temuan #2 — Kontradiksi internal prompt soal "4 Tipe" belum diberi keputusan eksplisit
Prompt user sendiri mengandung kontradiksi:
- Awal prompt: *"Announcement set itu sendiri bukanlah predefined field, karena purpose dia adalah inserted di main spine/sequence."*
- Akhir prompt: *"Type = text, text area, image, announcement slot."* (menyebut 4 tipe termasuk announcement slot)

Draf SPEC/Tiket 01 menyelesaikan ini dengan memisahkan `predefined_fields.field_type` (3 nilai: text/text_area/image) dari `form_group_slots.widget_kind` (3 nilai: predefined_field/song_set_entry/announcement_slot). Ini adalah resolusi yang **masuk akal dan konsisten** dengan niat user yang lebih eksplisit (announcement bukan predefined field), **tapi keputusan ini tidak pernah ditulis sebagai keputusan yang disengaja** di SPEC — pembaca lain bisa menganggapnya sebagai kelalaian, bukan pilihan sadar. Rekomendasi: tambahkan satu kalimat penjelas di SPEC (atau DEC-) yang menyatakan secara eksplisit bahwa ini adalah resolusi atas ambiguitas di prompt asli.

### 🔴 Temuan Kritis #3 — Field seeder "Verse Reading Text" HILANG dari daftar seed_key
User memberi contoh sangat spesifik dua field seeder berpasangan:
1. *"Verse Reading Reference... Type = Text, length = 100."*
2. *"Verse Reading Text... Type = Text Area, initial line = 5."*

SPEC bagian 8 dan Tiket 01 hanya mendaftarkan seed key:
```
default.verse_reference, default.sermon_speaker, default.sermon_graphic,
default.family_photo, default.family_name, default.family_request,
default.youth_photo, default.youth_name, default.youth_request,
default.closing_prayer
```
**Tidak ada `default.verse_reading_text` / `default.scripture_text`.** Ini bukan sekadar poin yang terlewat di dokumen — ini konsekuensial secara fungsional: SPEC bagian 5 (backfill) memetakan `verseReading.text -> scripture_text`, artinya sistem *mengharapkan* ada predefined field bernama `scripture_text`, tapi seeder tidak pernah membuatnya. Hasilnya: instalasi baru tidak akan memiliki field "Verse Reading Text" secara default, dan data backfill dari layanan lama untuk `scripture_text` akan tersimpan di `service_field_values` tanpa ada slot/grouping manapun yang menampilkannya — nilainya "hilang" secara visual bagi operator, padahal user secara eksplisit meminta field ini ada di seeder.

### 🟢 Poin lain — sudah sesuai
- **Lokasi default layout** (Rundown top-left, Live Preview top-right, sisanya configurable di bawah) → cocok persis (SPEC Implementation Decision 1; Tiket 05).
- **3 widget kind** (predefined_field, song_set_entry, announcement_slot) dan sumber dinamis dari song book → cocok (SPEC Solution poin 1; Tiket 01/04/05).
- **Layout 3 kolom image** (preview | choose file+paste link | upload/download) → cocok persis kata-per-kata (SPEC poin 3; Tiket 05).
- **Regex per-entry song set** dan **regex per field text** → cocok (SPEC poin 3 & 7; Tiket 04).
- **Pengecualian hardcoded hanya tanggal & judul worship** → cocok persis (SPEC Implementation Decision 1: *"Service Date... and Worship Title/Header remain standard and hardcoded, excluded from dynamic field extraction."*).
- **Tombol "Seed Default Predefined Field" adaptif, gap-filling, non-destructive** → cocok (SPEC poin 8; Tiket 01 pakai `ON CONFLICT(seed_key) DO NOTHING`).
- **Larangan regex untuk field image** ("kecuali gambar, gambar tidak bisa") — disebut implisit lewat pemisahan `field_type=image` tanpa `extraction_regex` yang bermakna, **tapi tidak ada validasi eksplisit** yang menolak pengisian `extraction_regex` saat `field_type=image`. Ini gap kecil yang perlu ditambahkan sebagai aturan validasi tertulis di Tiket 01/04.

---

## 2. Integritas ("Jangan membuat broken apa yang sudah bagus")

Secara umum draf ini **cukup hati-hati** dan sudah mengantisipasi non-regresi dengan baik:

- **Layanan lama (backward compatibility):** Tiket 02 punya dual-read fallback (`service_field_values` kosong → fallback ke `parsed_data`/`images_payload`) + backfill migration 17 key lengkap + urutan presedensi jelas (manual edit > regex proposal > backfill legacy). Ini solid.
- **Slide plan hydration & PPTX:** Tiket 03 eksplisit mempertahankan kontrak DEC-004 S5 (token tak dikenal → warning saat save, tapi render string kosong saat presentasi live, tidak crash), dan mewajibkan test "100% identical slide plans and PPTX decks" untuk layanan existing. Ini langsung menjawab kekhawatiran di pertanyaan audit.
- **PR #83 / SPEC-45 (slot pengumuman):** Secara eksplisit disebut dua kali — SPEC Implementation Decision 8 dan Tiket 05 — memastikan `initialAnnouncementInserts` tetap di-pass, dan `AnnouncementSlotRenderer` tetap `flex flex-col gap-4` (bukan `sm:grid-cols-2`) sesuai absence guard di `tests/smoke-spec-45.test.mjs`. Ini penanganan yang sangat spesifik dan tepat sasaran.
- **Isolasi historis:** `service_form_layout_snapshots` (Implementation Decision 7) melindungi layanan lama dari perubahan layout admin di masa depan — ini adalah tambahan yang **tidak diminta secara literal oleh user**, tapi justified karena langsung melayani syarat "jangan merusak yang sudah bagus" yang ditanyakan di audit ini sendiri. Bukan scope-creep, ini kebutuhan turunan yang wajar.
- **Absence guard dengan proof-of-failure:** Tiket 06 eksplisit meminta inject-defect → RED → revert → GREEN, sesuai kebijakan `AGENTS.md` proyek ini soal absence guard.

### 🟡 Risiko teknis yang belum dijamin (bukan dari prompt user, tapi ditemukan saat audit desain skema)
Tiket 01 mendeklarasikan constraint:
> `UNIQUE(layout_id, widget_kind, ref_key)` pada tabel `form_group_slots`

Tapi kolom yang didaftarkan di tabel `form_group_slots` **tidak memiliki** `layout_id` (hanya `grouping_id`) maupun `ref_key` (hanya `field_id` / `song_set_variable_name` / `announcement_slot` sebagai tiga kolom terpisah). Constraint ini seperti yang tertulis **tidak bisa diimplementasikan langsung** sebagai `UNIQUE` di SQLite tanpa denormalisasi `layout_id` ke tabel ini, dan tanpa mendefinisikan `ref_key` yang sebenarnya. Ini berisiko membuat Implementation Decision 2 SPEC ("Each song set entry or announcement slot (1..4) can be placed at most once within an active layout") **tidak benar-benar ditegakkan di level database** kecuali tiket 01 diperbaiki sebelum implementasi dimulai.

---

## 3. Koreksi & Rekomendasi Konkret

Urutan berdasarkan prioritas:

1. **[Wajib, blocking]** Tambahkan seed key `default.verse_reading_text` (target `scripture_text`, `field_type=text_area`, `initial_lines=5`) ke daftar seeder di SPEC poin 8 dan Tiket 01, dipasangkan dengan `default.verse_reference` yang sudah ada. Tanpa ini, permintaan eksplisit user tidak akan pernah muncul di instalasi baru.
2. **[Wajib, klarifikasi ke user]** Konfirmasi ulang lokasi pengelolaan layout: apakah Admin Layout Builder di Settings (Tiket 06) cukup, atau perlu ditambahkan entry point "Customize Layout" langsung di `RunSheetPage`/`EditForm`/`CreateForm` (Tiket 05) sesuai kalimat *"diatur dimenu ini"*. Ini keputusan arsitektur yang sebaiknya dicatat lewat `wdi-decision` sebelum tiket 05/06 dieksekusi.
3. **[Perbaikan skema]** Perbaiki Tiket 01: ganti deskripsi constraint `UNIQUE(layout_id, widget_kind, ref_key)` dengan salah satu dari (a) denormalisasi kolom `layout_id` ke `form_group_slots` + partial unique index per `widget_kind`, atau (b) nyatakan eksplisit bahwa cardinality itu ditegakkan di service-layer/API mutation, bukan constraint DB murni.
4. **[Perbaikan minor]** Tambahkan mapping eksplisit seed_key → variable_name kanonis di Tiket 01 supaya selaras 1:1 dengan tabel backfill di SPEC poin 5 (mis. `default.verse_reference` → `scripture_reference`). Pertimbangkan juga apakah `sermon_title` perlu seed_key sendiri, karena ada di tabel backfill (poin 5) tapi tidak ada di daftar seeder (poin 8).
5. **[Perbaikan minor]** Tambahkan aturan validasi eksplisit: `extraction_regex` harus kosong/null ketika `field_type = image`, sesuai *"kecuali gambar, gambar tidak bisa [diberi regex]"* — saat ini hanya tersirat, belum jadi aturan tertulis di Tiket 01/04.
6. **[Kosmetik, opsional]** Selaraskan copy tombol: prompt asli "Seed Default Predefined Field" (tunggal) vs SPEC/Tiket "Seed Default Predefined Fields" (jamak) — dampak sangat kecil, boleh diabaikan atau disamakan saat implementasi UI.

---

**Kesimpulan:** Draf SPEC-46 dan Tiket 01–06 sudah menangkap ±90% dari maksud user dengan sangat presisi (widget kind, regex per-entry, 3 kolom image, invariant top-left/top-right, pengecualian hardcoded tanggal/judul, seeder non-destructive). Namun ada **satu gap fungsional konkret** (field seeder "Verse Reading Text" hilang) dan **satu ketidaksesuaian lokasi fitur** (layout dikelola di Settings, bukan in-place di form worship) yang sebaiknya diklarifikasi ke user sebelum tiket-tiket ini dieksekusi, plus satu risiko desain skema (`UNIQUE` constraint yang tidak match kolom aktual) yang perlu diperbaiki di level tiket sebelum implementasi dimulai.

---

**Yang dilakukan:** Membaca `VERIFY-PROMPTING-ALIGNMENT.md`, `SPEC.md`, dan tiket 01–06 secara menyeluruh, lalu memetakan setiap klausa di Prompting 1 & 2 terhadap draf dokumen untuk menjawab ketiga pertanyaan audit.
**Yang belum pasti:** Apakah pergeseran lokasi UI layout builder ke Settings adalah keputusan sadar tim (Terra/Composer/Sonnet) yang belum tercatat, atau memang kelalaian — perlu konfirmasi user.
**Langkah selanjutnya:** Menunggu keputusan user soal 3 temuan kritis di atas (seed key hilang, lokasi UI layout, constraint skema) sebelum SPEC-46 dan tiketnya dianggap final untuk `wdi-build`.

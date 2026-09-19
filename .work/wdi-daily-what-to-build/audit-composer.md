# Penilaian Audit Keselarasan: Prompting Asli vs Draf SPEC-46 (Tiket 01–06)

**Verdict:** `accept-with-changes` — arsitektur inti sudah sangat dekat dengan visi user, tetapi beberapa poin verbatim (lokasi pengelolaan layout, manifest seeder, kontrak regex/hardcode, snapshot layanan lama, dan beberapa celah schema/migrasi) belum cukup presisi untuk dianggap 100% selaras atau 100% aman terhadap baseline SPEC-45/DEC-004.

Sumber yang dibaca: `VERIFY-PROMPTING-ALIGNMENT.md`, `SPEC.md`, tiket `01`–`06`, `PROMPT-CONFIGURABLE-LAYOUT.md`, `response-composer-v2.md`, serta cross-check singkat ke `worship-form-fields.ts`, `placeholder-catalog.ts`, dan `smoke-spec-45.test.mjs`.

---

## 1. Kelengkapan fitur terhadap Prompting 1 dan 2

### 1.1 Ringkasan keselarasan (yang sudah tepat)

| Intensi user | Bukti di SPEC/tiket | Penilaian |
|---|---|---|
| Shell tetap: rundown kiri atas, Live Slide Preview kanan atas (sticky) | SPEC §Implementation Decisions #1; tiket 05 §fixed top; tiket 06 smoke guard | **Selaras** |
| Area di bawah rundown = grouping yang menjadi `<Card>` | `form_groupings`, `form_group_slots`, `DynamicFormBody` | **Selaras** |
| Grouping bisa memuat song set A/B/D, kombinasi lain, atau Announcement Weekly Slot 1 di “Afternoon Program” | Tiga `widget_kind`; contoh user tercermin di user stories | **Selaras secara model** |
| Announcement set = 4 slot, bukan “predefined field” biasa; tetap urutan spine | `announcement_slot` sebagai widget, bukan `field_type`; pemisahan form vs deck sequence | **Selaras** (model lebih tepat dari literal “4 tipe di tabel predefined”) |
| `text` / `text area` / `image` + properti visual (`length`, `initial line`) | `input_length`, `initial_lines`, renderer khusus | **Selaras** |
| Image: 3 kolom (preview \| file/URL \| upload & download) | SPEC §3; tiket 05 `ImageThreeColumnRenderer` | **Selaras** |
| Setiap predefined text punya regex ekstraksi; image tidak | `extraction_regex`; pengecualian image | **Selaras** |
| Setiap baris song set punya regex sendiri (nomor + buku) | `song_set_entries.extraction_regex`, endpoint admin, tiket 04 | **Selaras** |
| Tanggal + judul worship tetap standar/hardcoded (Prompt 2) | SPEC menyebut `service_date` dan Worship Title/Header dikecualikan dari dynamic extraction | **Selaras secara eksplisit** untuk pasangan itu |
| Seeder adaptif + tombol “Seed Default…” | `seed_key`, `ON CONFLICT DO NOTHING`, endpoint `seed-defaults` | **Selaras pada prinsip** |
| Token slide dinamis `{variable_name}` | Tiket 03 | **Selaras** |
| Jangan rusak yang sudah bagus (deck, PPTX, announcement) | Pemisahan layout vs registry; referensi SPEC-45; `song_set_inputs` tetap SSOT | **Arah benar**, bukti belum lengkap (lihat §2) |

### 1.2 Temuan gap / distorsi (per item audit VERIFY)

#### A. Lokasi “kelola layout visual” di worship new/edit — **blocking (interpretasi produk)**

User (Prompt 1): *“Justru kalau dalam konsep worship presenter view, disinilah kita kelola layout visual dari worship new/edit”* dan *“bagaimana layoutingnya, adalah diatur dimenu ini.”*

Draf saat ini menempatkan **seluruh** pembangun layout di Settings admin (`/admin/form-layout`, `/admin/predefined-fields` — SPEC §9, tiket 06). `EditForm`/`CreateForm` hanya **merender** layout aktif atau snapshot (tiket 05).

Ini memenuhi “form bisa dikonfigurasi per gereja”, tetapi **belum memenuhi** makna “di sini” = dalam konteks layar worship new/edit. Diskusi arsitektur Composer v2 justru merekomendasikan admin terpisah dengan kompromi “Customize layout” tersembunyi; kompromi itu **belum masuk** SPEC/tiket.

**Koreksi yang disarankan:** Tambah FR/acceptance criterion: admin (role-gated) membuka mode **“Kelola layout visual”** dari `CreateForm`/`EditForm` (mode in-place, drawer, atau dialog) yang menampilkan susunan card seperti yang operator lihat; `/admin/form-layout` boleh tetap sebagai halaman penuh, bukan satu-satunya pintu. Mode itu mengedit **layout aktif untuk layanan baru**, bukan snapshot layanan historis.

#### B. Empat tipe (`text`, `text area`, `image`, `announcement slot`) — **non-blocking (dokumentasi)**

User menyebut empat **Type** di kalimat yang sama dengan atribut predefined field; di tempat lain user menyatakan announcement set **bukan** predefined field.

SPEC memecah menjadi: `field_type` = 3 nilai; `announcement_slot` = `widget_kind`. Secara desain ini **lebih konsisten** dengan Prompt 1, tetapi tanpa kalimat eksplisit implementer bisa mengira “announcement slot” sebagai baris di `predefined_fields`.

**Koreksi:** Satu paragraf keputusan di SPEC: *“Empat jenis elemen di dalam grouping: text, text_area, image (via predefined_field), dan announcement_slot (widget khusus 1..4, bukan baris predefined_fields).”*

#### C. Manifest seeder default — **blocking (kelengkapan vs kata user)**

User mensyaratkan minimal:

- Verse Reference — Text, **length 100**
- Verse Text — Text Area, **initial line 5**
- Family / Youth — photo, name, request
- Sermon — speaker, graphic, closing prayer
- Tombol seed adaptif (gap only)

Daftar `seed_key` di SPEC/tiket 01 **tidak memuat** `default.verse_text` (padahal backfill memetakan `scripture_text`). Juga tidak ada tabel normatif yang mengikat **shown text, tipe, `input_length`/`initial_lines`, grouping default, urutan slot, dan regex awal** (atau kebijakan eksplisit “regex kosong = belum dikonfigurasi”).

Inkonsistensi penamaan `seed_key` vs `variable_name` canonical (`default.verse_reference` → `scripture_reference`, dll.) belum dijelaskan sebagai **identitas internal vs token persistensi**.

Seeder tiket 01 menyebut default grouping meniru card lama, tetapi tidak memastikan **slot** (mis. verse text di card mana) selaras UI saat ini.

Field legacy yang ada di katalog 17 key (`theme_reference`, `theme_text`, `special_song`, `sermon_title`) **tidak** masuk manifest seeder user; Prompt 2 hanya mengecualikan tanggal + **judul worship** dari regex — bukan secara eksplisit `sermon_title` atau theme. Risiko: “sisanya regex admin” bentrok dengan backfill `sermon.title` tanpa field/regex seeded.

**Koreksi:** Manifest seeder normatif di SPEC + tiket 01; tambah `default.verse_text`; putuskan daftar lengkap field seeded vs hanya backfill legacy; dokumentasikan regex default per field seeded atau status “unconfigured”.

#### D. Semantik hapus user vs seed ulang — **non-blocking → P0 jika tidak diputuskan**

Soft delete (`is_active = 0`) + `ON CONFLICT(seed_key) DO NOTHING` ⇒ field yang user hapus **tidak** muncul lagi saat seed, tanpa keputusan produk tertulis (user: “bisa dihapus” + seed “hanya isi gap”).

**Koreksi:** Pilih dan uji salah satu: (1) hapus = permanen, restore hanya lewat aksi eksplisit; atau (2) seed boleh re-activate row inactive tanpa menimpa label/regex kustom.

#### E. Song Book / song set “muncul dinamis” — **non-blocking (desain)**

User: predefined field dapat muncul dari song book yang ditambahkan.

SPEC punya `song_set_entry` dan regex per entry, tetapi tidak menjelaskan: sinkronisasi saat entry registry baru; validasi FK `song_set_variable_name`; efek hapus/nonaktif entry pada snapshot; apakah satu entry boleh di dua card (tiket 01 mengusulkan unik per layout — selaras mencegah duplikasi input, tetapi perlu konfirmasi terhadap contoh “kombinasi Song Set C”).

#### F. “Hanya tanggal & judul worship hardcoded; sisanya regex admin” — **sebagian selaras, ada celah**

SPEC mengecualikan dynamic extraction untuk date + worship title/header — bagus.

Namun tiket 04 masih mengasumsikan pipeline parser struktural + profil (`parseRundownWithProfile`, `field_rules`) paralel; tidak ada norma bahwa **untuk form baru pasca-migrasi** ekstraksi overlay hanya dari regex tersimpan admin. Tanpa itu, hardcode lama bisa tetap “menang” diam-diam — bertentangan dengan spirit Prompt 2.

Juga belum diperjelas: `scripture_bible_version`, `special_song`, `sermon_title`, `theme_*` — regex admin atau legacy-only?

**Koreksi:** Kalimat normatif + fase sunset parser hardcoded; inventaris field yang boleh legacy-only vs wajib regex.

#### G. Ketidaksukaan user terhadap “rundown parsing” saat ini — **distorsi ringan / scope**

User membuka dengan tidak suka parsing rundown monolitik. SPEC mengganti arah ke **saran non-destruktif** + regex per field, tetapi **tidak** berkomitmen menurunkan heuristic global song set 3-pass atau parser profile `field_rules` sebagai sumber kebenaran untuk field yang sudah ada di predefined admin.

**Rekomendasi:** Satu bullet di SPEC: tujuan akhir = ekstraksi field teks dan song set **hanya** dari konfigurasi admin; parser struktural tetap untuk section/items, bukan untuk mengisi overlay field yang sudah punya regex.

#### H. Image — render sudah; persistensi kurang

Renderer 3 kolom sudah; `service_field_values` hanya `value_text` di tiket — untuk image perlu kontrak URL/upload, MIME, download untuk URL eksternal, dan perilaku saat definisi field di-archive.

#### I. Urutan dependensi tiket

Rantai `01→…→06` menempatkan regex (04) setelah hydration (03). Bukan kontradiksi prompting, tetapi E2E “parse → form → preview” baru utuh di tiket 05–06; pantas disebut di rencana QA.

---

## 2. Integritas: aman 100% untuk kebaktian lama, deck, hydration, PPTX, SPEC-45 (PR #83)?

### Jawaban singkat: **belum dapat diklaim 100% aman**

Arah proteksi di SPEC sudah tepat; banyak janji masih **deklaratif** dan belum jadi kontrak migrasi + acceptance test yang cukup.

### Yang sudah dilindungi dengan benar

1. **Urutan deck / spine** dipisah dari form layout — keputusan kritis; selaras permintaan user dan DEC-004/SPEC-45.
2. **`song_set_inputs` tetap SSOT** untuk lagu mingguan — selaras DEC-004.
3. **`images_payload.announcementInserts`** tetap — selaras SPEC-45; tiket 05 menyebut `initialAnnouncementInserts` dan guard `sm:grid-cols-2` (selaras `tests/smoke-spec-45.test.mjs`).
4. **Dual-read** dari `service_field_values` ke legacy — tiket 02.
5. **Unknown token** — warning saat save artifact, kosong saat runtime (DEC-004 S5) — tiket 03.
6. **Snapshot layout** untuk layanan baru — SPEC §7; melindungi dari perubahan admin di masa depan **jika** snapshot benar-benar ada.

### Risiko material yang belum ditutup

| Risiko | Mengapa berbahaya | Perbaikan wajib |
|---|---|---|
| **Snapshot hanya on create** (tiket 02) vs janji “historic services read frozen snapshot” (SPEC) | Layanan lama tanpa snapshot akan pakai **active layout** setelah admin mengubah layout global → form historis bisa berubah | Backfill `service_form_layout_snapshots` untuk **semua** service existing (layout legacy yang direkonstruksi aman); test: ubah active layout → layanan lama tidak berubah |
| **Klaim “17 keys” / “complete mapping”** vs daftar 14 baris di SPEC/tiket 02 | `placeholder-catalog.ts` punya 17 key termasuk `theme_reference`, `theme_text`, `sermon_title`, `special_song` yang tidak semuanya ada di tabel backfill | Inventaris dari kode aktual; table-driven migration tests; hindari kata “complete/100%” sampai cocok |
| **Hydration hanya `active predefined_fields`** | Field di-archive setelah layanan dibuat bisa membuat token “unregistered” → slide kosok padahal `service_field_values` masih ada | Resolver runtime harus mengenali field dari **snapshot layanan** + nilai tersimpan; test archive-after-create |
| **Migrasi tidak transactional / idempotent** | Backfill ulang atau partial failure bisa korupsi atau duplikat | Unique `(service_id, variable_name)`, upsert dengan precedence, laporan gagal, tidak hapus `parsed_data`/`images_payload` prematur |
| **“PPTX 100% identical”** tanpa definisi | Byte ZIP bisa beda karena metadata | Bandingkan slide plan JSON normalisasi + OOXML normalisasi; fixture representatif |
| **Dual-read tanpa dual-write / fase rollout** | Deploy bertahap bisa kehilangan field dinamis | Dokumen fase: additive schema → dual-write → verifikasi backfill → switch read → sunset legacy write |
| **Schema `form_group_slots`** | Constraint `UNIQUE(layout_id, widget_kind, ref_key)` di tiket 01 tidak cocok kolom yang dijelaskan (`grouping_id`, `field_id`, … tanpa `layout_id`/`ref_key`) | Finalisasi schema: `ref_key` kanonik, XOR FK per `widget_kind`, uniqueness via join atau denormalisasi |
| **SPEC-45: sadar tapi belum terbukti cukup** | Guard `sm:grid-cols-2` + prop pass-through penting, tidak cukup untuk seluruh lifecycle | Suite tiket 06: 4 slot round-trip; slot di grouping mana pun tidak mengubah spine; reorder card tidak menghapus inserts; proof RED/GREEN untuk tiga defect SPEC-45 |

### Penilaian khusus PR #83 / SPEC-45

Rencana **secukupnya sadar** baseline (commit `94db19d`, absence guard). Agar selaras mandat user *“jangan membuat broken apa yang sudah bagus”*, tiket 06 harus **memperluas** smoke SPEC-45 (bukan menggantikan): announcement di grouping dinamis, snapshot historis, plus injeksi defect yang sudah terbukti di `smoke-spec-45.test.mjs`.

---

## 3. Koreksi dan rekomendasi konkret (presisi kata user)

### P0 — harus masuk SPEC/tiket sebelum implementasi

1. **Mode “Kelola layout visual” in-place** di `CreateForm`/`EditForm` (admin); `/admin/*` sebagai pelengkap, bukan satu-satunya interpretasi “dimenu ini”.
2. **Manifest seeder lengkap** termasuk `default.verse_text`, length 100 / initial_lines 5, semua field Family/Youth/Sermon user sebut, default grouping + slot order, kebijakan regex awal.
3. **Kontrak delete vs seed** (`is_active` + `seed_key`).
4. **Backfill snapshot untuk semua layanan existing**, selaras janji historic frozen layout.
5. **Tabel mapping legacy → canonical** diverifikasi dari `worship-form-fields.ts` + `placeholder-catalog.ts`; hilangkan angka “17” sampai cocok.
6. **Norma regex:** untuk layanan/form baru, selain `service_date` dan judul worship/header, ekstraksi teks & song set hanya dari regex tersimpan admin; legacy parser hanya jalur kompatibilitas terbatas.
7. **Paragraf empat jenis elemen** (termasuk announcement_slot sebagai widget).

### P1 — detail desain / tiket

8. Lifecycle song set entry (tambah/hapus registry ↔ layout ↔ snapshot).
9. **`variable_name` immutable** setelah create (atau migrasi rename atomik eksplisit).
10. Kontrak nilai image di `service_field_values` (URL, upload API, download).
11. Finalisasi DDL `form_group_slots` + constraint cardinality announcement 1..4.
12. Hydration/validasi token berbasis **snapshot layanan**, bukan hanya katalog global aktif.
13. Keputusan eksplisit untuk `sermon_title`, `special_song`, `theme_*` vs “hanya judul worship” Prompt 2.
14. Roadmap sunset `field_rules` / heuristic song global agar selaras “saya tidak suka rundown parsing” + Prompt 2.

### P2 — tiket / QA

15. Definisi operasional “identik” untuk slide plan & PPTX.
16. Pertimbangkan urutan implementasi: regex engine (04) lebih awal untuk uji parse sebelum admin UI penuh (06).
17. User story operator: **re-sync layout** eksplisit (sudah ada di SPEC §7) — tambah acceptance test.

### Per tiket (saran edit ringkas)

| Tiket | Tambahan utama |
|---|---|
| **01** | Manifest seeder; `default.verse_text`; perjelas `seed_key`→`variable_name`; perbaiki constraint slot; keputusan delete/seed |
| **02** | Snapshot backfill semua service; inventaris mapping; dual-write fase; image column atau konvensi URL |
| **03** | Token dari snapshot + nilai tersimpan untuk field archived; fixture theme/sermon/special |
| **04** | Sunset path hardcoded; field tanpa regex = tidak auto-fill hardcoded |
| **05** | Entry point “Kelola layout visual”; FR in-place builder |
| **06** | In-place builder UI; extend SPEC-45 smoke; fixture PPTX/plan normalisasi |

---

## Kesimpulan audit

Draf SPEC-46 dan tiket 01–06 **sudah menangkap kerangka besar** visi user: shell tetap, grouping sebagai card, tiga widget kinds (+ announcement), regex per field dan per song set, image 3 kolom, seeder adaptif, token dinamis, pemisahan form vs deck, dan kesadaran SPEC-45. **Belum presisi** pada: (1) **di mana** admin mengatur layout (worship form vs hanya Settings), (2) **manifest seeder** termasuk Verse Text dan properti visual eksplisit, (3) **kontrak “sisanya regex admin”** vs parser legacy, (4) **snapshot & migrasi** untuk layanan lama, dan (5) **bukti non-regresi** yang lebih kuat dari klaim “100%”.

Untuk stamping trace / mulai implementasi, rekomendasi: **`accept-with-changes`** dengan menyelesaikan item P0 di atas; lens review: **edge-case-hunter** (snapshot, archive field, seed vs delete, mapping key), plus verifikasi fixture legacy sebelum merge.

---

**What was done:** Audit menyeluruh prompting verbatim vs SPEC-46 dan tiket 01–06, dengan jawaban terstruktur untuk ketiga pertanyaan audit (kelengkapan, integritas, koreksi konkret) dalam bahasa Indonesia.  
**Blocked / uncertain:** Interpretasi final apakah “judul worship” mencakup `sermon_title`/`theme_*`; dan apakah user menginginkan builder layout **hanya** in-place atau admin terpisah juga wajib (rekomendasi: keduanya, in-place sebagai syarat verbatim).  
**Next:** Perbarui SPEC dan tiket sesuai daftar P0, lalu jalankan pass review kedua setelah manifest seeder dan kontrak snapshot backfill tertulis.

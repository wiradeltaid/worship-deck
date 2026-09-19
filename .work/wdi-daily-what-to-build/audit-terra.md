[m> [0mSaya akan menelusuri prompt verifikasi beserta seluruh dokumen yang dirujuk, lalu membandingkan setiap permintaan mentah dengan cakupan SPEC-46 dan tiket 01–06 secara menyeluruh.[0m[0m
Reading file: [mD:\Developer\orca-workspaces\worship-presenter-web\main-2\.work\wdi-daily-what-to-build\VERIFY-PROMPTING-ALIGNMENT.md[0m, all lines[m (using tool: read)[0m
[m ✓ [0mSuccessfully read [38;5;244m5933 bytes[0m from D:\Developer\orca-workspaces\worship-presenter-web\main-2\.work\wdi-daily-what-to-build\VERIFY-PROMPTING-ALIGNMENT.md
[m - Completed in 0.0s[0m

Reading file: [mD:\Developer\orca-workspaces\worship-presenter-web\main-2\.scratch\SPEC-46-configurable-form-layout-and-predefined-fields\SPEC.md[0m, all lines[m (using tool: read)[0mBatch fs_read operation with [m3[0m operations[m (using tool: read)[0m
Purpose: Membaca tiket backend dan hydration SPEC-46.

↱ Operation 1: Reading file: [mD:\Developer\orca-workspaces\worship-presenter-web\main-2\.scratch\SPEC-46-configurable-form-layout-and-predefined-fields\issues\01-schema-migration-and-adaptive-seeder-backend.md[0m, all lines
↱ Operation 2: Reading file: [mD:\Developer\orca-workspaces\worship-presenter-web\main-2\.scratch\SPEC-46-configurable-form-layout-and-predefined-fields\issues\02-dynamic-field-service-persistence-and-backfill-migration.md[0m, all lines
↱ Operation 3: Reading file: [mD:\Developer\orca-workspaces\worship-presenter-web\main-2\.scratch\SPEC-46-configurable-form-layout-and-predefined-fields\issues\03-dynamic-canvas-token-hydration-in-go-slide-plan.md[0m, all linesBatch fs_read operation with [m3[0m operations[m (using tool: read)[0m
Purpose: Membaca tiket regex, form, dan administrasi SPEC-46.

↱ Operation 1: Reading file: [mD:\Developer\orca-workspaces\worship-presenter-web\main-2\.scratch\SPEC-46-configurable-form-layout-and-predefined-fields\issues\04-dynamic-regex-extraction-engine-for-fields-and-song-sets.md[0m, all lines
↱ Operation 2: Reading file: [mD:\Developer\orca-workspaces\worship-presenter-web\main-2\.scratch\SPEC-46-configurable-form-layout-and-predefined-fields\issues\05-dynamic-form-shell-and-card-grouping-engine-in-react.md[0m, all lines
↱ Operation 3: Reading file: [mD:\Developer\orca-workspaces\worship-presenter-web\main-2\.scratch\SPEC-46-configurable-form-layout-and-predefined-fields\issues\06-admin-layout-builder-predefined-fields-management-and-regression-guards.md[0m, all lines
[m ✓ [0mSuccessfully read [38;5;244m14654 bytes[0m from D:\Developer\orca-workspaces\worship-presenter-web\main-2\.scratch\SPEC-46-configurable-form-layout-and-predefined-fields\SPEC.md
[m - Completed in 0.0s[0m


[m ✓ [0mSuccessfully read [38;5;244m3788 bytes[0m from D:\Developer\orca-workspaces\worship-presenter-web\main-2\.scratch\SPEC-46-configurable-form-layout-and-predefined-fields\issues\01-schema-migration-and-adaptive-seeder-backend.md

[m ✓ [0mSuccessfully read [38;5;244m2210 bytes[0m from D:\Developer\orca-workspaces\worship-presenter-web\main-2\.scratch\SPEC-46-configurable-form-layout-and-predefined-fields\issues\02-dynamic-field-service-persistence-and-backfill-migration.md

[m ✓ [0mSuccessfully read [38;5;244m1852 bytes[0m from D:\Developer\orca-workspaces\worship-presenter-web\main-2\.scratch\SPEC-46-configurable-form-layout-and-predefined-fields\issues\03-dynamic-canvas-token-hydration-in-go-slide-plan.md

 ⋮ 

[m- [0mSummary: 3 operations processed, 3 successful, 0 failed
[m - Completed in 0.0s[0m


[m ✓ [0mSuccessfully read [38;5;244m1737 bytes[0m from D:\Developer\orca-workspaces\worship-presenter-web\main-2\.scratch\SPEC-46-configurable-form-layout-and-predefined-fields\issues\04-dynamic-regex-extraction-engine-for-fields-and-song-sets.md

[m ✓ [0mSuccessfully read [38;5;244m2508 bytes[0m from D:\Developer\orca-workspaces\worship-presenter-web\main-2\.scratch\SPEC-46-configurable-form-layout-and-predefined-fields\issues\05-dynamic-form-shell-and-card-grouping-engine-in-react.md

[m ✓ [0mSuccessfully read [38;5;244m2221 bytes[0m from D:\Developer\orca-workspaces\worship-presenter-web\main-2\.scratch\SPEC-46-configurable-form-layout-and-predefined-fields\issues\06-admin-layout-builder-predefined-fields-management-and-regression-guards.md

 ⋮ 

[m- [0mSummary: 3 operations processed, 3 successful, 0 failed
[m - Completed in 0.0s[0m

[m> [0m[m[1m## Kesimpulan audit[0m[0m
[0m[0m
[1mSPEC-46 belum siap dianggap 100% selaras atau 100% aman.[22m Arsitektur intinya sudah sangat dekat dengan maksud user: shell tetap, grouping menjadi card, field dinamis, regex per field/song set, image renderer tiga kolom, dan pemisahan form layout dari deck sequence. Namun terdapat beberapa kesenjangan [1mmaterial[22m—terutama lokasi pengelolaan layout, kontrak seeder default, siklus hidup Song Book/song set, snapshot layanan lama, serta bukti kompatibilitas SPEC-45/DEC-004.[0m[0m
[0m[0m
Saya telah membaca penuh:[0m[0m
- [m.work/wdi-daily-what-to-build/VERIFY-PROMPTING-ALIGNMENT.md[0m[0m[0m
- [m.scratch/SPEC-46-configurable-form-layout-and-predefined-fields/SPEC.md[0m[0m[0m
- tiket [m01[0m sampai [m06[0m di folder [missues/[0m.[0m[0m
[0m[0m
Tidak ada berkas yang diubah.[0m[0m
[0m[0m
[m[1m## 1. Kelengkapan fitur terhadap prompting mentah[0m[0m
[0m[0m
[m[1m### A. Bagian yang sudah selaras[0m[0m
[0m[0m
| Permintaan user | Status | Penilaian |[0m[0m
|---|---:|---|[0m[0m
| Rundown selalu di kiri atas dan Live Slide Preview sticky di kanan atas | Selaras | Disebut eksplisit di SPEC, tiket 05, dan test guard tiket 06. |[0m[0m
| Area di bawah rundown dapat diatur per grouping | Selaras | [mform_groupings[0m dan [mform_group_slots[0m secara tepat memodelkan grouping sebagai [m<Card>[0m. |[0m[0m
| Grouping dapat mencampurkan field, song set, dan Announcement Weekly Slot | Sebagian besar selaras | Model tiga [mwidget_kind[0m tepat: [mpredefined_field[0m, [msong_set_entry[0m, [mannouncement_slot[0m. |[0m[0m
| Announcement set bukan predefined field dan tetap 4 slot | Selaras secara desain | Memisahkan announcement menjadi [mwidget_kind[0m justru konsisten dengan kalimat user bahwa announcement set “bukanlah predefined field”. Slot dibatasi [m1..4[0m. |[0m[0m
| Text, textarea, dan image dapat dikonfigurasi | Selaras | [mshown_text[0m, [mvariable_name[0m, tipe, ukuran input, jumlah baris awal, dan regex ada dalam rancangan. |[0m[0m
| Image memiliki layout tiga kolom | Selaras | SPEC dan tiket 05 menyebut thumbnail, choose file/paste URL, lalu upload/download. |[0m[0m
| Regex individual untuk setiap text field | Selaras | [mextraction_regex[0m per predefined field dan proposal hasil parse non-destruktif sudah ditentukan. |[0m[0m
| Regex individual untuk setiap Song Set | Selaras | [msong_set_entries.extraction_regex[0m, capture [mnumber[0m dan opsional [mbook[0m, endpoint admin, UI admin, serta engine Go/TypeScript direncanakan. |[0m[0m
| Date dan worship title tetap standar/hardcoded | Selaras secara eksplisit | SPEC menyebut [mservice_date[0m dan Worship Title/Header dikecualikan dari dynamic extraction. |[0m[0m
| Dynamic token hydration pada slide | Selaras | Tiket 03 menghapus ketergantungan pada whitelist token statis dan mengisi nilai dari [mservice_field_values[0m. |[0m[0m
| Seeder adaptif, tidak menimpa kustomisasi | Selaras pada prinsip | [mseed_key[0m dan [mINSERT ... ON CONFLICT(seed_key) DO NOTHING[0m adalah arah yang benar. |[0m[0m
| Layout form tidak boleh mengubah urutan deck/PPTX | Selaras | Pemisahan form layout vs Artifact Registry/presentation sequence telah dinyatakan sangat jelas. |[0m[0m
[0m[0m
[m[1m### B. Kesenjangan atau distorsi yang perlu dikoreksi[0m[0m
[0m[0m
[m[1m#### 1. Lokasi “Kelola Layout Visual” belum sesuai kata-kata user — [1mblokir penerimaan[22m[0m[0m
User tidak hanya meminta layout dapat dikelola; user mengatakan pengelolaan visual itu seharusnya terjadi “di sini”, dalam konteks [1mworship new/edit[22m, dan meminta menu ini menjadi tempat mengelola layout visual form.[0m[0m
[0m[0m
SPEC saat ini meletakkan builder hanya di:[0m[0m
- [m/admin/form-layout[0m[0m[0m
- [m/admin/predefined-fields[0m[0m[0m
[0m[0m
Sementara [mEditForm[0m/[mCreateForm[0m hanya merender hasil konfigurasi. Ini memenuhi kebutuhan konfigurabilitas, tetapi [1mbelum memenuhi tuntutan in-place visual layout management[22m secara presisi.[0m[0m
[0m[0m
[1mKoreksi yang diperlukan:[22m[0m[0m
- Tambahkan requirement eksplisit pada SPEC dan tiket 05/06: pada [mEditForm[0m dan [mCreateForm[0m, pengguna admin memiliki aksi seperti [1m“Customize Layout” / “Kelola Layout Visual”[22m.[0m[0m
- Aksi tersebut harus membuka builder in-place, drawer, dialog, atau mode layout khusus yang memperlihatkan susunan card sebagaimana form sedang dirender.[0m[0m
- Akses tetap dapat dibatasi role admin.[0m[0m
- [m/admin/form-layout[0m boleh tetap ada sebagai halaman administrasi penuh, tetapi tidak boleh menjadi satu-satunya jalan jika “di menu ini” dimaksudkan sebagai bagian dari workflow worship new/edit.[0m[0m
- Builder harus jelas mengedit [1mactive layout untuk layanan baru[22m, bukan otomatis mengubah snapshot layanan lama.[0m[0m
[0m[0m
[m[1m#### 2. “Empat tipe” perlu diperjelas secara terminologis[0m[0m
Prompt user menyebut:[0m[0m
[0m[0m
[m│ Type = text, text area, image, announcement slot.[0m[0m
[0m[0m
SPEC mendefinisikan hanya tiga [mfield_type[0m: [mtext[0m, [mtext_area[0m, [mimage[0m, lalu memodelkan [mannouncement_slot[0m sebagai [mwidget_kind[0m.[0m[0m
[0m[0m
Secara data model, pilihan SPEC lebih tepat karena user juga menyatakan Announcement Set bukan predefined field. Namun tanpa penjelasan eksplisit, implementer dapat menganggap requirement “empat tipe” terlewat.[0m[0m
[0m[0m
[1mKoreksi yang diperlukan:[22m[0m[0m
Tambahkan keputusan eksplisit:[0m[0m
[0m[0m
[m│ Ada empat jenis elemen yang dapat ditempatkan dalam grouping: [mtext[0m, [mtext_area[0m, [mimage[0m, dan [mannouncement_slot[0m. Hanya tiga yang disimpan sebagai [mpredefined_fields[0m; [mannouncement_slot[0m adalah widget khusus yang mereferensikan salah satu dari empat slot announcement dan bukan predefined field.[0m[0m
[0m[0m
Ini mempertahankan model yang benar sambil menutup ambiguitas wording.[0m[0m
[0m[0m
[m[1m#### 3. Seeder default belum lengkap dan belum cukup presisi — [1mblokir penerimaan[22m[0m[0m
User menetapkan starter fields minimum berikut:[0m[0m
- Verse Reading Reference — [mText[0m, [mlength = 100[0m[0m[0m
- Verse Reading Text — [mText Area[0m, [minitial line = 5[0m[0m[0m
- Family of the Week — [mphoto[0m, [mname[0m, [mrequest[0m[0m[0m
- Youth of the Week — [mphoto[0m, [mname[0m, [mrequest[0m[0m[0m
- Sermon — [mspeaker[0m, [mgraphic[0m, [mclosing prayer[0m[0m[0m
[0m[0m
SPEC/tiket 01 memang mencantumkan banyak seed key, tetapi masih memiliki masalah:[0m[0m
[0m[0m
1. [1mVerse Reading Text tidak ada[22m dalam daftar [mseed_key[0m.[0m[0m
2. Tidak ada manifest yang menyebut field type, [minput_length[0m, [minitial_lines[0m, label, variable name, regex, grouping, dan urutan slot secara lengkap.[0m[0m
3. Nama teknis tampak tidak konsisten antara seed key dan canonical storage:[0m[0m
   - [mdefault.verse_reference[0m vs [mscripture_reference[0m[0m[0m
   - [mdefault.sermon_speaker[0m vs [msermon_speaker_name[0m[0m[0m
   - [mdefault.sermon_graphic[0m vs [msermon_poster[0m[0m[0m
   - [mdefault.closing_prayer[0m vs [mclosing_prayer_person[0m[0m[0m
  [0m[0m
  Perbedaan ini dapat valid bila [mseed_key[0m memang identitas internal terpisah, tetapi relasinya belum ditentukan.[0m[0m
4. “Seed default” belum menyatakan apakah juga membuat grouping dan slot yang hilang, atau hanya field definitions.[0m[0m
5. Tidak ada ketentuan regex default bagi seeded text fields. Jika semua field selain date/title harus diekstrak lewat regex admin, seeder harus menyediakan regex awal yang dapat diedit—atau secara eksplisit membiarkannya kosong dan menampilkan status belum dikonfigurasi.[0m[0m
[0m[0m
[1mKoreksi yang diperlukan:[22m[0m[0m
Tambahkan tabel/manifes seeder normatif di SPEC dan tiket 01, minimal berisi:[0m[0m
[0m[0m
| [mseed_key[0m | [mvariable_name[0m | shown text | tipe | properti visual | grouping awal | regex default |[0m[0m
|---|---|---|---|---|---|---|[0m[0m
| [mdefault.verse_reference[0m | [mscripture_reference[0m | Verse Reading Reference | [mtext[0m | [minput_length: 100[0m | Bible Talk/Divine Worship | pola awal atau kosong terindikasi |[0m[0m
| [mdefault.verse_text[0m | [mscripture_text[0m | Verse Reading Text | [mtext_area[0m | [minitial_lines: 5[0m | Bible Talk/Divine Worship | pola awal atau kosong terindikasi |[0m[0m
| … | … | Family/Y​outh/Sermon fields | sesuai tipe | sesuai desain | sesuai layout default | sesuai kontrak |[0m[0m
[0m[0m
Manifest tersebut juga harus menentukan default grouping dan urutan default. Tanpa itu, “Seed Default Predefined Fields” berisiko hanya membuat definisi yang tidak muncul di form mana pun.[0m[0m
[0m[0m
[m[1m#### 4. Semantik hapus vs seed ulang belum diputuskan[0m[0m
User menyatakan seeded Verse fields “bisa dihapus oleh user”; user juga menginginkan seeder mengisi gap tanpa merusak kondisi yang ada. Rencana memakai soft delete ([mis_active = 0[0m) bersama [mON CONFLICT(seed_key) DO NOTHING[0m.[0m[0m
[0m[0m
Konsekuensinya: field yang dihapus menjadi inactive tetapi tetap memiliki [mseed_key[0m; menekan seed lagi akan menghitungnya sebagai konflik dan [1mtidak akan memulihkan field tersebut[22m. Ini mungkin benar untuk menghormati penghapusan eksplisit user, tetapi belum tertulis sebagai keputusan produk.[0m[0m
[0m[0m
[1mKoreksi yang diperlukan:[22m[0m[0m
Tetapkan salah satu kontrak berikut dan uji keduanya:[0m[0m
1. [1mDelete adalah pilihan permanen:[22m seeder melewati row inactive; admin perlu aksi explicit “Restore default field”.[0m[0m
2. [1mSeed adalah pemulihan gap:[22m seeder dapat mengaktifkan kembali seeded field yang inactive, tetapi harus menampilkan konfirmasi dan tidak mengubah label/regex kustom.[0m[0m
[0m[0m
Pilihan pertama lebih konsisten dengan “tidak merusak yang sudah ada”; pilihan kedua lebih konsisten dengan nama tombol “Seed Default”. Yang penting, perilakunya tidak dibiarkan implisit.[0m[0m
[0m[0m
[m[1m#### 5. Lifecycle Song Book / Song Set belum tercakup[0m[0m
Prompt menyatakan predefined field dapat muncul dari Song Book yang ditambahkan secara dinamis. SPEC mencakup [msong_set_entry[0m dan regex per entry, tetapi belum menentukan:[0m[0m
- kapan Song Book baru membuat pilihan [msong_set_entry[0m tersedia;[0m[0m
- bagaimana add/remove/rename song book atau song set entry memengaruhi layout;[0m[0m
- bagaimana [msong_set_variable_name[0m divalidasi sebagai referensi terhadap entry yang benar;[0m[0m
- apa yang terjadi pada snapshot layanan ketika entry dihapus atau dinonaktifkan;[0m[0m
- apakah satu song set entry boleh ditempatkan pada lebih dari satu grouping.[0m[0m
[0m[0m
Tiket 01 mengusulkan kardinalitas “setiap song set entry hanya sekali dalam active layout”. Ini mungkin tepat untuk mencegah input yang sama muncul ganda, tetapi perlu konfirmasi karena contoh user tentang mengombinasikan grouping dengan Song Set C dapat dibaca sebagai kebutuhan untuk memindahkan atau menempatkan Song Set C di grouping lain.[0m[0m
[0m[0m
[1mKoreksi yang diperlukan:[22m[0m[0m
- Tambahkan kontrak lifecycle untuk Song Book/song set entry.[0m[0m
- Ubah [msong_set_variable_name[0m menjadi FK atau reference tervalidasi, bukan string bebas.[0m[0m
- Nyatakan bahwa entry yang telah dipakai layanan lama tidak boleh merusak snapshot/hydration ketika dinonaktifkan.[0m[0m
- Putuskan dan dokumentasikan apakah penempatan satu entry pada banyak card dilarang atau diizinkan sebagai mirror read/write yang sama.[0m[0m
[0m[0m
[m[1m#### 6. “Hanya date/title hardcoded, sisanya regex admin” belum dijamin sepenuhnya[0m[0m
SPEC menyatakan date/title dikecualikan dari dynamic extraction; itu sudah baik. Namun rencana masih menyisakan risiko:[0m[0m
- parser lama yang hardcoded dapat tetap berjalan sebagai fallback tanpa batas;[0m[0m
- regex default dapat terselip sebagai hardcoded behavior yang tidak terlihat/tidak dapat diubah admin;[0m[0m
- definisi parsing field legacy belum menentukan kapan berpindah dari parser lama ke regex configured;[0m[0m
- “first non-empty match wins” belum mendefinisikan normalization, flags, multiline behavior, line order, dan handling regex kosong.[0m[0m
[0m[0m
[1mKoreksi yang diperlukan:[22m[0m[0m
Tambahkan keputusan berikut:[0m[0m
- Untuk layanan/form baru setelah migrasi, [1mseluruh extraction selain [mservice_date[0m dan worship title/header[22m hanya memakai regex yang tersimpan dalam konfigurasi admin.[0m[0m
- Legacy hardcoded parsing hanya boleh digunakan sebagai compatibility path untuk layanan/data historis yang belum dimigrasikan, bukan sebagai fallback diam-diam untuk form baru.[0m[0m
- Regex seeded harus dapat dilihat dan diubah admin.[0m[0m
- Field tanpa regex aktif tidak boleh diparse secara hardcoded; UI harus menunjukkan “belum dikonfigurasi untuk extraction”.[0m[0m
- Tentukan aturan matching: normalization line ending, case-sensitivity, flags yang diizinkan, first matching line vs whole document, dan capture kosong.[0m[0m
[0m[0m
[m[1m#### 7. Kontrak image sudah bagus, tetapi penyimpanan nilainya belum dijelaskan[0m[0m
SPEC menjelaskan rendering tiga kolom secara memadai. Namun [mservice_field_values[0m hanya dideskripsikan sebagai [mvalue_text[0m, sementara image perlu menjamin URL/file reference, akses download, validasi MIME/ukuran, dan stabilitas asset untuk layanan lama.[0m[0m
[0m[0m
[1mKoreksi yang diperlukan:[22m[0m[0m
- Nyatakan bahwa nilai image adalah upload reference/URL tervalidasi, bukan blob atau path internal sembarang.[0m[0m
- Jelaskan apakah download tersedia untuk URL eksternal maupun upload lokal.[0m[0m
- Tetapkan bagaimana image field lama tetap merender jika field definition diarsipkan atau layout berubah.[0m[0m
- Tambahkan test untuk upload, paste URL yang diizinkan, delete/replace image, dan deck/PPTX output.[0m[0m
[0m[0m
[m[1m#### 8. Rename [mvariable_name[0m belum aman[0m[0m
[mvariable_name[0m adalah key persistence dan token slide. Endpoint “create or edit predefined field” berpotensi mengizinkan penggantian variable name. Jika dibiarkan, perubahan ini dapat memutus:[0m[0m
- [mservice_field_values[0m;[0m[0m
- token template [m{variable_name}[0m;[0m[0m
- snapshot layout;[0m[0m
- hasil hydration layanan lama.[0m[0m
[0m[0m
[1mKoreksi yang diperlukan:[22m[0m[0m
Jadikan [mvariable_name[0m immutable setelah field dibuat. Jika rename benar-benar diperlukan, harus menjadi migration eksplisit yang secara atomik memperbarui value records, token references, snapshot metadata, dan memberikan preview dampak sebelum disimpan.[0m[0m
[0m[0m
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[0m[0m
[0m[0m
[m[1m## 2. Integritas: apakah rencana ini 100% aman terhadap kebaktian lama, deck sequence, hydration, PPTX, dan SPEC-45?[0m[0m
[0m[0m
[m[1m### Jawaban singkat: [1mbelum dapat dinyatakan 100% aman[22m[0m[0m
[0m[0m
SPEC memiliki arah proteksi yang tepat, tetapi banyak klaim keselamatan masih bersifat deklaratif dan belum diturunkan menjadi kontrak migrasi maupun acceptance test yang cukup kuat.[0m[0m
[0m[0m
[m[1m### Yang telah dilindungi dengan benar[0m[0m
[0m[0m
1. [1mDeck sequence dipisahkan dari form layout.[22m  [0m[0m
  Ini adalah keputusan inti yang tepat. Reorder card tidak boleh mengubah Artifact Registry, marker announcement, song node generation, atau urutan deck.[0m[0m
[0m[0m
2. [1m[msong_set_inputs[0m dipertahankan sebagai SSOT.[22m  [0m[0m
  SPEC menjaga kontrak DEC-004 untuk nomor lagu, buku, background, dan lyrics override.[0m[0m
[0m[0m
3. [1m[mimages_payload.announcementInserts[0m dipertahankan.[22m  [0m[0m
  Rencana tetap menggunakan payload existing bagi announcement slots, alih-alih memindahkan empat slot tersebut menjadi field generik.[0m[0m
[0m[0m
4. [1mSPEC-45 disebut eksplisit sebagai baseline.[22m  [0m[0m
  [minitialAnnouncementInserts[0m, empat slot, dan guard “tidak boleh kembali menjadi [msm:grid-cols-2[0m” telah dicantumkan di SPEC, tiket 05, dan tiket 06.[0m[0m
[0m[0m
5. [1mLegacy read fallback direncanakan.[22m  [0m[0m
  Tiket 02 menyebut fallback dari [mservice_field_values[0m ke [mparsed_data[0m dan [mimages_payload[0m, yang merupakan langkah kompatibilitas penting.[0m[0m
[0m[0m
6. [1mUnknown dynamic token tidak boleh menggagalkan presentasi.[22m  [0m[0m
  Kontrak DEC-004 S5—warning ketika save artifact, tetapi empty string ketika runtime—mengurangi risiko gangguan live worship.[0m[0m
[0m[0m
[m[1m### Risiko material yang belum ditutup[0m[0m
[0m[0m
[m[1m#### A. Snapshot hanya dibuat untuk layanan baru[0m[0m
SPEC menyatakan layanan historis menggunakan frozen snapshot. Namun tiket 02 hanya meminta snapshot dibuat [1msaat service creation[22m. Layanan lama tidak secara eksplisit mendapatkan snapshot saat backfill.[0m[0m
[0m[0m
Akibatnya, layanan lama tanpa snapshot akan fallback ke active layout. Setelah admin mengubah layout global, form layanan lama dapat berubah secara tak disengaja—bertentangan dengan janji “historic services read their frozen snapshot”.[0m[0m
[0m[0m
[1mPerbaikan wajib:[22m[0m[0m
- Migration harus membuat [mservice_form_layout_snapshots[0m bagi seluruh layanan yang sudah ada, menggunakan representasi layout legacy yang benar-benar mereka gunakan.[0m[0m
- Bila snapshot legacy tidak dapat direkonstruksi dengan aman, UI harus memakai renderer legacy yang terisolasi untuk layanan tersebut sampai admin melakukan explicit migration/re-sync.[0m[0m
- Tambahkan test: ubah layout aktif setelah membuat/memigrasikan layanan lama; pastikan layout layanan lama tidak berubah.[0m[0m
[0m[0m
[m[1m#### B. Klaim “17 keys” tidak cocok dengan daftar mapping[0m[0m
Tiket 02 dan SPEC mengklaim “complete mapping” atau test atas “all 17 keys”, tetapi daftar yang disediakan hanya berisi [1m14 mapping[22m:[0m[0m
- 3 verse-reading keys;[0m[0m
- 2 sermon nested keys;[0m[0m
- sermon graphic, closing prayer, special song;[0m[0m
- 3 family keys;[0m[0m
- 3 youth keys.[0m[0m
[0m[0m
Klaim “17” saat ini tidak dapat diverifikasi dan berbahaya karena memberi kesan migrasi lengkap padahal tiga key tidak terdaftar.[0m[0m
[0m[0m
[1mPerbaikan wajib:[22m[0m[0m
- Derivasi daftar mapping dari fixture/database/service type aktual, bukan dari daftar manual yang tidak diverifikasi.[0m[0m
- Nyatakan seluruh key sumber, canonical destination, type, transform, fallback, dan apakah key itu legacy-only.[0m[0m
- Ubah test menjadi table-driven dengan fixture yang mengandung setiap key legacy.[0m[0m
- Jangan gunakan kata “complete” atau “100% fidelity” sebelum inventory benar-benar cocok.[0m[0m
[0m[0m
[m[1m#### C. Field archived dapat mengganggu layanan lama dan token lama[0m[0m
[mDELETE[0m adalah soft archive. Namun resolver token pada tiket 03 berbicara tentang [mactive predefined_fields.variable_name[0m. Jika historic field diarsipkan, token yang dulu valid bisa berubah menjadi “unregistered” dan akhirnya kosong, walaupun [mservice_field_values[0m serta layout snapshot masih memuat nilainya.[0m[0m
[0m[0m
[1mPerbaikan wajib:[22m[0m[0m
- Runtime hydration layanan harus mengakui field yang terdapat pada snapshot layanan, bukan hanya active field global.[0m[0m
- Artifact validation untuk template baru boleh memberi warning terhadap archived field; runtime historic service tidak boleh blank hanya karena field tersebut kemudian diarsipkan.[0m[0m
- Tambahkan test archive-field-after-service-created → preview, live plan, dan PPTX lama tetap identik.[0m[0m
[0m[0m
[m[1m#### D. Migration/backfill perlu transactional, repeatable, dan non-destructive[0m[0m
Rencana menyebut non-destructive, tetapi tidak secara eksplisit mengharuskan:[0m[0m
- transaksi atomik;[0m[0m
- idempotensi jika migration dijalankan kembali;[0m[0m
- observability/report untuk record gagal;[0m[0m
- aturan duplicate ([mservice_id[0m, [mvariable_name[0m);[0m[0m
- rollback behavior;[0m[0m
- preservation of raw [mparsed_data[0m dan [mimages_payload[0m.[0m[0m
[0m[0m
[1mPerbaikan wajib:[22m[0m[0m
- Tambahkan unique constraint pada [mservice_field_values(service_id, variable_name)[0m.[0m[0m
- Backfill harus upsert dengan precedence yang tidak mengganti manual edit.[0m[0m
- Migration harus diselesaikan per service secara atomik atau memiliki failure report yang dapat diulang aman.[0m[0m
- Jangan menghapus key legacy sebelum seluruh read path dan test compatibility dinyatakan selesai.[0m[0m
[0m[0m
[m[1m#### E. Tidak cukup menguji “PPTX identik” secara slogan[0m[0m
Tiket 03 dan 06 meminta “100% identical slide plans and PPTX decks”. Ini bagus sebagai target, tetapi perlu definisi operasional. Byte-for-byte equality PPTX dapat gagal karena metadata ZIP, timestamp, atau ordering internal yang nondeterministik meski visualnya sama.[0m[0m
[0m[0m
[1mPerbaikan wajib:[22m[0m[0m
- Untuk slide plan: bandingkan canonical JSON yang sudah dinormalisasi.[0m[0m
- Untuk PPTX: bandingkan struktur Open XML yang dinormalisasi, daftar slide/order, text, image relation, transitions, dan geometry; abaikan metadata nondeterministik yang tidak memengaruhi output.[0m[0m
- Simpan fixture baseline dari layanan lama yang mewakili song sets, announcement slot 1–4, sermon graphic, family/youth image, verse, token tak dikenal, kosong, dan override lyrics.[0m[0m
- Test harus mencakup preview web, projector, live plan, dan PPTX—not only API response.[0m[0m
[0m[0m
[m[1m#### F. Dual-read tanpa dual-write/rollout contract berisiko[0m[0m
Tiket 02 menyebut dual-read, tetapi tidak memutuskan compatibility saat rollout. Jika frontend/backend lama dan baru hidup bersamaan pada deployment atau jika request lama masih mengirim format lama, data dinamis dapat hilang atau tidak terbaca.[0m[0m
[0m[0m
[1mPerbaikan wajib:[22m[0m[0m
- Tentukan fase transisi:[0m[0m
  1. additive schema;[0m[0m
  2. dual-read + dual-write;[0m[0m
  3. backfill verification;[0m[0m
  4. switch read primary ke dynamic values;[0m[0m
  5. deprecation legacy write hanya setelah release stabil.[0m[0m
- Endpoint create/update harus menjelaskan apakah tetap menulis legacy structure untuk compatibility window.[0m[0m
- Tambahkan test request payload lama dan payload baru terhadap endpoint yang sama.[0m[0m
[0m[0m
[m[1m#### G. Kontrak schema grouping masih belum koheren[0m[0m
Tiket 01 mensyaratkan unique constraint:[0m[0m
[0m[0m
[m│ [mUNIQUE(layout_id, widget_kind, ref_key)[0m[0m[0m
[0m[0m
Namun struktur [mform_group_slots[0m yang dijabarkan tidak memuat [mlayout_id[0m maupun [mref_key[0m; yang ada hanya [mgrouping_id[0m, [mfield_id[0m, [msong_set_variable_name[0m, dan [mannouncement_slot[0m.[0m[0m
[0m[0m
Ini belum dapat diimplementasikan persis seperti tertulis.[0m[0m
[0m[0m
[1mPerbaikan wajib:[22m[0m[0m
- Tentukan schema final: apakah [mlayout_id[0m didenormalisasi pada slot, atau uniqueness dijaga secara transactional melalui join ke grouping.[0m[0m
- Tentukan [mref_key[0m canonical untuk tiap widget kind.[0m[0m
- Tambahkan FK/constraint yang memastikan hanya satu dari [mfield_id[0m, [msong_set_variable_name[0m, atau [mannouncement_slot[0m terisi sesuai [mwidget_kind[0m.[0m[0m
- Validasi bahwa [mannouncement_slot[0m benar-benar hanya 1–4.[0m[0m
- Tentukan behavior jika slot mereferensikan field inactive/deleted.[0m[0m
[0m[0m
[m[1m### Penilaian spesifik atas SPEC-45 / PR #83[0m[0m
[0m[0m
Rencana cukup sadar terhadap PR #83, tetapi belum cukup membuktikan tidak adanya regresi. Guard absence untuk [msm:grid-cols-2[0m sangat berguna, namun tidak cukup sendirian.[0m[0m
[0m[0m
Acceptance suite SPEC-46 harus memverifikasi:[0m[0m
1. Semua empat [minitialAnnouncementInserts[0m round-trip pada layanan existing dan layanan baru.[0m[0m
2. Announcement Slot dapat berada di grouping apa pun tanpa mengubah insertion sequence deck.[0m[0m
3. Reorder/remove card layout tidak menghapus [mannouncementInserts[0m.[0m[0m
4. Snapshot layanan lama mempertahankan lokasi/rendering announcement menurut layout historisnya.[0m[0m
5. Guard memang pernah dibuat RED dengan:[0m[0m
   - mengembalikan [msm:grid-cols-2[0m;[0m[0m
   - menghapus pass-through [minitialAnnouncementInserts[0m;[0m[0m
   - mengubah announcement menjadi dynamic scalar field;[0m[0m
  lalu dikembalikan GREEN.[0m[0m
6. Test public-repo guard dan full test suite tetap hijau setelah semua fixture baru ditambahkan.[0m[0m
[0m[0m
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[0m[0m
[0m[0m
[m[1m## 3. Koreksi dan rekomendasi konkret[0m[0m
[0m[0m
[m[1m### Prioritas P0 — harus masuk SPEC/tiket sebelum implementasi[0m[0m
[0m[0m
1. [1mTambahkan in-place layout management pada worship new/edit.[22m  [0m[0m
  Ubah SPEC bagian Solution 9 dan tiket 05/06 agar [m/admin/form-layout[0m bukan satu-satunya builder. Tambahkan acceptance criterion bahwa admin dapat masuk mode “Kelola Layout Visual” dari form worship dan melihat/menyusun card dalam konteks form nyata.[0m[0m
[0m[0m
2. [1mBuat manifest default seeder yang lengkap.[22m  [0m[0m
  Tambahkan [mdefault.verse_text[0m dan semua metadata default: variable name, label, type, width/rows, regex awal, grouping, slot order, dan seed behavior. Pastikan Verse Reference [mText length 100[0m dan Verse Text [mText Area initial line 5[0m tertulis eksplisit.[0m[0m
[0m[0m
3. [1mPutuskan kontrak delete/restore seeded field.[22m  [0m[0m
  Definisikan dengan tegas bagaimana [mis_active = 0[0m berinteraksi dengan [mSeed Default Predefined Fields[0m, lalu buat test untuk delete → seed → expected result.[0m[0m
[0m[0m
4. [1mBackfill snapshot seluruh layanan existing.[22m  [0m[0m
  Tiket 02 harus mencakup snapshot migration, bukan hanya snapshot saat create. Jangan fallback ke active layout untuk layanan historis tanpa keputusan eksplisit.[0m[0m
[0m[0m
5. [1mInventarisasi dan perbaiki semua legacy mapping.[22m  [0m[0m
  Hilangkan klaim “17 keys” sampai daftar lengkap diverifikasi. Tambahkan mapping table normatif yang bersumber dari field legacy aktual.[0m[0m
[0m[0m
6. [1mTentukan batas hardcoded parsing.[22m  [0m[0m
  Tambahkan kalimat normatif: hanya date dan worship title/header boleh memiliki extraction hardcoded untuk layanan baru; seluruh text field dan song set entry lain harus melalui regex admin yang tersimpan.[0m[0m
[0m[0m
[m[1m### Prioritas P1 — perlu masuk detail desain/tiket[0m[0m
[0m[0m
7. [1mTuliskan lifecycle Song Book/song set entry.[22m  [0m[0m
  Tambahkan synchronization, validasi referensi, nonaktif/hapus, snapshot safety, dan aturan penempatan duplicate.[0m[0m
[0m[0m
8. [1mJadikan [mvariable_name[0m immutable.[22m  [0m[0m
  Jika rename diizinkan, desain migration atomik harus dibuat terlebih dahulu; bila tidak, UI edit harus mengunci field ini setelah create.[0m[0m
[0m[0m
9. [1mJelaskan persistence image.[22m  [0m[0m
  Nyatakan format nilai image, kebijakan URL/upload, security validation, dan stability behavior bagi layanan historis.[0m[0m
[0m[0m
10. [1mSelesaikan schema [mform_group_slots[0m.[22m  [0m[0m
   Perbaiki inkonsistensi [mlayout_id/ref_key[0m; tambahkan XOR constraint antara reference columns dan FK yang sesuai widget type.[0m[0m
[0m[0m
11. [1mAtur token registry berdasarkan snapshot.[22m  [0m[0m
   Active field registry dipakai untuk konfigurasi baru; snapshot registry harus dipakai untuk layanan lama agar archive atau rename tidak menghapus output historis.[0m[0m
[0m[0m
12. [1mDefinisikan regex contract lebih ketat.[22m  [0m[0m
   Selain larangan lookaround/backreference, tentukan capture wajib, flags, normalization, line/whole-text behavior, regex kosong, error UX, serta parity Go/JavaScript.[0m[0m
[0m[0m
[m[1m### Prioritas P2 — regression proof dan acceptance test[0m[0m
[0m[0m
13. [1mTambahkan fixture compatibility matrix.[22m  [0m[0m
   Minimal: legacy service dengan seluruh key yang dipetakan, empat announcement inserts, song books berbeda, lyric override, image URL/file, field kosong, unknown token, archived field, dan layout yang kemudian berubah.[0m[0m
[0m[0m
14. [1mDefinisikan equality untuk slide plan dan PPTX.[22m  [0m[0m
   Gunakan canonicalized plan comparison dan normalized Open XML comparison; jangan mengandalkan ZIP byte equality.[0m[0m
[0m[0m
15. [1mBuktikan semua absence guard secara RED → GREEN.[22m  [0m[0m
   Tiket 06 sudah menyebut prinsip ini. Perlu daftar defect injection yang spesifik dan evidence bahwa setiap guard benar-benar gagal sebelum dikembalikan.[0m[0m
[0m[0m
16. [1mTambahkan transition/rollout test.[22m  [0m[0m
   Uji create/update payload legacy dan dynamic selama fase dual-write, lalu pastikan tidak ada data yang diam-diam hilang.[0m[0m
[0m[0m
[m[1m## Putusan akhir[0m[0m
[0m[0m
[1mArah SPEC-46 benar, tetapi belum cukup presisi untuk mulai implementasi tanpa risiko regresi dan tanpa mengurangi maksud “semua configurable” dari user.[22m[0m[0m
[0m[0m
Dua perubahan paling penting adalah:[0m[0m
1. menjadikan pengelolaan layout dapat diakses langsung dalam konteks worship new/edit untuk admin; dan[0m[0m
2. melengkapi kontrak seeder + migration snapshot agar layanan lama, field yang diarsipkan, dan baseline SPEC-45 benar-benar aman.[0m[0m
[0m[0m
Setelah P0 di atas masuk ke SPEC dan tiket terkait, rencana akan jauh lebih setia terhadap prompting asli serta dapat diuji secara objektif terhadap klaim “tidak membuat broken apa yang sudah bagus.”

[m> [0mSaya akan meninjau struktur implementasi yang ada—form service, parsing rundown, dan hydration slide plan—agar rekomendasinya cocok dengan kode saat ini, bukan sekadar pola generik.[0m[0m
[0m[0m
[0m[0m
[0m[0m
[0m[0m
Searching for symbols matching: [m"EditForm"[0m in [m.[0m[m (using tool: code)[0mSearching for symbols matching: [m"RunSheetPage"[0m in [m.[0m[m (using tool: code)[0mSearching for symbols matching: [m"Hydrate"[0m in [minternal[0m[m (using tool: code)[0mSearching for symbols matching: [m"Parse"[0m in [minternal[0m[m (using tool: code)[0mBatch fs_read operation with [m4[0m operations[m (using tool: read)[0m
Purpose: Read applicable project code guides and codebase map.

↱ Operation 1: Reading file: [m.constitution/project/codebase-stack-guide.md[0m, all lines
↱ Operation 2: Reading file: [m.constitution/project/codebase-conventions-guide.md[0m, all lines
↱ Operation 3: Reading file: [m.constitution/project/codebase-brownfield-guide.md[0m, all lines
↱ Operation 4: Reading file: [m.control/structure-codebase.md[0m, all lines
[2K[1G[1A[?25l
  1. [mFunction[0m [mEditForm[0m at [msrc\operator\EditForm.tsx[0m:[m54:16
[0m[m - Completed in 5.147s[0m


[2K[1G[1A[?25l
  1. [mFunction[0m [mRunSheetPage[0m at [mspa\src\pages\RunSheetPage.tsx[0m:[m11:16
[0m  2. [mFunction[0m [mrun[0m at [m.agents\skills\bmad-advanced-elicitation\scripts\tests\test_pick_methods.py[0m:[m143:1
[0m  3. [mFunction[0m [mrun[0m at [m.claude\skills\bmad-advanced-elicitation\scripts\tests\test_pick_methods.py[0m:[m143:1
[0m  4. [mFunction[0m [mrun[0m at [m.claude\skills\bmad-deep-recon\scripts\tests\test_recon_kit.py[0m:[m56:1
[0m  5. [mFunction[0m [mrun[0m at [mscripts\dev.mjs[0m:[m9:1
[0m  [m(1 more items found)
[0m[m - Completed in 0.160s[0m


[2K[1G[1A[?25l
  1. [mFunction[0m [mhydrateArtifact[0m at [minternal\plan\hydrate.go[0m:[m107:1
[0m  2. [mFunction[0m [mhydrateOne[0m at [minternal\plan\plan.go[0m:[m606:1
[0m  3. [mFunction[0m [mTestHydrateInlineTokensAndUnknown[0m at [minternal\plan\hydrate_test.go[0m:[m51:1
[0m  4. [mFunction[0m [mTestHydrateWelcomeFromSeed[0m at [minternal\plan\hydrate_test.go[0m:[m10:1
[0m[m - Completed in 0.80s[0m


[2K[1G[1A[?25l
  1. [mFunction[0m [mParseScriptureValueWithProfile[0m at [minternal\parse\parser.go[0m:[m262:1
[0m  2. [mType[0m [mParsedRundown[0m at [minternal\plan\types.go[0m:[m133:1
[0m  3. [mType[0m [mParsedFontMetadata[0m at [minternal\pptximport\font_extract.go[0m:[m194:1
[0m  4. [mType[0m [mParserProfile[0m at [minternal\parse\profile.go[0m:[m43:1
[0m  5. [mFunction[0m [mParseObfuscationKey[0m at [minternal\pptximport\font_extract.go[0m:[m29:1
[0m  [m(15 more items found)
[0m[m - Completed in 0.80s[0m


[m ✓ [0mSuccessfully read [38;5;244m4191 bytes[0m from .constitution\project\codebase-stack-guide.md

[m ✓ [0mSuccessfully read [38;5;244m6139 bytes[0m from .constitution\project\codebase-conventions-guide.md

[m ✓ [0mSuccessfully read [38;5;244m2606 bytes[0m from .constitution\project\codebase-brownfield-guide.md

[m ✓ [0mSuccessfully read [38;5;244m5809 bytes[0m from .control\structure-codebase.md

 ⋮ 

[m- [0mSummary: 4 operations processed, 4 successful, 0 failed
[m - Completed in 0.1s[0m

Looking up symbols: ["[mEditForm[0m"][0m in [msrc/operator/EditForm.tsx[0m[m (using tool: code)[0mLooking up symbols: ["[mRunSheetPage[0m"][0m in [mspa/src/pages/RunSheetPage.tsx[0m[m (using tool: code)[0mLooking up symbols: ["[mhydrateArtifact[0m"][0m in [minternal/plan/hydrate.go[0m[m (using tool: code)[0mLooking up symbols: ["[mParseRundown[0m", "[mParseRundownWithProfile[0m"][0m in [minternal/parse/parser.go[0m[m (using tool: code)[0mSearching for symbols matching: [m"BuildSlidePlan"[0m in [minternal[0m[m (using tool: code)[0mSearching for: [mCREATE TABLE IF NOT EXISTS (services|announcement_items|song_set|parser_profiles)|createService|parsed_rundown[0m in [minternal[0m ([m*.go[0m)[m (using tool: grep)[0m
[2K[1G[1A[?25l
Found [m1[0m of [m1[0m symbols:
  1. [mFunction[0m [mEditForm[0m at [msrc/operator/EditForm.tsx[0m:[m54:16
[0m[m - Completed in 0.83s[0m


[2K[1G[1A[?25l
Found [m1[0m of [m1[0m symbols:
  1. [mFunction[0m [mRunSheetPage[0m at [mspa/src/pages/RunSheetPage.tsx[0m:[m11:16
[0m[m - Completed in 0.81s[0m


[2K[1G[1A[?25l
Found [m1[0m of [m1[0m symbols:
  1. [mFunction[0m [mhydrateArtifact[0m at [minternal/plan/hydrate.go[0m:[m107:1
[0m[m - Completed in 0.82s[0m


[2K[1G[1A[?25l
Found [m2[0m of [m2[0m symbols:
  1. [mFunction[0m [mParseRundown[0m at [minternal/parse/parser.go[0m:[m303:1
[0m  2. [mFunction[0m [mParseRundownWithProfile[0m at [minternal/parse/parser.go[0m:[m311:1
[0m[m - Completed in 0.80s[0m


[2K[1G[1A[?25l
  1. [mFunction[0m [mBuildSlidePlan[0m at [minternal\plan\plan.go[0m:[m659:1
[0m[m - Completed in 0.80s[0m


[m ✓ [0mSuccessfully found [38;5;244m3 matches[0m in [38;5;244m3 files[0m under internal
[m - Completed in 0.19s[0m

[m> [0mTemuan awalnya penting: planner memang sudah melakukan substitusi token generik dari [mmap[string]interface{}[0m dan mendukung token inline, tetapi form serta parser saat ini masih berpusat pada struktur [mParsedRundown[0m yang fixed. Saya lanjutkan dengan memeriksa batas kontrak service dan snapshot agar desain migrasinya aman bagi service lama.[0m[0m
[0m[0m
[0m[0m
[0m[0m
[0m[0m
[0m[0m
Looking up symbols: ["[mBuildSlidePlan[0m", "[mParseRundownJSON[0m"][0m in [minternal/plan/plan.go[0m[m (using tool: code)[0mLooking up symbols: ["[mParsedRundown[0m", "[mParsedSermon[0m", "[mParsedScripture[0m", "[mParsedItem[0m", "[mTemplate[0m", "[mSnapshot[0m"][0m in [minternal/plan/types.go[0m[m (using tool: code)[0mLooking up symbols: ["[mParserProfile[0m", "[mDefaultParserProfile[0m"][0m in [minternal/parse/profile.go[0m[m (using tool: code)[0mSearching for symbols matching: [m"createService"[0m in [minternal/httpapi[0m[m (using tool: code)[0mSearching for symbols matching: [m"updateService"[0m in [minternal/httpapi[0m[m (using tool: code)[0mBatch fs_read operation with [m3[0m operations[m (using tool: read)[0m
Purpose: Inspect current schema and form state/rendering.

↱ Operation 1: Reading file: [minternal/db/migrate.go[0m, from line [m1[0m to [m430[0m
↱ Operation 2: Reading file: [msrc/operator/EditForm.tsx[0m, from line [m54[0m to [m270[0m
↱ Operation 3: Reading file: [msrc/operator/EditForm.tsx[0m, from line [m830[0m to end of file
[2K[1G[1A[?25l
Found [m2[0m of [m2[0m symbols:
  1. [mFunction[0m [mBuildSlidePlan[0m at [minternal/plan/plan.go[0m:[m659:1
[0m  2. [mFunction[0m [mParseRundownJSON[0m at [minternal/plan/plan.go[0m:[m714:1
[0m[m - Completed in 0.80s[0m


[2K[1G[1A[?25l
Found [m6[0m of [m6[0m symbols:
  1. [mType[0m [mParsedRundown[0m at [minternal/plan/types.go[0m:[m133:1
[0m  2. [mType[0m [mParsedSermon[0m at [minternal/plan/types.go[0m:[m118:1
[0m  3. [mType[0m [mParsedScripture[0m at [minternal/plan/types.go[0m:[m112:1
[0m  4. [mType[0m [mParsedItem[0m at [minternal/plan/types.go[0m:[m123:1
[0m  5. [mType[0m [mTemplate[0m at [minternal/plan/types.go[0m:[m43:1
[0m  [m(1 more items found)
[0m[m - Completed in 0.80s[0m


[2K[1G[1A[?25l
Found [m2[0m of [m2[0m symbols:
  1. [mType[0m [mParserProfile[0m at [minternal/parse/profile.go[0m:[m43:1
[0m  2. [mFunction[0m [mDefaultParserProfile[0m at [minternal/parse/profile.go[0m:[m73:1
[0m[m - Completed in 0.80s[0m


[2K[1G[1A[?25l
  1. [mMethod[0m [mcreateService[0m at [minternal\httpapi\services.go[0m:[m76:1
[0m  2. [mMethod[0m [mcreateArtifact[0m at [minternal\httpapi\registry.go[0m:[m159:1
[0m  3. [mMethod[0m [mcreateParserProfile[0m at [minternal\httpapi\parser_profiles.go[0m:[m187:1
[0m  4. [mMethod[0m [mcreateSongSetEntry[0m at [minternal\httpapi\song_set_entries.go[0m:[m112:1
[0m  5. [mFunction[0m [mcreateImagePart[0m at [minternal\httpapi\background_library_test.go[0m:[m19:1
[0m  [m(1 more items found)
[0m[m - Completed in 0.80s[0m


[2K[1G[1A[?25l
  1. [mMethod[0m [mupdateService[0m at [minternal\httpapi\services.go[0m:[m486:1
[0m  2. [mMethod[0m [mupdateParserProfile[0m at [minternal\httpapi\parser_profiles.go[0m:[m295:1
[0m  3. [mType[0m [mupdateParserProfileRequest[0m at [minternal\httpapi\parser_profiles.go[0m:[m288:1
[0m[m - Completed in 0.81s[0m


[m ✓ [0mSuccessfully read [38;5;244m10399 bytes[0m from internal\db\migrate.go

[m ✓ [0mSuccessfully read [38;5;244m8458 bytes[0m from src\operator\EditForm.tsx

[m ✓ [0mSuccessfully read [38;5;244m26131 bytes[0m from src\operator\EditForm.tsx

 ⋮ 

[m- [0mSummary: 3 operations processed, 3 successful, 0 failed
[m - Completed in 0.1s[0m

Looking up symbols: ["[mcreateService[0m", "[mupdateService[0m"][0m in [minternal/httpapi/services.go[0m[m (using tool: code)[0mBatch fs_read operation with [m3[0m operations[m (using tool: read)[0m
Purpose: Inspect service persistence, planner context, form save flow, and locate schema source.

↱ Operation 1: Reading directory: [minternal/db[0m
↱ Operation 2: Reading file: [minternal/plan/plan.go[0m, from line [m1[0m to [m829[0m
↱ Operation 3: Reading file: [msrc/operator/EditForm.tsx[0m, from line [m270[0m to [m830[0mSearching for: [mfunc computeCtx|func nodesFor|func resolvePlaceholderValue|CREATE TABLE IF NOT EXISTS services[0m in [minternal[0m ([m*.go[0m)[m (using tool: grep)[0m
[2K[1G[1A[?25l
Found [m2[0m of [m2[0m symbols:
  1. [mMethod[0m [mcreateService[0m at [minternal/httpapi/services.go[0m:[m76:1
[0m  2. [mMethod[0m [mupdateService[0m at [minternal/httpapi/services.go[0m:[m486:1
[0m[m - Completed in 0.80s[0m


[m ✓ [0mSuccessfully read directory [38;5;141minternal\db[0m [38;5;244m(22 entries)[0m

[m ✓ [0mSuccessfully read [38;5;244m20274 bytes[0m from internal\plan\plan.go

[m ✓ [0mSuccessfully read [38;5;244m19121 bytes[0m from src\operator\EditForm.tsx

 ⋮ 

[m- [0mSummary: 3 operations processed, 3 successful, 0 failed
[m - Completed in 0.1s[0m


[m ✓ [0mSuccessfully found [38;5;244m3 matches[0m in [38;5;244m2 files[0m under internal
[m - Completed in 0.12s[0m

Batch fs_read operation with [m3[0m operations[m (using tool: read)[0m
Purpose: Review existing predefined-field and service value persistence migrations.

↱ Operation 1: Reading file: [minternal/db/migrate_predefined_fields.go[0m, all lines
↱ Operation 2: Reading file: [minternal/db/schema.sql[0m, all lines
↱ Operation 3: Reading file: [minternal/db/migrate_song_set_inputs.go[0m, all linesSearching for symbols matching: [m"PredefinedField"[0m in [minternal[0m[m (using tool: code)[0mSearching for symbols matching: [m"FormLayout"[0m in [mspa[0m[m (using tool: code)[0mSearching for symbols matching: [m"previewService"[0m in [minternal[0m[m (using tool: code)[0mSearching for: [mform_group|predefined_field|field_values|layout.*field|announcementInserts[0m in [minternal[0m ([m*.go[0m)[m (using tool: grep)[0m
[m ✓ [0mSuccessfully read [38;5;244m5971 bytes[0m from internal\db\migrate_predefined_fields.go

[m ✓ [0mSuccessfully read [38;5;244m6463 bytes[0m from internal\db\schema.sql

[m ✓ [0mSuccessfully read [38;5;244m4494 bytes[0m from internal\db\migrate_song_set_inputs.go

 ⋮ 

[m- [0mSummary: 3 operations processed, 3 successful, 0 failed
[m - Completed in 0.0s[0m


[2K[1G[1A[?25l
  1. [mFunction[0m [mmigratePredefinedFields[0m at [minternal\db\migrate_predefined_fields.go[0m:[m19:1
[0m  2. [mFunction[0m [mFindUnknownPredefinedFieldTokens[0m at [minternal\plan\validate_artifact.go[0m:[m726:1
[0m  3. [mFunction[0m [mpredefinedKeyMap[0m at [minternal\db\migrate_predefined_fields.go[0m:[m180:1
[0m[m - Completed in 0.90s[0m


[2K[1G[1A[?25l
No symbols found (scoped to: spa)
[m - Completed in 0.8s[0m


[2K[1G[1A[?25l
  1. [mMethod[0m [mpreviewService[0m at [minternal\httpapi\services.go[0m:[m797:1
[0m[m - Completed in 0.91s[0m


[m ✓ [0mSuccessfully found [38;5;244m25 matches[0m in [38;5;244m7 files[0m under internal
[m - Completed in 0.33s[0m

Looking up symbols: ["[mFindUnknownPredefinedFieldTokens[0m"][0m in [minternal/plan/validate_artifact.go[0m[m (using tool: code)[0mLooking up symbols: ["[mpreviewService[0m"][0m in [minternal/httpapi/services.go[0m[m (using tool: code)[0mBatch fs_read operation with [m2[0m operations[m (using tool: read)[0m
Purpose: Verify migration execution and media loading boundaries.

↱ Operation 1: Reading file: [minternal/db/bootstrap.go[0m, from line [m1[0m to [m80[0m
↱ Operation 2: Reading file: [minternal/plan/media.go[0m, from line [m1[0m to [m180[0m
[2K[1G[1A[?25l
Found [m1[0m of [m1[0m symbols:
  1. [mFunction[0m [mFindUnknownPredefinedFieldTokens[0m at [minternal/plan/validate_artifact.go[0m:[m726:1
[0m[m - Completed in 0.85s[0m


[2K[1G[1A[?25l
Found [m1[0m of [m1[0m symbols:
  1. [mMethod[0m [mpreviewService[0m at [minternal/httpapi/services.go[0m:[m797:1
[0m[m - Completed in 0.2s[0m


[m ✓ [0mSuccessfully read [38;5;244m2465 bytes[0m from internal\db\bootstrap.go

[m ✓ [0mSuccessfully read [38;5;244m4325 bytes[0m from internal\plan\media.go

 ⋮ 

[m- [0mSummary: 2 operations processed, 2 successful, 0 failed
[m - Completed in 0.0s[0m

[m> [0m[m[1m## Verdict: feasible, and directionally correct[0m[0m
[0m[0m
[1mYa, visi ini sangat feasible[22m di Go + SQLite + React/Vite, dan fondasinya sebagian sudah ada di codebase saat ini. Namun ini bukan sekadar refactor [mEditForm[0m; ini adalah perubahan dari [1mfixed service form[22m menjadi [1mconfiguration-driven form engine[22m yang perlu dipisahkan dengan jelas dari [1mslide-plan engine[22m.[0m[0m
[0m[0m
Dari implementasi saat ini:[0m[0m
[0m[0m
- [mEditForm.tsx[0m masih merender card dan field yang fixed.[0m[0m
- [mParsedRundown[0m, [mcomputeCtx[0m, [mcatalogValues[0m, dan [mnodesFor[0m di [minternal/plan[0m masih mengenal domain field secara hardcoded.[0m[0m
- [mrundown_parser_profiles[0m sudah merupakan fondasi baik untuk konfigurasi parsing.[0m[0m
- [msong_set_entries[0m dan [msong_set_inputs[0m sudah membuktikan pola “master-defined fields + per-service values”.[0m[0m
- [mhydrateArtifact()[0m di [minternal/plan/hydrate.go[0m sudah menerima [mmap[string]interface{}[0m dan mendukung token inline seperti [m{some_variable}[0m. Ini bagian paling penting: [1mcanvas/template hydration sudah hampir siap menjadi dinamis[22m.[0m[0m
- Tetapi validator token masih memiliki whitelist [mcatalogKeys[0m, sehingga token custom saat ini masih ditandai unknown.[0m[0m
- Service juga sudah punya snapshot registry untuk menjaga slide artifact yang dipakai sebuah kebaktian. Form/layout configuration perlu memperoleh konsep snapshot yang sama.[0m[0m
[0m[0m
Jadi verdict-nya: [1mgo ahead, tetapi gunakan desain hybrid dan migrasi bertahap. Jangan mengganti seluruh flow sekaligus.[22m[0m[0m
[0m[0m
[m[1m## Prinsip desain paling penting[0m[0m
[0m[0m
[m[1m### 1. Pisahkan tiga konsep yang saat ini mudah tercampur[0m[0m
[0m[0m
| Konsep | Fungsi | Mengubah apa |[0m[0m
|---|---|---|[0m[0m
| [1mForm layout[22m | Mengatur card/grouping dan urutan input di halaman edit | UX operator |[0m[0m
| [1mField definition[22m | Mendefinisikan [mvariable_name[0m, label, tipe, regex, dan aturan render | Data yang dapat dikumpulkan |[0m[0m
| [1mPresentation/slide sequence[22m | Mengatur urutan artifact, song, announcement set, dan slide | Output slideshow/PPTX |[0m[0m
[0m[0m
Contohnya, memindahkan [mSermon Speaker[0m dari card “Sermon” ke card “Afternoon Program” [1mtidak boleh otomatis memindahkan slide sermon dalam deck[22m. Itu hanya mengubah lokasi input di editor.[0m[0m
[0m[0m
Demikian pula:[0m[0m
[0m[0m
- [mannouncement slot 1[0m dapat ditempatkan di grouping/card mana pun untuk memudahkan operator.[0m[0m
- Tetapi urutan slide announcement tetap dikendalikan oleh [mannouncement_sets[0m, marker/registry artifact, dan snapshot service.[0m[0m
- Song Set dapat dipindahkan antar-card untuk UX, tetapi tetap mempunyai identity sendiri ([mopening_song_bt[0m, atau future custom key) dan memiliki renderer/planner khusus.[0m[0m
[0m[0m
Jika gereja kelak ingin pengaturan urutan form [1msekaligus[22m mengatur urutan slide, itu harus menjadi fitur kedua dengan model [mpresentation_sequence[0m sendiri—bukan efek samping dari drag-and-drop card form.[0m[0m
[0m[0m
[m[1m### 2. “Configurable” tidak berarti semua invariant boleh dihapus[0m[0m
[0m[0m
Tetap perlu ada protected/system contracts:[0m[0m
[0m[0m
- [mservice.date[0m tetap dibutuhkan sebagai identitas kebaktian.[0m[0m
- Rundown textarea tetap fixed di kiri atas, sesuai requirement.[0m[0m
- Live preview tetap fixed/sticky di kanan atas.[0m[0m
- Empat announcement slot tetap [m1..4[0m.[0m[0m
- URL image tetap harus melalui validasi upload/allowlist server-side.[0m[0m
- [mvariable_name[0m yang sudah dipakai service/template tidak boleh diubah sembarangan.[0m[0m
- Planner tetap satu-satunya sumber urutan slide untuk preview, projector, dan PPTX.[0m[0m
[0m[0m
Yang configurable adalah [1mfield, grouping, label, placement, parsing rule, dan binding[22m, bukan batas keamanan atau contract runtime.[0m[0m
[0m[0m
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[0m[0m
[0m[0m
[m[1m## 1. Keuntungan dan trade-off dibanding sistem sekarang[0m[0m
[0m[0m
[m[1m### Keuntungan[0m[0m
[0m[0m
1. [1mCocok untuk banyak tradisi gereja[22m  [0m[0m
  Gereja dapat memiliki “Song Set”, “Sabbath School”, “Afternoon Program”, “Family Prayer”, “Mission Spotlight”, atau struktur lain tanpa meminta perubahan source code.[0m[0m
[0m[0m
2. [1mHardcoded default berubah menjadi starter configuration[22m  [0m[0m
  Verse reading, sermon speaker, family/youth, dan poster tidak lagi diperlakukan sebagai universal truth; semuanya adalah default yang boleh diubah.[0m[0m
[0m[0m
3. [1mTemplate slide benar-benar menjadi data-driven[22m  [0m[0m
  Admin dapat membuat field [mmission_story[0m, lalu menggunakan [m{mission_story}[0m pada canvas tanpa Go struct baru atau perubahan planner per variabel.[0m[0m
[0m[0m
4. [1mParser lebih adaptif per gereja[22m  [0m[0m
  Regex dapat mengikuti istilah lokal seperti [mPembacaan Alkitab[0m, [mScripture Reading[0m, [mFirman Tuhan[0m, atau format rundown yang berbeda.[0m[0m
[0m[0m
5. [1mUI lebih maintainable setelah transisi[22m  [0m[0m
  Daripada menambah card dan state baru setiap fitur, frontend hanya menambah renderer bila ada [3mjenis widget baru[23m.[0m[0m
[0m[0m
[m[1m### Trade-off dan risiko[0m[0m
[0m[0m
1. [1mKompleksitas administrasi meningkat[22m  [0m[0m
  Admin perlu memahami label, variable name, regex, grouping, dan dampaknya terhadap template. Karena itu perlu UX admin yang aman, preview, dan validation yang kuat.[0m[0m
[0m[0m
2. [1mTidak semua field dapat diperlakukan sebagai [m<Input>[0m generik[22m  [0m[0m
  Song Set, announcement slot, scripture resolver, dan image upload punya perilaku domain yang spesifik. Engine harus mendukung [3mspecialized widget kinds[23m, bukan memaksakan semua menjadi field biasa.[0m[0m
[0m[0m
3. [1mRegex adalah konfigurasi yang powerful tetapi berisiko membingungkan[22m  [0m[0m
  Regex salah dapat gagal menemukan data atau mengambil nilai yang salah. UI perlu test panel dengan contoh rundown, diagnostics, dan hasil extraction yang dapat diterima/reject operator.[0m[0m
[0m[0m
4. [1mPerubahan layout harus tidak mengubah service lama diam-diam[22m  [0m[0m
  Tanpa snapshot/versioning, penghapusan field bisa membuat data service lama tidak tampak atau slide lama berubah hasilnya.[0m[0m
[0m[0m
5. [1mPerlu bridge sementara untuk data dan template lama[22m  [0m[0m
  Planner sekarang memiliki path fixed yang cukup besar. Menghapusnya langsung akan berisiko pada generation PPTX dan existing service.[0m[0m
[0m[0m
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[0m[0m
[0m[0m
[m[1m## 2. Data model SQLite yang direkomendasikan[0m[0m
[0m[0m
Saya menyarankan [1mhybrid relational model[22m, bukan satu JSON besar.[0m[0m
[0m[0m
- Definisi field, grouping, dan binding harus relational karena perlu uniqueness, ordering, referential integrity, validation, query, dan migration.[0m[0m
- Nilai service disimpan sebagai value row yang typed/flexible ([mvalue_json[0m) karena field dapat bertambah tanpa migrasi kolom.[0m[0m
- Song set tetap memakai tabel khusus yang sudah ada karena memiliki struktur kompleks dan lifecycle sendiri.[0m[0m
- Announcement slot juga layak memakai storage khusus atau value map yang tervalidasi karena jumlahnya fixed dan dihubungkan ke sequence slide.[0m[0m
[0m[0m
[m[1m### A. Form layout dan grouping[0m[0m
[0m[0m
[1msql
[0m[mCREATE TABLE form_layouts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX one_active_form_layout
  ON form_layouts(is_active)
  WHERE is_active = 1;

CREATE TABLE form_groupings (
  id TEXT PRIMARY KEY,
  layout_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (layout_id) REFERENCES form_layouts(id) ON DELETE CASCADE,
  UNIQUE(layout_id, position)
);
[0m[0m[0m
[0m[0m
[mform_layouts[0m memungkinkan future support untuk beberapa layout profile, misalnya “Sabbath Service”, “Youth Service”, atau “Midweek Prayer”. Untuk fase awal, cukup satu active layout.[0m[0m
[0m[0m
[m[1m### B. Predefined/custom field definitions[0m[0m
[0m[0m
[1msql
[0m[mCREATE TABLE predefined_fields (
  id TEXT PRIMARY KEY,
  seed_key TEXT UNIQUE,
  variable_name TEXT NOT NULL UNIQUE,
  shown_text TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (
    field_type IN ('text', 'textarea', 'image')
  ),

  input_length INTEGER,
  initial_lines INTEGER,

  extraction_regex TEXT,
  extraction_capture TEXT NOT NULL DEFAULT 'value',
  extraction_mode TEXT NOT NULL DEFAULT 'first'
    CHECK (extraction_mode IN ('first', 'last', 'all')),

  is_active INTEGER NOT NULL DEFAULT 1,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  CHECK (
    (field_type = 'text' AND input_length IS NOT NULL AND initial_lines IS NULL)
    OR
    (field_type = 'textarea' AND initial_lines IS NOT NULL AND input_length IS NULL)
    OR
    (field_type = 'image' AND input_length IS NULL AND initial_lines IS NULL)
  )
);
[0m[0m[0m
[0m[0m
Rekomendasi: [1mjangan menyatukan Song Set dengan [mpredefined_fields[0m[22m. Song Set bukan scalar field; ia adalah domain widget yang mempunyai hymn lookup, lyrics, book, background, lyric override, dan save-to-book.[0m[0m
[0m[0m
Untuk [mannouncement slot[0m, ada dua opsi:[0m[0m
[0m[0m
- Menjadikannya [mfield_type = 'announcement-slot'[0m, dengan field configuration yang menunjuk slot [m1..4[0m.[0m[0m
- Lebih bersih: menjadikannya [mgrouping item kind[0m tersendiri, karena ia bukan field scalar biasa.[0m[0m
[0m[0m
Saya lebih menyarankan opsi kedua.[0m[0m
[0m[0m
[m[1m### C. Binding item ke grouping[0m[0m
[0m[0m
[1msql
[0m[mCREATE TABLE form_grouping_items (
  id TEXT PRIMARY KEY,
  grouping_id TEXT NOT NULL,
  position INTEGER NOT NULL,

  item_kind TEXT NOT NULL CHECK (
    item_kind IN ('field', 'song_set', 'announcement_slot')
  ),

  field_id TEXT,
  song_set_variable_name TEXT,
  announcement_slot INTEGER,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (grouping_id) REFERENCES form_groupings(id) ON DELETE CASCADE,
  FOREIGN KEY (field_id) REFERENCES predefined_fields(id),

  CHECK (
    (item_kind = 'field'
      AND field_id IS NOT NULL
      AND song_set_variable_name IS NULL
      AND announcement_slot IS NULL)
    OR
    (item_kind = 'song_set'
      AND field_id IS NULL
      AND song_set_variable_name IS NOT NULL
      AND announcement_slot IS NULL)
    OR
    (item_kind = 'announcement_slot'
      AND field_id IS NULL
      AND song_set_variable_name IS NULL
      AND announcement_slot BETWEEN 1 AND 4)
  ),

  UNIQUE(grouping_id, position)
);
[0m[0m[0m
[0m[0m
Dengan bentuk ini:[0m[0m
[0m[0m
- grouping “Song Set” dapat mengandung [mopening_song_bt[0m, [mclosing_song_bt[0m, dan [mopening_song_dw[0m;[0m[0m
- grouping “Afternoon Program” dapat mengandung [mannouncement slot 1[0m, [mspecial_song[0m, dan [msermon_speaker_name[0m;[0m[0m
- satu field boleh tampil paling banyak sekali per layout pada fase awal. Jika ingin reusable placement di masa depan, tambahkan explicit [mdisplay_mode[0m atau izinkan binding ganda secara sengaja.[0m[0m
[0m[0m
[m[1m### D. Nilai custom field per service[0m[0m
[0m[0m
[1msql
[0m[mCREATE TABLE service_field_values (
  service_id INTEGER NOT NULL,
  field_id TEXT NOT NULL,

  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'parsed', 'imported', 'migration')),
  extracted_from_hash TEXT,
  updated_at TEXT NOT NULL,

  PRIMARY KEY (service_id, field_id),
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);
[0m[0m[0m
[0m[0m
Contoh [mvalue_json[0m:[0m[0m
[0m[0m
[1mjson
[0m[m"Pr. Contoh"
[0m[0m[0m
[0m[0m
[1mjson
[0m[m"Roma 8:28"
[0m[0m[0m
[0m[0m
[1mjson
[0m[m"/api/uploads/abc123....jpg"
[0m[0m[0m
[0m[0m
Mengapa ini lebih baik daripada hanya [mservices.field_values_json[0m?[0m[0m
[0m[0m
- definisi field dapat di-query dan diaudit;[0m[0m
- nilai dapat dimigrasikan dan divalidasi per field type;[0m[0m
- konflik concurrent update lebih mudah ditangani;[0m[0m
- tidak perlu menambah kolom [msermon_speaker[0m, [mfamily_name[0m, dan seterusnya;[0m[0m
- tetap fleksibel untuk future field structured values.[0m[0m
[0m[0m
Namun [mvalue_json[0m tidak boleh menjadi tempat untuk menyimpan raw file. Untuk image, nilainya hanya asset reference/URL yang sudah diverifikasi server.[0m[0m
[0m[0m
[m[1m### E. Snapshot layout untuk service[0m[0m
[0m[0m
Agar perubahan admin tidak mengubah service lama secara diam-diam:[0m[0m
[0m[0m
[1msql
[0m[mCREATE TABLE service_form_layout_snapshots (
  service_id INTEGER PRIMARY KEY,
  layout_id TEXT NOT NULL,
  layout_version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);
[0m[0m[0m
[0m[0m
Snapshot JSON perlu memuat grouping, item bindings, dan field definitions yang relevan. Ini bukan source of truth layout aktif; ini adalah historical contract service.[0m[0m
[0m[0m
Perilaku yang disarankan:[0m[0m
[0m[0m
- Service baru mengambil snapshot active layout saat dibuat.[0m[0m
- Service lama memperoleh snapshot hasil backfill dari seeded default layout.[0m[0m
- Admin dapat memiliki aksi eksplisit [1mSync Form Layout[22m jika memang ingin service tertentu mengikuti layout baru.[0m[0m
- Tidak ada auto-sync layout.[0m[0m
[0m[0m
Ini konsisten dengan pola registry snapshot yang sudah ada di project.[0m[0m
[0m[0m
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[0m[0m
[0m[0m
[m[1m## 3. Arsitektur React form engine[0m[0m
[0m[0m
[m[1m### Layout halaman fixed yang disarankan[0m[0m
[0m[0m
Struktur page perlu tetap eksplisit agar rule layout utama terjamin:[0m[0m
[0m[0m
[1mtsx
[0m[m<ServiceEditorShell>
  <RundownPanel />        // fixed: kiri atas
  <LiveSlidePreview />    // fixed: kanan atas, sticky
  <GroupingCardList />    // configurable: di bawah rundown
</ServiceEditorShell>
[0m[0m[0m
[0m[0m
Secara layout:[0m[0m
[0m[0m
[1mtext
[0m[m┌──────────────────────── Rundown textarea ───────────────────────┬──────── Live Preview ────────┐
│ Parser profile · Parse · diagnostics                              │ sticky                        │
├──────────────────── configurable grouping cards ──────────────────┤ slide list / live preview     │
│ [Song Set] [Sermon & Scripture] [Afternoon Program] ...          │                               │
└──────────────────────────────────────────────────────────────────┴───────────────────────────────┘
[0m[0m[0m
[0m[0m
[mEditForm.tsx[0m kemudian tidak lagi mempunyai rangkaian hardcoded [mCard Bible Talk[0m, [mCard Sermon[0m, [mCard Family[0m, dan sebagainya.[0m[0m
[0m[0m
[m[1m### Renderer registry, bukan conditional besar[0m[0m
[0m[0m
Gunakan registry renderer berdasarkan [mitem_kind[0m dan [mfield_type[0m:[0m[0m
[0m[0m
[1mts
[0m[mtype FormItem =
  | { kind: 'field'; field: PredefinedField; value: FieldValue }
  | { kind: 'song_set'; variableName: string; title: string; value: SongSetValue }
  | { kind: 'announcement_slot'; slot: 1 | 2 | 3 | 4; value: string };

const itemRenderers = {
  field: DynamicFieldRenderer,
  song_set: SongSetRenderer,
  announcement_slot: AnnouncementSlotRenderer,
};
[0m[0m[0m
[0m[0m
[mDynamicFieldRenderer[0m lalu menangani:[0m[0m
[0m[0m
| Field type | React renderer |[0m[0m
|---|---|[0m[0m
| [mtext[0m | [m<Input>[0m dengan visual width/size dari [minput_length[0m |[0m[0m
| [mtextarea[0m | [m<Textarea rows={initial_lines}>[0m |[0m[0m
| [mimage[0m | Existing/reusable [mImageUploadField[0m dengan layout tiga kolom |[0m[0m
| [msong_set[0m | Specialized [mSongSetRenderer[0m |[0m[0m
| [mannouncement_slot[0m | Specialized [mAnnouncementSlotRenderer[0m |[0m[0m
[0m[0m
[m[1m### Specialized renderers tetap diperlukan[0m[0m
[0m[0m
Jangan mencoba menjadikan Song Set sebagai JSON generic dengan renderer textarea/select biasa. Song Set perlu mempertahankan perilaku yang sudah ada:[0m[0m
[0m[0m
- select song book;[0m[0m
- hymn number autocomplete;[0m[0m
- background selector;[0m[0m
- editor lyrics;[0m[0m
- Save to Book;[0m[0m
- parsing suggestion dan Accept;[0m[0m
- per-service lyric override.[0m[0m
[0m[0m
Image renderer juga perlu tetap tersentralisasi agar semua image field memakai rule yang sama:[0m[0m
[0m[0m
1. thumbnail preview;[0m[0m
2. choose file / paste allowed image URL;[0m[0m
3. upload/download/action controls;[0m[0m
4. server-side upload, URL validation, dan error state yang seragam.[0m[0m
[0m[0m
[m[1m### Lokasi admin management[0m[0m
[0m[0m
Saya menyarankan menu admin khusus:[0m[0m
[0m[0m
- [m/admin/form-layout[0m — grouping, urutan card, item binding, active layout.[0m[0m
- [m/admin/predefined-fields[0m — field definitions, labels, variable names, renderer properties, regex.[0m[0m
- [m/admin/form-layout/test[0m atau test drawer — paste sample rundown dan lihat hasil extraction.[0m[0m
- Canvas artifact editor tetap di [m/admin/artifacts[0m, tetapi mendapatkan daftar token dari API agar admin dapat memilih custom variable secara aman.[0m[0m
[0m[0m
Jangan izinkan operator biasa mengubah schema/layout dari service edit page. Mereka boleh mengisi values; admin yang mengubah definition dan form layout.[0m[0m
[0m[0m
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[0m[0m
[0m[0m
[m[1m## 4. Integrasi regex extraction dari rundown[0m[0m
[0m[0m
[m[1m### Jangan ubah parse menjadi langsung overwrite form state[0m[0m
[0m[0m
Rundown parsing sebaiknya menghasilkan [1mproposal[22m, bukan langsung dianggap sebagai canonical saved value.[0m[0m
[0m[0m
Model hasil parse yang lebih aman:[0m[0m
[0m[0m
[1mts
[0m[mtype ExtractionSuggestion = {
  fieldId: string;
  variableName: string;
  value: unknown;
  source: 'parsed';
  confidence: 'high' | 'normal';
  matchedText: string;
  regexVersion: string;
};
[0m[0m[0m
[0m[0m
Flow yang direkomendasikan:[0m[0m
[0m[0m
1. Normalisasi rundown ([mCRLF[0m, whitespace, line boundaries).[0m[0m
2. Parser profile memproses date, sections, role lines, dan song candidates.[0m[0m
3. Dynamic extraction engine menjalankan regex untuk setiap active text/textarea field.[0m[0m
4. Hasilnya dikembalikan sebagai suggestion/proposal.[0m[0m
5. UI menampilkan perubahan yang akan diterapkan.[0m[0m
6. Operator dapat:[0m[0m
   - Accept satu field;[0m[0m
   - Accept all;[0m[0m
   - mempertahankan value manual;[0m[0m
   - edit hasil sebelum save.[0m[0m
7. Nilai manual memiliki prioritas terhadap hasil parser sampai operator dengan sengaja menerima extraction baru.[0m[0m
[0m[0m
[m[1m### Contract regex yang disarankan[0m[0m
[0m[0m
Regex saja kurang cukup. Simpan metadata minimal:[0m[0m
[0m[0m
[1mjson
[0m[m{
  "pattern": "(?im)^Sermon\\s*:\\s*(?<value>.+)$",
  "capture": "value",
  "mode": "first"
}
[0m[0m[0m
[0m[0m
Aturan:[0m[0m
[0m[0m
- Gunakan regex Go/RE2; ini baik karena menghindari catastrophic backtracking klasik.[0m[0m
- Regex wajib dapat dikompilasi saat admin save, bukan saat service parse.[0m[0m
- Gunakan named capture [mvalue[0m sebagai default.[0m[0m
- Batasi panjang regex dan input rundown.[0m[0m
- Tampilkan preview match di admin test panel.[0m[0m
- Perlakukan multiline secara eksplisit.[0m[0m
- Catat [mmatchedText[0m untuk diagnostics.[0m[0m
[0m[0m
[m[1m### Hubungannya dengan Song Set matching[0m[0m
[0m[0m
Song matching harus tetap menjadi pipeline khusus:[0m[0m
[0m[0m
[1mtext
[0m[mRundown
  ├─ generic field extraction → text / textarea suggestions
  ├─ known structural parse → date / section / roles
  └─ hymn candidate detection → song set matching → song-set suggestions
[0m[0m[0m
[0m[0m
Song Set matching tidak perlu diubah menjadi regex custom field karena hasilnya bukan scalar sederhana. Ia memerlukan:[0m[0m
[0m[0m
- book code;[0m[0m
- number;[0m[0m
- title;[0m[0m
- lookup lyric;[0m[0m
- target Song Set slot;[0m[0m
- overflow diagnostics.[0m[0m
[0m[0m
Yang perlu dibuat configurable adalah [1mtarget song set entries dan placement-nya di grouping[22m, bukan menghapus specialized matcher.[0m[0m
[0m[0m
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[0m[0m
[0m[0m
[m[1m## 5. Dynamic slide-plan hydration[0m[0m
[0m[0m
Bagian ini justru relatif menguntungkan karena [mhydrateArtifact()[0m saat ini sudah bekerja dengan value map dan token inline.[0m[0m
[0m[0m
[m[1m### Target contract planner[0m[0m
[0m[0m
Planner sebaiknya menerima context seperti:[0m[0m
[0m[0m
[1mgo
[0m[mtype ServiceInputs struct {
    Values            map[string]any // variable_name -> scalar/image URL
    SongInputs        map[string]HymnItem
    AnnouncementSlots map[int]string
    ServiceDate       string
}
[0m[0m[0m
[0m[0m
Kemudian:[0m[0m
[0m[0m
[1mgo
[0m[mvalues := map[string]any{
    "sermon_speaker_name": "Pr. Contoh",
    "verse_reference": "Roma 8:28",
    "family_photo": "/api/uploads/example.jpg",
}
[0m[0m[0m
[0m[0m
Template yang menggunakan:[0m[0m
[0m[0m
[1mtext
[0m[m{sermon_speaker_name}
{verse_reference}
[0m[0m[0m
[0m[0m
akan hydrated tanpa Go mengetahui nama field tersebut satu per satu.[0m[0m
[0m[0m
[m[1m### Perubahan yang diperlukan pada current planner[0m[0m
[0m[0m
Saat ini ada hardcoding pada:[0m[0m
[0m[0m
- [mctx[0m;[0m[0m
- [mcomputeCtx[0m;[0m[0m
- [mcatalogValues[0m;[0m[0m
- [mnodesFor[0m;[0m[0m
- [mParsedRundown[0m;[0m[0m
- [mFindUnknownPredefinedFieldTokens[0m melalui [mcatalogKeys[0m.[0m[0m
[0m[0m
Arah refactor:[0m[0m
[0m[0m
1. [mservice_field_values[0m dibaca menjadi [mmap[variableName]any[0m.[0m[0m
2. [mgeneral[0m artifact menerima map dynamic tersebut.[0m[0m
3. Artifact validation mengambil allowed variables dari [mpredefined_fields[0m, bukan constant whitelist.[0m[0m
4. Image token hanya boleh menerima value dari field bertipe [mimage[0m.[0m[0m
5. Text token hanya boleh menerima scalar text/textarea value.[0m[0m
6. Song set dan announcement marker tetap ditangani sebagai node/renderer domain khusus.[0m[0m
7. Legacy [mnodesFor[0m tetap ada sementara untuk legacy artifacts yang belum dikonversi.[0m[0m
[0m[0m
[m[1m### Catatan kompatibilitas token[0m[0m
[0m[0m
Template existing menggunakan key seperti:[0m[0m
[0m[0m
- [mscripture_reference[0m[0m[0m
- [mscripture_text[0m[0m[0m
- [msermon_speaker_name[0m[0m[0m
- [msermon_poster[0m[0m[0m
- [mfamily_photo[0m[0m[0m
[0m[0m
Seeder sebaiknya [1mmempertahankan key existing tersebut[22m, walaupun label UI dapat dibuat lebih ramah seperti “Sermon Speaker” atau “Verse Reading Reference”.[0m[0m
[0m[0m
Jangan otomatis mengganti [msermon_speaker_name[0m menjadi [msermon_speaker[0m, karena itu akan merusak template dan service snapshot lama. Bila diperlukan, lakukan migrasi token yang explicit, versioned, dan dibuktikan lewat test.[0m[0m
[0m[0m
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[0m[0m
[0m[0m
[m[1m## 6. Adaptive seeder dan migrasi service existing[0m[0m
[0m[0m
[m[1m### Seeder harus memakai identity teknis, bukan label[0m[0m
[0m[0m
Gunakan [mseed_key[0m stabil, contohnya:[0m[0m
[0m[0m
[1mtext
[0m[mdefault.verse-reference
default.verse-text
default.sermon-speaker
default.sermon-graphic
default.closing-prayer
default.family-photo
default.family-name
default.family-request
default.youth-photo
default.youth-name
default.youth-request
[0m[0m[0m
[0m[0m
Seeder tidak boleh mencari berdasarkan [mshown_text[0m, karena admin bisa mengganti label.[0m[0m
[0m[0m
Pseudocode:[0m[0m
[0m[0m
[1mgo
[0m[mfunc SeedDefaultFormLayout(tx *sql.Tx) error {
    // Insert only if seed_key does not already exist.
    // Never overwrite a custom label, regex, position, type, or value.
    // Create missing default grouping only.
    // Create missing field-to-group binding only.
    // Append missing bindings safely without renumbering custom items.
}
[0m[0m[0m
[0m[0m
Untuk setiap entity gunakan pola:[0m[0m
[0m[0m
[1msql
[0m[mINSERT INTO predefined_fields (...)
VALUES (...)
ON CONFLICT(seed_key) DO NOTHING;
[0m[0m[0m
[0m[0m
Dan jalankan semuanya dalam satu transaction.[0m[0m
[0m[0m
[m[1m### Semantik tombol “Seed Default Predefined Field”[0m[0m
[0m[0m
Tombol manual tersebut sebaiknya:[0m[0m
[0m[0m
- membuat definition default yang hilang;[0m[0m
- membuat grouping default yang hilang;[0m[0m
- membuat binding default yang hilang;[0m[0m
- tidak menimpa field custom;[0m[0m
- tidak mengubah label/regex/properti field existing;[0m[0m
- tidak memindahkan grouping custom;[0m[0m
- tidak menghapus item mana pun;[0m[0m
- mengembalikan report: [mcreated[0m, [malready_present[0m, [mskipped[0m.[0m[0m
[0m[0m
Catatan penting: jika admin sengaja menghapus default, tindakan manual [1mSeed Default[22m memang boleh menciptakannya kembali. Jika kelak diinginkan “jangan pernah seed ulang item yang sengaja dihapus”, tambahkan tombstone table. Untuk requirement saat ini, tombol manual yang mengisi gap sudah sesuai.[0m[0m
[0m[0m
[m[1m### Migrasi service existing tanpa regresi[0m[0m
[0m[0m
Lakukan bertahap:[0m[0m
[0m[0m
1. Tambahkan schema baru tanpa mengubah pembacaan runtime.[0m[0m
2. Seed default definitions memakai [mvariable_name[0m legacy yang sudah dipakai template.[0m[0m
3. Backfill setiap service:[0m[0m
   - [mparsed_data[0m → [mservice_field_values[0m;[0m[0m
   - [mimages_payload[0m → image field values dan announcement slots;[0m[0m
   - [msong_set_inputs[0m tidak dipindah; tetap dipakai;[0m[0m
   - buat [mservice_form_layout_snapshot[0m.[0m[0m
4. Saat transition, planner memakai:[0m[0m
   - dynamic service values bila tersedia;[0m[0m
   - legacy [mparsed_data/images_payload[0m hanya sebagai fallback untuk nilai yang belum termigrasi.[0m[0m
5. Tambahkan test equivalence: plan untuk service lama sebelum/selepas migration harus identik.[0m[0m
6. Setelah beberapa release dan setelah seluruh database normal, hapus fallback legacy dengan migration yang explicit.[0m[0m
[0m[0m
Mapping backfill contoh:[0m[0m
[0m[0m
| Legacy source | Dynamic variable |[0m[0m
|---|---|[0m[0m
| [mverseReading.reference[0m | [mscripture_reference[0m |[0m[0m
| [mverseReading.text[0m | [mscripture_text[0m |[0m[0m
| [msermon.speaker[0m | [msermon_speaker_name[0m |[0m[0m
| [msermon.title[0m | [msermon_title[0m |[0m[0m
| [mclosingPrayerPerson[0m | [mclosing_prayer_person[0m |[0m[0m
| [mimages_payload.sermonGraphicUrl[0m | [msermon_poster[0m |[0m[0m
| [mimages_payload.familyPhotoUrl[0m | [mfamily_photo[0m |[0m[0m
| [mimages_payload.youthPhotoUrl[0m | [myouth_photo[0m |[0m[0m
| [mfamilyName[0m | [mfamily_name[0m |[0m[0m
| [myouthName[0m | [myouth_name[0m |[0m[0m
[0m[0m
[mparsed_data[0m sebaiknya tetap dipertahankan untuk audit/parser diagnostics setidaknya selama fase transisi. Ia tidak perlu lagi menjadi satu-satunya source of truth field form.[0m[0m
[0m[0m
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[0m[0m
[0m[0m
[m[1m## 7. Roadmap implementasi pragmatis[0m[0m
[0m[0m
[m[1m### Phase 0 — Decision dan boundary design[0m[0m
[0m[0m
Tentukan dan dokumentasikan:[0m[0m
[0m[0m
- apakah grouping hanya mengatur form UX, atau juga deck sequence;[0m[0m
- fixed system variables/invariants;[0m[0m
- immutable [mvariable_name[0m policy;[0m[0m
- delete vs archive policy;[0m[0m
- snapshot vs auto-sync policy;[0m[0m
- ownership field untuk template token validation.[0m[0m
[0m[0m
Ini adalah keputusan arsitektur yang cukup besar dan layak dicatat. Jika ingin diformalkan menurut workflow repository, skill yang cocok adalah [mwdi-decision[0m, tetapi saya tidak akan menjalankannya tanpa persetujuan eksplisit Anda.[0m[0m
[0m[0m
[m[1m### Phase 1 — Read-only configurable layout[0m[0m
[0m[0m
Tujuan: ubah UI tanpa mengubah persistence/planner dahulu.[0m[0m
[0m[0m
- Tambahkan table [mform_layouts[0m, [mform_groupings[0m, [mform_grouping_items[0m, [mpredefined_fields[0m.[0m[0m
- Seed default layout yang merepresentasikan form saat ini.[0m[0m
- Buat API read-only layout.[0m[0m
- Refactor [mEditForm[0m menjadi:[0m[0m
  - fixed rundown panel;[0m[0m
  - fixed sticky preview;[0m[0m
  - dynamic card/grouping renderer.[0m[0m
- Untuk sementara values masih bridge ke [mWorshipFormFields[0m existing.[0m[0m
[0m[0m
Ini membuktikan UX grouping tanpa sekaligus mempertaruhkan PPTX planner.[0m[0m
[0m[0m
[m[1m### Phase 2 — Dynamic field values dan image field[0m[0m
[0m[0m
- Tambahkan [mservice_field_values[0m.[0m[0m
- Tambahkan form-layout snapshot per service.[0m[0m
- Render text, textarea, image dari field definition.[0m[0m
- Reuse image upload/security pipeline yang ada.[0m[0m
- Backfill values dari [mparsed_data[0m dan [mimages_payload[0m.[0m[0m
- Tambahkan compatibility fallback dan migration tests.[0m[0m
[0m[0m
[m[1m### Phase 3 — Admin editor[0m[0m
[0m[0m
- CRUD fields.[0m[0m
- CRUD grouping.[0m[0m
- Drag reorder cards dan item.[0m[0m
- Bind Song Set entries dan announcement slots.[0m[0m
- Form layout preview.[0m[0m
- Archive field, bukan hard delete, apabila sudah dipakai service/template.[0m[0m
- Seed Default button dengan result report.[0m[0m
[0m[0m
[m[1m### Phase 4 — Dynamic parser suggestions[0m[0m
[0m[0m
- Extend parser profile/storage agar per-field extraction rules diambil dari [mpredefined_fields[0m.[0m[0m
- Tambahkan test/extraction preview panel di admin.[0m[0m
- Return per-field suggestions dari [m/api/services/preview[0m.[0m[0m
- Tambahkan explicit Accept / Accept All UI.[0m[0m
- Pertahankan Song Set matcher yang existing sebagai specialized pipeline.[0m[0m
[0m[0m
[m[1m### Phase 5 — Dynamic planner token map[0m[0m
[0m[0m
- Build dynamic [mvariable_name → value[0m map dari [mservice_field_values[0m.[0m[0m
- Update token validator agar field catalog berasal dari database/snapshot, bukan [mcatalogKeys[0m fixed.[0m[0m
- General artifacts hydrate dari dynamic map.[0m[0m
- Pertahankan song and announcement specialized nodes.[0m[0m
- Tambahkan plan-equivalence tests untuk seeded legacy service.[0m[0m
[0m[0m
[m[1m### Phase 6 — Retirement of legacy hardcoding[0m[0m
[0m[0m
Setelah migrasi stabil:[0m[0m
[0m[0m
- kurangi [mWorshipFormFields[0m fixed;[0m[0m
- kurangi [mParsedRundown[0m hanya menjadi structural parse result dan legacy compatibility;[0m[0m
- pindahkan hardcoded field extraction ke seeded fields;[0m[0m
- hapus fallback hanya setelah seluruh regression test, old snapshot test, preview, slideshow, dan PPTX output terbukti aman.[0m[0m
[0m[0m
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[0m[0m
[0m[0m
[m[1m## Rekomendasi akhir[0m[0m
[0m[0m
Saya merekomendasikan arsitektur ini, dengan satu penyesuaian penting terhadap istilahnya:[0m[0m
[0m[0m
[m│ **“Predefined Fields Engine” mengelola scalar inputs dan image inputs. “Song Set” dan “Announcement Slot” adalah first-class specialized form items yang dapat dibinding ke grouping, bukan dipaksa menjadi generic scalar field.**[0m[0m
[0m[0m
Itu memberi fleksibilitas yang Anda inginkan tanpa merusak kemampuan domain yang sudah matang—autocomplete hymn, lyric editor, Save to Book, empat announcement slot, slide ordering, dan PPTX generation.[0m[0m
[0m[0m
Dengan pendekatan ini, setiap gereja dapat membangun form kebaktiannya sendiri, sementara sistem tetap mempertahankan satu planner yang konsisten untuk preview, presenter view, projector, dan PowerPoint.

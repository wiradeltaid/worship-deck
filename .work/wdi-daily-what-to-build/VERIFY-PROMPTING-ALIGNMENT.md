# Audit Keselarasan: Rencana SPEC-46 vs Prompting Asli User

## 1. Teks Prompting Asli User (Verbatim)

### Prompting 1:
> Rundown parsing ini sepertinya saya tidak suka. Disini juga harusnya jadi tempat
> untuk menambahkan predefined field, baik text, gambar. Justru kalau dalam konsep worship presenter view, disinilah kita kelola layout visual dari worship new/edit. Coba diskusikan denga terra dan composer, apakah solusi saya ini possible? - saya ingin semua serba bisa configurable - karena tiap gereja punya cara masing2.
>
> Disini yang wajib ada layout yang default:
> 1. Rundown di paling atas kiri. Panel Live Slide Preview di paling atas kanan
> 2. Lalu sisanya yang configurable adalah di bawah rundown, per grouping
>
> Kemudian, perlu diketahui predefined field juga bisa muncul dari:
> 1. Song book yang ditambahkan -> dinamis
> 2. Announcement Set Weekly Slot -> sudah di set 4 by design. Announcement set itu sendiri bukanlah predefined filed, karena purpose dia adalah inserted di main spine / sequence
>
> Disini user bisa membuat layouting, misal:
> 1. Membuat grouping dengan nama Song Set, isinya adalah: (a) song set A, (b) song set B, (c) song set D
> 2. Di case lain, user bisa membuat grouping baru, dan bisa mengkombinasikannya dengan song set C
>
> User bisa membuat layouting baru, misal grouping namenya Afternoon Program, lalu dia binding di dalamnya:
> 1. Announcement Weekly Slot 1
>
> Layouting itu artinya:
> 1. User bisa membuatt grouping2, yang nantinya secara visual akan menjadi card.
> 2. Lalu song book sudah punya cara render sendiri, begitu dia dimasukin ke suatu grouping, dia akan otomatis merender baris inputnya seperti apa.
>
> Grouping ini adalah card secara visual. Setiap predefined field punya cara render masing2.
>
> Verse Reading Reference itu sendiri adalah predefined yang di seeder, dan bisa dihapus oleh user. Type = Text, length = 100. Length disini menentukan secara visual rendernya seperti apa.
>
> Verse Reading Text itu sendiri adalah predefined yang diseeder, dan bisa dihapus oleh user. Type = Text Area, initial line = 5. Initial line adalah seberapa besar text area di render.
>
> Untuk image itu sendiri, cara render visualnya sudah ditetapkan, misal:
> gambar di kolom pertama, kolom kedua: choose file, paste image link, kolom 3: upload, dan download
>
> Setiap predefined field pasti punya: Shown text, variable name, type, dan property lainnya (misal: length, initial line - jika text area), serta regex how to extract dari rundown. Kecuali gambar, gambar tidak bisa.
>
> Type = text, text area, image, announcement slot.
>
> Sehingga dengan cara ini, sebenarnya family of the week: photo, name, request, itu adalah seeder, dan bagaimana layoutingnya, adalah diatur dimenu ini. System melaakukan seeder, mungkin by invoke command, atau ada tombol Seed Default Predefined Field (yang adaptif, tidak merusak yang sudah ada, hanya mengisi gap yang tidak ada).

### Prompting 2:
> saya sudah oke rencananya tolong diingat, sebelum kita buat spek/tiket.
>
> Concern saya addalah bertanya soal regex song, kenapa dia gak disediakan input regex cara extractnya bagaimana?. ARtinya semua predefined field tipe text (termasuk song set) punya text regex sendiri yang perlu diisi oleh user. Sehingga kita mengurangi hardcoded teknik yang bisa jadi di tiap2 gereja cara extraksinya berbeda2 format teksnya.
>
> Untuk tanggal, judul worship, biarin aja itu hard coded. Sisanya adalah regex yang di set oleh admin?

---

## 2. Draf Dokumen Saat Ini:
- Spec: `.scratch/SPEC-46-configurable-form-layout-and-predefined-fields/SPEC.md`
- Tiket 01: `issues/01-schema-migration-and-adaptive-seeder-backend.md`
- Tiket 02: `issues/02-dynamic-field-service-persistence-and-backfill-migration.md`
- Tiket 03: `issues/03-dynamic-canvas-token-hydration-in-go-slide-plan.md`
- Tiket 04: `issues/04-dynamic-regex-extraction-engine-for-fields-and-song-sets.md`
- Tiket 05: `issues/05-dynamic-form-shell-and-card-grouping-engine-in-react.md`
- Tiket 06: `issues/06-admin-layout-builder-predefined-fields-management-and-regression-guards.md`

---

## 3. Pertanyaan Audit Kritis untuk Terra, Composer, dan Sonnet:

1. **Kelengkapan Fitur (Feature Completeness against Raw Notes):**
   Apakah ada poin di Prompting 1 dan Prompting 2 yang terlewat atau terdistorsi dalam draf SPEC-46 dan tiket 01-06?
   Periksa secara spesifik:
   - Lokasi pengelolaan layout: User menyebut *"Justru kalau dalam konsep worship presenter view, disinilah kita kelola layout visual dari worship new/edit... bagaimana layoutingnya, adalah diatur dimenu ini."* Apakah form worship new/edit (`EditForm`/`RunSheetPage`) harus memiliki mode "Kelola Layout Visual" / "Customize Layout" langsung in-place, bukan hanya tersembunyi di menu admin terpisah?
   - 4 Tipe Predefined: `text`, `text area`, `image`, `announcement slot`.
   - Layout 3 Kolom Image: Kolom 1 = preview gambar, Kolom 2 = choose file + paste image link, Kolom 3 = upload dan download.
   - Regex pada Song Set: Setiap baris song set memiliki input regex sendiri untuk menangkap nomor lagu dan buku.
   - Pengecualian Hardcoded: Hanya tanggal dan judul worship yang tetap hardcoded/standar. Sisanya semua regex admin.
   - Seeder Default: Verse Reference (Text, length 100), Verse Text (Text Area, initial line 5), Family (photo, name, request), Youth (photo, name, request), Sermon (speaker, graphic, closing prayer), dengan tombol `Seed Default Predefined Field` yang adaptif (hanya mengisi gap tanpa menimpa yang sudah ada).

2. **Integritas "Jangan membuat broken apa yang sudah bagus":**
   Apakah rencana ini 100% aman terhadap kebaktian lama, deck sequence, slide plan hydration, PPTX export, dan perbaikan layout/persistensi slot pengumuman yang baru di-merge di PR #83 (SPEC-45)?

3. **Koreksi & Rekomendasi Konkret:**
   Apa saja bagian spesifikasi dan tiket yang perlu diperjelas atau disesuaikan agar 100% presisi dengan kata-kata user?

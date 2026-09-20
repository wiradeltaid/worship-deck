# Architectural Discussion: Configurable Dynamic Layout & Predefined Fields Engine

## Context & Background
Aplikasi ini adalah `worship-presenter-web`, sistem worship presentation modern untuk gereja (backend: Go + SQLite, frontend: React + Vite + Tailwind CSS + shadcn/ui).
Saat ini, flow pembuatan/pengeditan kebaktian mingguan (`RunSheetPage` / `EditForm.tsx`) memiliki input rundown mentah yang diparsing ke struktur data yang relatif fixed (seperti `verseReading`, `sermonSpeaker`, `closingPrayer`, `specialSong`, `familyPrayer`, `youthPrayer`, posters, dll). Di UI, card-card yang dirender juga hardcoded satu per satu (Card Rundown, Card Song Sets, Card Bible Talk, Card Divine Worship, Card Sermon, Card Weekly Announcement Posters, Card Family, Card Youth).

## Permasalahan & Visi User
User merasa flow dan layout saat ini terlalu kaku dan tidak disukai untuk kebutuhan nyata gereja-gereja yang beragam:
> "Rundown parsing ini sepertinya saya tidak suka. Disini juga harusnya jadi tempat untuk menambahkan predefined field, baik text, gambar. Justru kalau dalam konsep worship presenter view, disinilah kita kelola layout visual dari worship new/edit. Coba diskusikan dengan terra dan composer, apakah solusi saya ini possible? - saya ingin semua serba bisa configurable - karena tiap gereja punya cara masing2."

### Aturan Layout Default yang Wajib (Fixed Top Layout):
1. **Paling Atas Kiri**: Textarea input Rundown mingguan.
2. **Paling Atas Kanan**: Panel Live Slide Preview (selalu standby/sticky melihat visual slide realtime).
3. **Di Bawah Rundown**: Area sepenuhnya **configurable per Grouping**.

### Konsep Grouping & Predefined Fields:
1. **Grouping = Visual Card**:
   - User/Admin dapat membuat grouping-grouping custom (misal: "Song Set", "Afternoon Program", "Sermon & Scripture", "Warta Jemaat", dll).
   - Setiap grouping secara visual akan menjadi sebuah `<Card>` di UI.
   - User dapat mengatur urutan card dan elemen di dalamnya.

2. **Elemen yang bisa dimasukkan ke dalam Grouping**:
   - **Song Book / Song Sets (Dinamis)**:
     - Berasal dari Song Books / Master Data song set entries.
     - Setiap Song Set sudah punya cara render khusus: row input dengan select Song Book, autocomplete nomor lagu/hymn, select background slide, tombol edit & preview lirik, serta tombol "Save to Book".
     - Fleksibel: User bisa membuat grouping "Song Set" yang berisi Song Set A, B, D. Atau di grouping lain, mengombinasikan Song Set C dengan field lain.
   - **Announcement Set Weekly Slots**:
     - Telah diset 4 slot by design. Announcement Set itu sendiri bukan sekadar field biasa melainkan sequence slide yang di-insert ke main spine kebaktian.
     - Slot ini bisa di-binding ke dalam grouping manapun yang diinginkan user (contoh: grouping "Afternoon Program" membinding "Announcement Weekly Slot 1").
   - **Predefined Fields (Custom & Extensible)**:
     - Tipe yang didukung: `text`, `text area`, `image`, `announcement slot`.
     - Setiap predefined field memiliki atribut:
       - `Shown text` (Label yang tampil di UI)
       - `Variable name` (Identitas variabel / token, misal `verse_reference`, `sermon_speaker`, dll, yang nantinya dipakai di slide template `{variable_name}`)
       - `Type` (`text` | `text area` | `image` | `announcement slot`)
       - Property visual:
         - Jika `text`: `length` (misal 100 - menentukan ukuran/lebar input render secara visual).
         - Jika `text area`: `initial line` (misal 5 - menentukan tinggi / jumlah baris textarea secara visual).
       - `Regex how to extract dari rundown`: Rule regex untuk mengekstrak nilai field ini secara otomatis dari teks rundown (kecuali tipe `image` yang tidak bisa diekstrak dari teks).
     - Cara render visual untuk tipe `image`:
       - Layout visual 3 kolom yang terstandarisasi:
         - Kolom 1: Preview thumbnail gambar
         - Kolom 2: Input Choose File / Paste Image Link
         - Kolom 3: Action button Upload & Download

3. **Seeder Bawaan (Adaptive Default Predefined Fields)**:
   - Nilai-nilai default yang selama ini hardcoded sebenarnya hanyalah seeder:
     - `Verse Reading Reference`: Type = Text, length = 100
     - `Verse Reading Text`: Type = Text Area, initial line = 5
     - `Family of the Week`: Photo (image), Name (text), Request (text area)
     - `Youth of the Week`: Photo (image), Name (text), Request (text area)
     - `Sermon`: Speaker (text), Graphic (image), Closing Prayer (text)
   - Semua ini bisa diedit atau dihapus oleh user.
   - Sistem menyediakan fitur/tombol `Seed Default Predefined Field`:
     - Sifatnya **adaptif**: tidak merusak data/grouping/field yang sudah ada, melainkan hanya mengisi gap (hanya menginsert field/grouping default yang belum ada).

---

## Pertanyaan Diskusi untuk Evaluasi Mendalam:
Mohon berikan analisis kritis, teknis, dan komprehensif terkait:

1. **Kelayakan Arsitektur (Feasibility & Verdict)**:
   - Apakah solusi dan visi user ini possible dan feasible untuk diimplementasikan di stack Go + SQLite + React?
   - Apa keuntungan dan trade-off dibanding sistem saat ini?

2. **Rancangan Data Model & Database Schema**:
   - Bagaimana struktur tabel SQLite yang ideal untuk merepresentasikan `form_groupings`, `predefined_fields`, dan binding-nya?
   - Bagaimana menyimpan nilai aktual dari field-field ini di level tiap `Service` (kebaktian)? Apakah via EAV (Entity-Attribute-Value), JSON payload map (`field_values JSON`), atau pendekatan hybrid?

3. **Form Engine & Visual Component Rendering (React)**:
   - Bagaimana arsitektur frontend merender layout ini secara dinamis?
   - Bagaimana menangani specialized renderer (seperti Song Set row dengan autocomplete hymn & lyric editor, Image 3-column, Announcement Slot, Text dengan length, Text Area dengan initial lines)?
   - Di mana admin mengelola layout & field ini? Apakah di menu Admin khusus (misal `/admin/form-layout` atau `/admin/fields`) atau langsung di tampilan view?

4. **Integrasi Rundown Regex Extraction**:
   - Bagaimana mekanisme parsing rundown mengekstrak nilai ke dynamic fields berdasarkan `extraction_regex` masing-masing field?
   - Bagaimana interaksinya dengan pencocokan lagu (Song Set matching)?

5. **Slide Plan & Canvas Template Hydration**:
   - Bagaimana token template slide (seperti `{sermon_speaker}`, `{verse_reference}`, atau custom variable baru yang dibuat gereja) di-hydrate oleh backend Go (`internal/plan`) secara dinamis tanpa perlu hardcoding nama variabel di Go struct?

6. **Mekanisme Adaptive Seeder & Strategi Migrasi**:
   - Bagaimana implementasi `Seed Default Predefined Field` yang adaptif (idempotent, no overwrite existing)?
   - Bagaimana migrasi data existing services agar tidak ada regresi pada kebaktian yang sudah dibuat sebelumnya?

7. **Rekomendasi Tahapan Implementasi (Roadmap)**:
   - Langkah-langkah pragmatis untuk mewujudkan arsitektur ini secara bertahap.

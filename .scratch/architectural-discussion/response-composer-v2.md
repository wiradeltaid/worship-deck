# Evaluasi Arsitektur: Configurable Dynamic Layout & Predefined Fields Engine

Dokumen ini menjawab tujuh pertanyaan diskusi dengan merujuk pada kondisi aktual `worship-presenter-web`: form worship masih hardcoded di `EditForm.tsx` / `CreateForm.tsx`, nilai mingguan tersebar di `parsed_data`, `images_payload`, `song_set_inputs`, dan array insert pengumuman; hydration slide memakai 17 key tetap di `placeholder-catalog.ts` (TS) dan `catalogValues(c ctx)` di `internal/plan/plan.go` (Go).

---

## 1. Kelayakan Arsitektur (Feasibility & Verdict)

### Verdict

**Layak dan feasible** di Go + SQLite + React. Visi user bukan rewrite total, melainkan **menyatukan pola yang sudah ada** (song set entries configurable, parser profile di DB, token `{key}` di canvas) ke satu **form layout engine** dan **catalog placeholder yang dapat diperluas**.

### Bukti fondasi yang sudah selaras

| Lapisan | Sudah ada | Implikasi |
|--------|-----------|-----------|
| Layout atas tetap | Grid `lg:col-span-7` (rundown) + preview di `EditForm.tsx` | Aturan “fixed top” hanya perlu dipertahankan sebagai shell, bukan diubah konsepnya |
| Master data song set | `song_set_entries`, `song_set_inputs` (DEC-004) | Slot `song_set_entry` di grouping bisa mereferensi `variable_name` yang sama |
| Parser | `rundown_parser_profiles.rules_json` dengan `field_rules` dan `song_set_matching` | Mekanisme regex sudah terbukti; perlu dipindahkan/di-sync ke definisi field admin |
| Slide hydration | `substituteTokens` + `map[string]interface{}` values per request node | Backend **tidak wajib** struct per field jika `ctx` + map dinamis |
| Specialized UI | `HymnNumberAutocomplete`, `ImageUploadField`, 4 slot announcement | Bukan generic input; harus tetap sebagai **renderer terdaftar** |

### Keuntungan dibanding sistem sekarang

1. **Satu identitas `variable_name`** dari form → parse overlay → `{token}` di Artifact Registry, mengurangi drift antara `WorshipFormFields`, `StructuredServiceFields`, dan `CatalogWeeklyInput`.
2. **Variasi antar-gereja tanpa fork** — urutan card, kombinasi song set + field custom, label UI.
3. **Seeder adaptif** mengubah hardcode menjadi default yang bisa dihapus/diedit, selaras dengan mental model “bukan schema tetap aplikasi”.
4. **Preview slide** tetap di kanan; grouping hanya mengatur area bawah tanpa mengubah pipeline plan.

### Trade-off dan risiko

| Risiko | Mitigasi |
|--------|----------|
| Admin salah regex → ekstraksi rusak | Sandbox parse di admin (mirip `ParserProfilesPanel`), validasi regex saat save, preview diff field |
| Token tidak ada di catalog → slide kosong (FR-30) | Setelah catalog dinamis, validasi artifact harus membaca catalog dari DB, bukan array 17 key saja |
| Kompleksitas migrasi dual-write | Fase transisi: adapter legacy → canonical `field_values` |
| `announcement_slot` sebagai tipe field vs 4 slot global | Tetap **4 URL per service**; tipe field hanya **binding UI** ke slot 1–4, bukan slot baru di spine |
| Performa form besar | Virtualisasi opsional; jumlah field gereja tipikal < 50 |

### Batas yang harus eksplisit

- Parser struktural (**tanggal, section, hymn lines, roles, `songCandidates`**) tetap pipeline `parseRundownWithProfile`; dynamic fields **melengkapi overlay**, tidak menggantikan `ParsedRundown.items` dalam satu rilis.
- **Main spine** (urutan slide di Registry) tetah terpisah dari **form grouping**; grouping hanya mengatur **input operator**, bukan urutan presentasi (kecuali nanti ada linking eksplisit — out of scope awal).

---

## 2. Rancangan Data Model & Database Schema

### Prinsip pemisahan

- **Definisi** (grouping, field, slot form): konfigurasi congregation (satu DB lokal), versionable.
- **Nilai mingguan**: per `services.id`.
- **Entitas berat** (song set input, gambar): pola existing — tabel khusus + referensi URL, bukan blob di JSON field text.

### Skema konfigurasi (admin)

```sql
-- Satu layout aktif per deployment (bisa diperluas versioning nanti)
CREATE TABLE worship_form_layouts (
  id TEXT PRIMARY KEY,                    -- e.g. 'default'
  label TEXT NOT NULL DEFAULT 'Default',
  version INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE form_groupings (
  id TEXT PRIMARY KEY,                    -- uuid
  layout_id TEXT NOT NULL REFERENCES worship_form_layouts(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL,
  UNIQUE (layout_id, sort_order)
);

-- Satu baris = satu widget di dalam Card
CREATE TABLE form_group_slots (
  id TEXT PRIMARY KEY,
  grouping_id TEXT NOT NULL REFERENCES form_groupings(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  widget_kind TEXT NOT NULL CHECK (widget_kind IN (
    'predefined_field',
    'song_set_entry',
    'announcement_weekly_slot'
  )),
  -- predefined_field     → predefined_fields.variable_name
  -- song_set_entry       → song_set_entries.variable_name
  -- announcement_weekly_slot → ref_key = '1'..'4'
  ref_key TEXT NOT NULL,
  UNIQUE (grouping_id, sort_order)
);

CREATE TABLE predefined_fields (
  variable_name TEXT PRIMARY KEY,       -- snake_case, token canvas: {variable_name}
  shown_label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN (
    'text', 'text_area', 'image', 'announcement_slot'
  )),
  visual_props_json TEXT NOT NULL DEFAULT '{}',
  extraction_regex TEXT,                -- NULL: image, announcement_slot
  extraction_flags TEXT DEFAULT 'im', -- subset JS/Go regex flags
  seed_key TEXT UNIQUE,                 -- e.g. 'builtin:verse_reference' untuk seeder idempotent
  is_builtin INTEGER NOT NULL DEFAULT 0,
  deprecated_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Catalog placeholder untuk validasi template (menggantikan array tetap 17 key)
CREATE TABLE placeholder_catalog_entries (
  key TEXT PRIMARY KEY,                 -- sama dengan variable_name predefined + builtin tetap
  value_type TEXT NOT NULL CHECK (value_type IN ('text', 'image')),
  source TEXT NOT NULL CHECK (source IN ('predefined_field', 'system')),
  predefined_field_name TEXT REFERENCES predefined_fields(variable_name),
  created_at TEXT NOT NULL
);
```

**`visual_props_json` (contoh):**

```json
{ "maxLength": 100 }
{ "initialLines": 5, "minLines": 3 }
{ "announcementSlotIndex": 2 }
```

Untuk `announcement_slot`, `ref_key` di `form_group_slots` atau properti di `visual_props_json` menunjuk slot 1–4.

### Penyimpanan nilai per Service: hybrid (disarankan)

**Jangan** pure EAV untuk semua tipe — query dan tipe data jadi rapuh. **Jangan** hanya satu JSON blob tanpa indeks untuk song set — sudah ada `song_set_inputs`.

| Data | Penyimpanan | Alasan |
|------|-------------|--------|
| Teks / textarea custom | `service_field_values` atau kolom baru `field_values_json` | Banyak key, schema fleksibel |
| Gambar custom | `images_payload` extended map **atau** baris di `service_field_values` dengan value = URL | Konsisten upload existing |
| Song set | `song_set_inputs` (tetap) | Sudah DEC-004, lyric override |
| Announcement weekly | `images_payload` / kolom inserts (tetap 4) | Plan Go sudah `announcementInserts []string` |
| Legacy | `parsed_data` subset | Backward compat sampai fase sunset |

**Tabel nilai canonical (disarankan):**

```sql
CREATE TABLE service_field_values (
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  variable_name TEXT NOT NULL,
  value_text TEXT,
  value_image_url TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (service_id, variable_name),
  FOREIGN KEY (variable_name) REFERENCES predefined_fields(variable_name)
);
```

**Alternatif fase awal (lebih murah migrasi):** satu kolom di `services`:

```sql
ALTER TABLE services ADD COLUMN field_values_json TEXT;
-- shape: { "verse_reference": "John 3:16", "sermon_speaker": "...", "family_photo": "/uploads/..." }
```

Lalu normalisasi ke `service_field_values` di fase 2. Untuk gereja tunggal dan <100 key, JSON di SQLite **cukup**; FK ke `predefined_fields` divalidasi di aplikasi.

### Struktur Go (domain)

```go
type PredefinedField struct {
    VariableName     string
    ShownLabel       string
    FieldType        string // text | text_area | image | announcement_slot
    VisualProps      map[string]interface{}
    ExtractionRegex  *string
    ExtractionFlags  string
    SeedKey          *string
}

type FormGrouping struct {
    ID          string
    Label       string
    SortOrder   int
    Slots       []FormGroupSlot
}

type FormGroupSlot struct {
    ID         string
    WidgetKind string // predefined_field | song_set_entry | announcement_weekly_slot
    RefKey     string
    SortOrder  int
}

type ServiceFieldValues map[string]string // text & image URL unified; image keys suffixed convention or typed in metadata
```

### Edge case schema

- **Rename `variable_name`**: butuh migrasi catalog + template tokens + `service_field_values`; UI admin harus forbidden rename jika dipakai di template kecuali wizard “duplicate + migrate”.
- **Hapus field**: soft-delete (`deprecated_at`); nilai lama tetap di DB, tidak ditampilkan di form, hydration tetap isi jika template masih pakai token (warning).
- **Collision** `variable_name` dengan key system (`service_date`): reserved list di validator.
- **`announcement_slot` field type**: tidak punya nilai sendiri di `service_field_values`; widget hanya mengedit `announcementInserts[slot-1]`.

---

## 3. Form Engine & Visual Component Rendering (React)

### Arsitektur komponen

```
WorshipServiceFormShell (fixed)
├── RundownPanel (textarea + parse trigger + profile select)
├── LiveSlidePreviewPanel (sticky, SlidePreviewList)
└── DynamicFormBody
    └── sort(groupings) → FormGroupingCard[]
            └── sort(slots) → FormWidgetRenderer[slot]
```

**Data flow:**

1. `GET /api/worship-form-layout` → `{ layout, groupings[], predefinedFields[], songSetEntries[] }`
2. State mingguan: `Record<variable_name, string>` + `SongSetInputs` + `announcementInserts[4]`
3. Save: merge ke API existing (`fields`, `songSets`, images) via **adapter** yang juga menulis `field_values_json`

### Registry renderer (plugin map)

```typescript
type WidgetKind =
  | 'predefined_field'
  | 'song_set_entry'
  | 'announcement_weekly_slot';

type FieldType = 'text' | 'text_area' | 'image' | 'announcement_slot';

const PREDEFINED_RENDERERS: Record<
  FieldType,
  React.ComponentType<PredefinedFieldRenderProps>
> = {
  text: TextFieldRenderer,           // maxLength dari visual_props
  text_area: TextAreaFieldRenderer,  // rows dari initialLines
  image: ImageThreeColumnRenderer,   // wraps ImageUploadField
  announcement_slot: AnnouncementSlotRenderer,
};

const SLOT_RENDERERS: Record<WidgetKind, ...> = {
  predefined_field: (slot, def) => PREDEFINED_RENDERERS[def.field_type](...),
  song_set_entry: SongSetRowRenderer,  // existing row: book, hymn AC, background, lyric editor
  announcement_weekly_slot: AnnouncementWeeklySlotRenderer,
};
```

**`SongSetRowRenderer`**: ekstrak dari `EditForm.tsx` — props: `variableName`, `value: SongSetEntryInput`, `hymnIndex`, callbacks preview/save-to-book.

**`ImageThreeColumnRenderer`**: kolom thumbnail | file/link | upload/download — reuse `ImageUploadField` dengan layout grid `grid-cols-3`.

**`TextFieldRenderer`**: `Input` dengan `maxLength` dan `className` width dari `maxLength` (mis. `max-w-md` vs full).

### Admin vs operator view

| Area | Rekomendasi |
|------|-------------|
| **Definisi layout & field** | Admin: `/admin/worship-form` (sub-nav: Groupings, Predefined Fields, Preview form) |
| **Isi mingguan** | Operator: Create/Edit service — **hanya render** layout aktif, tanpa edit schema |
| **Drag-and-drop urutan** | Admin only (dnd-kit); operator tidak mengubah struktur card |

Alasan: mencampur “isi kebaktian” dan “ubah struktur form” di satu halaman meningkatkan risiko operator menghapus field yang dipakai template. Opsi kompromi: mode “Customize layout” tersembunyi di admin dengan role gate.

### Validasi frontend

- `variable_name`: `/^[a-z][a-z0-9_]{0,63}$/`
- Regex: compile test on blur (`new RegExp(pattern, flags)`)
- Layout save: minimal satu grouping atau explicit empty state
- Song set slot: `ref_key` harus exist di `song_set_entries`

### Edge case UI

- **Field di layout tapi dihapus dari catalog**: tampilkan banner “unknown field” + nilai read-only dari service sampai admin perbaiki layout.
- **Song set entry di registry dihapus**: row tetap tampil jika ada `song_set_inputs` row (stale variable_name), dengan warning.
- **Parse rundown saat mengetik**: debounce; jangan timpa field yang `userTouched[variable_name] === true` (sama seperti perilaku hydrate sermon/family today).

---

## 4. Integrasi Rundown Regex Extraction

### Pipeline yang disarankan

```
raw_payload
  → parseRundownWithProfile(profile)     // struktural + builtin field_rules
  → extractDynamicFields(raw, fields[])  // per predefined_fields.extraction_regex
  → matchSongSets(candidates, slots, profile.song_set_matching)
  → mergeIntoFormState(extracted, parsed, touched)
```

### `extractDynamicFields` (konsep)

```typescript
function extractDynamicFields(
  raw: string,
  definitions: PredefinedFieldDef[],
  opts: { lineMode?: 'full' | 'per-line' }
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const def of definitions) {
    if (def.field_type === 'image' || !def.extraction_regex) continue;
    const re = new RegExp(def.extraction_regex, def.extraction_flags ?? 'im');
    const m = re.exec(raw);
    if (m?.[1]) out[def.variable_name] = m[1].trim();
  }
  return out;
}
```

**Prioritas merge (disarankan):**

1. Nilai tersimpan di service (edit load)
2. User touched manual
3. Dynamic regex extract (on parse)
4. Legacy builtin `field_rules` → map ke `seed_key` / `variable_name` via tabel mapping

**Fase transisi:** builtin `verse_reading`, `sermon`, dll. tetap di `parser-rules.ts` tetapi hasilnya **juga** ditulis ke key canonical (`scripture_reference`, `sermon_speaker_name`, …) agar selaras dengan `placeholder-catalog` hari ini.

### Interaksi dengan song set matching

Orthogonal dan harus tetap demikian:

- Parser menghasilkan `songCandidates[]` dari baris hymn/label.
- `matchSongSets(candidates, configuredSlots, profile.song_set_matching)` mengisi `suggestions[variable_name]`.
- Hanya slot yang **muncul di form layout** (atau semua entry registry — keputusan produk) yang di-apply ke `SongSetInputs`.

**Aturan merge song set:**

- Jika operator sudah mengisi nomor lagu untuk `variable_name`, jangan overwrite (kecuali tombol “Apply suggestions from rundown”).
- Label slot hanya untuk entry yang **dikonfigurasi di `song_set_entries`**; grouping “Song Set A+B” tidak mengubah algoritma matching, hanya **menampilkan** subset row.

**Edge cases:**

- Lagu lebih banyak dari slot → `songOverflow` ditampilkan di panel diagnostik rundown (sudah ada konsep di `SongSetMatchingResult`).
- Regex field menangkap multiline: gunakan flag `s` / dotall hanya jika admin mengaktifkan; default per-line lebih aman.
- Dua field regex greedy overlap → urutan ekstraksi mengikuti `sort_order` di admin predefined list; field pertama menang, log warning untuk overlap di sandbox admin.

### Hubungan dengan Parser Profile admin

Dua sumber regex berisiko duplikasi. Roadmap:

- **Fase 1:** builtin profile `field_rules` + dynamic fields paralel; adapter sync.
- **Fase 2:** generate `field_rules` dari `predefined_fields` where `seed_key` matches, atau deprecate editing `field_rules` di UI untuk key yang sudah admin-owned.

---

## 5. Slide Plan & Canvas Template Hydration

### Kondisi sekarang

- TS: `catalogValuesFromWeekly(CatalogWeeklyInput)` → 17 key tetap.
- Go: `catalogValues(c ctx)` membaca struct `ctx` (verse, sermon, photos, …).
- Hydration artifact: `values map[string]interface{}` pada setiap `request` node.

### Target: catalog dinamis tanpa hardcode struct per field

**Langkah desain:**

1. **`placeholder_catalog_entries`** menjadi sumber validasi (`validate_artifact.go`, `findUnknownPredefinedFieldTokens`).
2. **`BuildCatalogValues(serviceID)`** di Go:

```go
func BuildCatalogValues(db *sql.DB, serviceID int64, c ctx) (map[string]interface{}, error) {
    out := map[string]interface{}{}
    // System keys from ctx (date, legacy paths until sunset)
    mergeSystemKeys(out, c)
    // Custom + migrated predefined
    rows, _ := loadServiceFieldValues(db, serviceID)
    for k, v := range rows {
        out[k] = v
    }
    // Images: sermon_poster, family_photo, … from images_payload map OR field values
    mergeImagePayload(out, c)
    return out, nil
}
```

3. **Hapus penambahan field baru di struct `ctx`** — struct hanya untuk data yang **bukan** predefined (participants, afternoon program, hymn resolution, announcement inserts).

4. **TS slide-plan** (`catalogInputFromCtx`): ganti dari struct flat ke `loadFieldValues(service)` + system fields.

### Token custom gereja

Template: `{custom_welcome_note}` → admin buat predefined field `custom_welcome_note` → nilai di `service_field_values` → hydration otomatis. **Tidak perlu** field baru di Go struct.

### Edge case hydration

- **Tipe image**: value harus URL absolut/relatif yang dikenali renderer; validasi saat upload.
- **Key hilang**: FR-30 — render kosong + warning di validate, bukan gagal plan.
- **Service lama tanpa `field_values`**: fallback `catalogValues(c ctx)` legacy path (feature flag `use_dynamic_catalog`).
- **Snapshot registry per service**: plan memakai snapshot; catalog values selalu dari **service row terbaru**, bukan dari snapshot template.

### Konsistensi TS ↔ Go

Pertahankan **hand-mirrored** catalog validation (komentar di `placeholder-catalog.ts`) atau pindahkan ke **generated** dari satu file YAML di repo — penting agar warning unknown token sama di client preview dan server plan.

---

## 6. Mekanisme Adaptive Seeder & Strategi Migrasi

### Seeder idempotent

Tombol **“Seed Default Predefined Field”** menjalankan:

```go
func SeedDefaultFormLayout(tx *sql.Tx) (SeedReport, error) {
    report := SeedReport{}
    for _, seed := range DefaultFormSeeds() {
        if existsPredefinedBySeedKey(tx, seed.SeedKey) {
            report.Skipped++
            continue
        }
        insertPredefinedField(tx, seed)
        report.Inserted++
    }
    for _, g := range DefaultGroupings() {
        if existsGroupingBySeedKey(tx, g.SeedKey) {
            report.SkippedGroupings++
            continue
        }
        insertGroupingWithSlots(tx, g)
        report.InsertedGroupings++
    }
    syncPlaceholderCatalogEntries(tx)
    return report, nil
}
```

**`seed_key` contoh:**

| seed_key | variable_name | grouping |
|----------|---------------|----------|
| `builtin:scripture_reference` | `scripture_reference` | Bible Talk |
| `builtin:family_photo` | `family_photo` | Family of the Week |
| `builtin:grouping_sermon` | — | Sermon card |

Tidak **overwrite** label/regex/urutan yang sudah diubah user; hanya **insert missing**.

### Migrasi service existing

**Tujuan:** kebaktian lama tampil identik setelah deploy.

1. **Migration data_version N→N+1:**
   - Seed layout + predefined fields (kosong gap saja).
   - **Backfill `field_values_json`** dari:
     - `parsed_data` (verse, sermon, family, youth, closing, special song)
     - `images_payload` (sermon, family, youth photos)
     - Key map lama → `variable_name` baru (mirror `migrate_predefined_fields.go` untuk template, tapi untuk nilai service)

2. **Dual-read di API GET service** (satu rilis):
   ```typescript
   function resolveFieldValues(service): Record<string, string> {
     if (service.field_values_json) return parse(service.field_values_json);
     return legacyAdapterFromParsedAndImages(service);
   }
   ```

3. **Dual-write di PUT** (opsional satu rilis): tulis legacy + canonical sampai frontend 100% canonical.

4. **Grouping default** dari seeder meniru urutan card `EditForm` saat ini agar operator tidak melihat reshuffle mendadak.

### Edge case migrasi

- Service dengan `parsed_data` corrupt: field kosong, tidak gagal load form.
- `familyYouth` legacy combined → split ke `family_request` / `youth_request` jika belum ada key terpisah.
- Song set: **tidak** pindah ke field_values; tetap `song_set_inputs` (sudah migrasi 6→7 di client DB).

### Rollback

Simpan `layout.version`; jika rollback app, inactive layout baru, active layout lama — data `service_field_values` tetap aman.

---

## 7. Rekomendasi Tahapan Implementasi (Roadmap)

### Fase 0 — Spesifikasi & DEC (1–2 minggu)

- DEC: canonical storage (`field_values_json` vs tabel), reserved keys, apakah operator boleh reorder card (default: tidak).
- FR untuk admin UI dan backward compat.
- Ticket via `wdi-build` / `to-spec` (sesuai method repo).

### Fase 1 — Schema + API read-only layout (2–3 minggu)

- Tabel `predefined_fields`, `form_groupings`, `form_group_slots`, `worship_form_layouts`.
- Seed migrasi + adaptive seeder endpoint (admin).
- `GET worship-form-layout` + backfill nilai service (read adapter legacy).
- **Belum** ganti `EditForm` — feature flag off.

### Fase 2 — Dynamic form body (3–4 minggu)

- Ekstrak `SongSetRow`, image 3-col, announcement slot ke renderer.
- `DynamicFormBody` menggantikan card hardcoded di `EditForm`/`CreateForm` dengan flag on.
- Fixed top rundown + preview tidak berubah.
- Unit test: render semua widget kinds dari fixture layout.

### Fase 3 — Dynamic regex extraction (2 minggu)

- `extractDynamicFields` + merge policy + UI “Apply from rundown”.
- Mapping `seed_key` ↔ builtin `field_rules`.
- Sandbox di admin predefined field editor.

### Fase 4 — Catalog dinamis & plan hydration (3 minggu)

- `placeholder_catalog_entries` + ubah `validate_artifact` / Go mirror.
- `BuildCatalogValues` + kurangi `catalogValues(c ctx)` ke system-only.
- TS `slide-plan.ts` selaras.
- E2E: custom token di canvas terisi di live plan.

### Fase 5 — Admin layout editor (2–3 minggu)

- DnD groupings/slots, CRUD predefined fields, bind song set & announcement slot.
- Validasi template unknown token vs catalog live.

### Fase 6 — Sunset legacy (1 minggu)

- Stop dual-write `parsed_data` overlay untuk field yang sudah canonical (opsional tetap simpan raw + structural parse).
- Hapus hardcoded card dan field dari `WorshipFormFields` ke minimal (`songSets` + touches metadata).

### Quick wins paralel (tanpa menunggu fase 6)

- Dokumentasikan mapping 17 key → seeder definitions (selaras visi user).
- Ekstrak komponen song set row (SPEC-43 sudah mengarah ke sini).

---

## Ringkasan Keputusan Desain

| Pertanyaan | Rekomendasi singkat |
|------------|---------------------|
| Feasible? | **Ya**, evolusi dari DEC-004 + parser profile + placeholder catalog |
| Storage nilai | **Hybrid**: `service_field_values` atau `field_values_json` + `song_set_inputs` + announcement inserts |
| React | **Shell tetap** + `FormWidgetRenderer` registry |
| Parse | **Pipeline dua lapis**: structural parser + per-field regex; song set tetap `matchSongSets` |
| Plan Go | **`map[string]interface{}` dari DB**, system keys dari `ctx`, deprecate struct per custom field |
| Seeder | **`seed_key` idempotent**, no overwrite |
| Migrasi | **Backfill + dual-read**, grouping default meniru UI lama |

---

**What was done:** Analisis arsitektur lengkap untuk tujuh pertanyaan diskusi, dengan skema SQLite, struktur Go/React, integrasi parse/plan, seeder, migrasi, edge case, dan roadmap bertahap, diselaraskan dengan codebase aktual (`EditForm`, DEC-004, `placeholder-catalog`, `internal/plan/plan.go`).

**Blocked / uncertain:** Keputusan produk final antara `field_values_json` vs tabel `service_field_values`; apakah song set matching hanya mengisi slot yang tampil di layout atau seluruh registry; dan apakah rename `variable_name` didukung atau hanya duplicate-and-migrate (perlu DEC).

**Next:** Jika Anda setuju arah ini, langkah berikutnya adalah spec formal (`to-spec`) + DEC untuk storage canonical dan reserved keys, lalu Fase 1 schema/API tanpa mengganti UI operator.

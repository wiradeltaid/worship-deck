# TEST-PLAN — SPEC-19 Artifacts Canvas Interactions & Shape Persistence

## Overview

This test plan defines the automated test suite and regression assertions for SPEC-19 (Artifacts Canvas Interactions, Shape Persistence & Typography Refinement).

## Test Cases & Automated Suites

### 1. `SPEC-19-01`: Searchable Font Dropdown Keyboard Isolation & Popper Alignment
- **File**: `tests/smoke-spec-19.test.mjs` & `tests/artifact-editor-layout.test.mjs`
- **Assertions**:
  - `SelectContent` in `ArtifactEditor.tsx` sets `alignItemWithTrigger={false}`, `side="bottom"`, and `align="start"`.
  - Search container stops event propagation for `keydown`, `keyup`, and `pointerdown`.
  - Search input renders with autofocus / focus preservation and filtering logic (`f.label.toLowerCase().includes(query)`).
  - Absence guard: `alignItemWithTrigger` must not be left unconfigured or true on the font selector popup.

### 2. `SPEC-19-02`: Live Element Duplication Fidelity
- **File**: `tests/smoke-spec-19.test.mjs` & `tests/artifact-editor-controls.test.mjs`
- **Assertions**:
  - `handleDuplicateSelected` extracts live styling from the active Fabric object:
    - Text: `fontFamily`, `fontSize`, `fill`, `fontWeight`, `fontStyle`, `underline`, `textAlign`, `lineHeight`, `shadow`.
    - Shape: `fill` (`fillColor`), `opacity`.
  - Dimensions are extracted from `Math.abs(obj.width) * scaleX` and `Math.abs(obj.height) * scaleY`.
  - Duplicating an element creates an exact clone with offset position and matching style dictionary.

### 3. `SPEC-19-03`: Canvas Add Element Tool Isolation (`skipTargetFind`)
- **File**: `tests/smoke-spec-19.test.mjs` & `tests/artifact-editor-controls.test.mjs`
- **Assertions**:
  - When `drawingTool` is active (`'text'` or `'rect'`), `canvas.skipTargetFind` is set to `true` and `canvas.selection` to `false`.
  - When `drawingTool` is cleared, `canvas.skipTargetFind` is restored to `false` and `canvas.selection` to `true`.
  - Click-to-place on top of an existing shape successfully places the element without triggering selection or drag on the underlying object.

### 4. `SPEC-19-04`: Shape Fill Color & Opacity Serialization Persistence
- **File**: `tests/smoke-spec-19.test.mjs`
- **Assertions**:
  - `serializeCanvas` extracts `obj.fill` as `style.fillColor` and `obj.opacity` as `style.opacity` for elements with `type === 'shape'`.
  - Round-trip serialization: A shape with `fill: '#2563EB'` where `source.style.fillColor === '#5C2E16'` updates and serializes into `style: { fillColor: '#2563EB' }`.
  - Validation parity: `validateArtifactTemplate` accepts `fillColor` in shape style.
  - Absence guard: `serializeCanvas` must not omit `source.type === 'shape'` serialization.

### 5. `SPEC-19-05`: Presentation Auto-Shrink Sync & Ratio Invariance
- **File**: `tests/smoke-spec-19.test.mjs`
- **Assertions**:
  - Proportional invariance: `PX_TO_PT === 0.75` (405pt / 540px = 0.75).
  - A 50px font maps to exactly 37.5pt in PPTX geometry.
  - In `ArtifactSlide.tsx`, `largestFittingTextScale` produces scale `<= 1` when text overflows bounding box.
  - Editor toolbar includes overflow warning badge when text content height exceeds authored box dimensions.
  - Documentation file `.how/registry/06-flows/canvas-authoring-controls.md` explains 0.75 pt/px and auto-shrink behavior.

## Manual QA Verification Checklist (Post-Deploy)

### SPEC-19-01 / Font Dropdown Search & Popper Positioning
- [ ] Buka `https://presenter-dev.bic.my.id/admin/artifacts` dan pilih elemen teks.
- [ ] Buka dropdown font (pilih font di kelompok bawah seperti Display / Script).
- [ ] Pastikan dropdown popup merapat rapi persis di bawah tombol pemilih font, bukan jauh di bawah kanvas.
- [ ] Ketik kata kunci pencarian (misal: "mont"). Pastikan textfield bisa diketik, spasi tidak memilih opsi, dan daftar terfilter otomatis.
- [ ] Klik font "Montserrat" dan pastikan font teks di kanvas berubah seketika.

### SPEC-19-02 / Duplikasi Elemen dengan Properti & Styling Lengkap
- [ ] Pilih elemen teks atau shape yang sudah diubah (font size 60, warna merah, shadow blur 14, atau shape warna biru `#1E40AF`).
- [ ] Geser elemen ke posisi tertentu di kanvas.
- [ ] Klik tombol Duplicate atau tekan klik kanan -> Duplicate.
- [ ] Pastikan elemen baru muncul di samping posisi terakhir elemen asli dengan warna, font, ukuran, shadow blur, dan fill yang persis sama.

### SPEC-19-03 / Tambah Elemen Baru di Atas Shape
- [ ] Buat sebuah shape persegi panjang di kanvas.
- [ ] Klik tombol Add Text ("T") di toolbar atas hingga aktif.
- [ ] Arahkan kursor ke atas shape tadi. Pastikan kursor tetap berupa crosshair (bukan icon panah/move).
- [ ] Klik di atas shape tersebut. Pastikan elemen teks baru langsung terpasang di posisi yang diklik tanpa memilih atau menggeser shape di bawahnya.
- [ ] Ulangi untuk Add Shape ("Square") dan coba drag-to-size di atas elemen lain.

### SPEC-19-04 / Persistensi Warna Shape
- [ ] Pilih sebuah shape pada kanvas.
- [ ] Pada toolbar properties di bawah, ubah Fill Color menjadi warna selain coklat (misal biru `#2563EB`).
- [ ] Klik tombol Save untuk menyimpan slide.
- [ ] Muat ulang halaman (F5 / browser refresh).
- [ ] Pastikan shape tetap berwarna biru dan tidak kembali ke warna coklat.

### SPEC-19-05 / Penjelasan Font 50px -> 37.5pt & Text Shrink 180px
- [ ] Buat teks berukuran besar (misal font size 180px).
- [ ] Perhatikan apakah teks meluap (overflow) dari kotak bounding box-nya dan perhatikan badge/hint di toolbar properties.
- [ ] Buka tampilan tayangan / presentasi (present view).
- [ ] Verifikasi teks di-shrink secara proporsional agar pas di dalam frame presentasi tanpa terpotong.
- [ ] Unduh deck PPTX dan verifikasi ukuran font 50px di canvas menjadi 37.5pt di PowerPoint dengan rasio visual yang identik (0.75 pt/px).

## Regression Guardrails
- All previous SPEC-12 through SPEC-18 tests (`tests/smoke-spec-18.test.mjs`, `tests/artifact-editor-layout.test.mjs`, `tests/artifact-editor-controls.test.mjs`, etc.) must continue to pass without failure.
- Public repo guard (`tests/public-repo-guard.test.mjs`) must remain clean.

# SPEC-21 Test Plan: Automated Smoke Tests & Manual QA Gate

## 1. Automated Smoke Suite (`tests/smoke-spec-21.test.mjs`)

| Test ID | Objective | Assertions |
|---|---|---|
| **T-21-01** | Pure Helper Functions for Font Size Commit | `commitFontSizeFromDraft` and `parseFontSizeDraft`: draft '1' does not clamp immediately; blur on '1' commits 8; blur on '12' commits 12; blur on '20' commits 20; blur on empty/invalid reverts to committed font size; blur on '999' clamps to 200. |
| **T-21-02** | Keystroke Isolation Source Guard | `ArtifactEditor.tsx`: font size `onChange` handler does not call `syncSelection(canvas)`; commit handler bound to `onBlur` and `Enter`. |
| **T-21-03** | Off-Canvas Width Preservation | `serializeCanvas`: element at `x = 70%`, `w = 50%` serializes as `w = 50%` (not clamped to `30%`); `x + w > 100` survives save. |
| **T-21-04** | Off-Canvas Height Preservation | `serializeCanvas`: element at `y = 85%`, `h = 30%` serializes as `h = 30%` (not clamped to `15%`). |
| **T-21-05** | Height Auto-Sync Regression Guard | `serializeCanvas`: text element with small authored `h` expands to encapsulated text height upon save. |
| **T-21-06** | Handle Narrowing Regression Guard | `serializeCanvas`: text element intentionally narrowed via resize handles persists its narrowed width. |
| **T-21-07** | Absence of `splitByGrapheme` | `ArtifactEditor.tsx`: `splitByGrapheme: true` is absent from `fabric.Textbox` instantiation. |
| **T-21-08** | Font Stack Alignment | `ArtifactEditor.tsx`: `elementToFabricObject` passes `getFontStack(style?.fontFamily)` to `fabric.Textbox`. |
| **T-21-09** | Line Height Alignment | `render-model.ts`, `ArtifactEditor.tsx`, `canvas-utils.ts`: `TEXT_LINE_HEIGHT = 1.2` is the unified default; Fabric `1.16` default is eliminated. |
| **T-21-10** | Explicit Line Height Persistence | `serializeTextStyle`: explicit `lineHeight: 1.5` persists in style JSON, while default `1.2` is omitted. |
| **T-21-11** | Documentation Policy Guard | `.how/registry/06-flows/canvas-authoring-controls.md`: documents that off-canvas bleeding is permitted and preserved without bounding box clamping. |

---

## 2. Manual QA Gate on Dev (`presenter-dev.bic.my.id`)

```markdown
SPEC-21-01 / Screen: /admin/artifacts (Toolbar Row 2 - Font Size Input)
  1. Font Size Deferred Commit & Keystroke Continuity
     [ ] Buka `/admin/artifacts`, pilih salah satu template slide general bertipe canvas.
     [ ] Klik salah satu elemen teks pada canvas untuk menampilkan panel properti teks di toolbar baris 2.
     [ ] Sorot seluruh angka font size (misal: "32").
     [ ] Ketik angka "1" lalu "2"; pastikan angka tetap tampil sebagai "1" lalu "12" tanpa terpental atau langsung berubah menjadi "8".
     [ ] Tekan tombol Enter atau klik di luar input (blur); pastikan ukuran teks pada canvas berubah menjadi 12px dan input tetap menampilkan "12".
     [ ] Ulangi pengetikan untuk angka "20"; pastikan angka "2" tidak memicu snap ke "8" dan angka "20" berhasil dikomit.
     [ ] Kosongkan input font size (tekan Backspace sampai kosong) lalu klik di luar input; pastikan input dan canvas kembali ke ukuran font sebelumnya secara aman tanpa error.

SPEC-21-02 / Screen: /admin/artifacts, /presenter, & Download PPTX
  1. Off-Canvas Geometry Preservation (Bleeding Elements)
     [ ] Di canvas editor `/admin/artifacts`, buat atau geser elemen teks atau kotak ke tepi kanan slide sehingga sebagian elemen keluar dari kanvas (misal: x = 70%, lebar = 50%).
     [ ] Klik tombol Save untuk menyimpan template.
     [ ] Muat ulang halaman (refresh) atau klik slide lain lalu kembali ke slide ini; pastikan kotak bounding box dan elemen TIDAK menyusut atau terpotong ke tepi kanan (x=70%, w=50% tetap bertahan).
     [ ] Buka tampilan tayangan di `/presenter` atau unduh file PPTX; pastikan elemen merender sesuai ukuran aslinya dan terpotong secara alami di tepi panggung 16:9 (overflow: hidden) tanpa font mengecil mendadak.

SPEC-21-03 / Screen: /admin/artifacts vs /presenter & PPTX
  1. Whole Word Wrapping & Cross-Renderer Typography Parity
     [ ] Pada canvas editor, buat kotak teks dengan teks panjang seperti "Bandung International Community".
     [ ] Atur lebar kotak teks sehingga kata "International" tidak muat di baris pertama setelah kata "Bandung".
     [ ] Pastikan kata "International" turun secara utuh ke baris kedua (bukan terpotong menjadi "Bandung In" dan "ternational").
     [ ] Simpan template, lalu bandingkan tampilan slide di canvas editor dengan tampilan di `/presenter` dan PPTX.
     [ ] Pastikan pemotongan baris teks (line break) dan proporsi font pada Canvas Editor identik 1:1 dengan Presentation View dan PPTX.
```

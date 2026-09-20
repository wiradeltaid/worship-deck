# WYSIWYG Parity Investigation Task for Claude Opus

Anda diminta melakukan audit arsitektural dan analisis mendalam terhadap **disparitas visual (WYSIWYG parity)** antara tiga surface rendering slide di repository `worship-presenter-web`:
1. **Canvas Artifact Editor** (`src/components/admin/ArtifactEditor.tsx` via Fabric.js Textbox)
2. **Presenter Mode** (`src/components/artifacts/ArtifactSlide.tsx` via CSS/HTML flex layout & ResizeObserver text-fit)
3. **PPTX Download** (`src/lib/pptx-draw.ts` via PptxGenJS di LibreOffice Impress / Microsoft PowerPoint)

---

## 1. File & Aset yang Perlu Anda Periksa

### Gambar Screenshot (6 File dalam 2 Dataset)
Lokasi gambar di repositori:
- **Jenis 1 (Text-wrap & Overflow)**:
  - `.scratch/wysiwyg-analysis/image-1-jenis1-canvas.png` (Canvas Editor)
  - `.scratch/wysiwyg-analysis/image-2-jenis1-present.png` (Presenter Mode)
  - `.scratch/wysiwyg-analysis/image-3-jenis1-pptx.png` (PPTX di LibreOffice)
  - *Data*: Teks `"Bandung international community"`.
  - *Masalah visual*: Di Canvas & Presenter tertulis `"Bandung"`, baris 2 `"internationa"` (huruf `l` hilang/terpotong), baris 3 `"community"`. Di PPTX tertulis `"Bandung"`, baris 2 `"internationa"`, baris 3 `"l community"` (huruf `l` pindah baris mendampingi `community`).

- **Jenis 2 (Font Cursive & Off-Canvas Bleed)**:
  - `.scratch/wysiwyg-analysis/image-4-jenis2-canvas.png` (Canvas Editor)
  - `.scratch/wysiwyg-analysis/image-5-jenis2-present.png` (Presenter Mode)
  - `.scratch/wysiwyg-analysis/image-6-jenis2-pptx.png` (PPTX di LibreOffice)
  - *Data*: Teks tengah `"New text"` putih, 4 teks sudut di luar kanvas (kiri-atas sans putih, kanan-atas script cursive merah, kiri-bawah script cursive merah, kanan-bawah sans putih).
  - *Masalah visual*: Font script cursive merah tampil indah di Canvas & Presenter (via Google Fonts), namun di PPTX berubah total menjadi sans-serif (Arial/Liberation Sans) dan potongan huruf yang tampak di tepi slide bergeser.

### File Kode Kunci Terkait
- `src/components/admin/ArtifactEditor.tsx` (Fabric canvas textbox layout)
- `src/components/artifacts/ArtifactSlide.tsx` (CSS layout, `overflow: hidden`, bisection fit-scale)
- `src/lib/registry/canvas-utils.ts` (`serializeCanvas`, penangkapan `wrapLines` dari Fabric)
- `src/lib/artifacts/render-model.ts` (`resolveElementTextForPptx`, `resolveFontFamily`, `toCssGeometry`)
- `src/lib/pptx-draw.ts` (`margin: 0`, PptxGenJS text rendering)
- `src/lib/registry/font-catalog.ts` (Daftar font Google & CSS fallback)

### Referensi Analisis Model Lain (Tersedia untuk Dibaca)
- `.scratch/wysiwyg-analysis/analysis-gpt-5.6-sol-high.md`
- `.scratch/wysiwyg-analysis/analysis-composer-2.5.md`

---

## 2. Poin yang Harus Dijawab dalam Laporan Analisis

1. **Kasus Jenis 1**:
   - Jelaskan mekanisme internal mengapa huruf `l` terpotong di web (`overflow: hidden` + Fabric bounding box) vs mengapa di PPTX Office melakukan *character-level break* dan menggabungkannya menjadi `"l community"`.
   - Mengapa `wrapLines` dari Fabric (`canvas-utils.ts`) belum menyelesaikan masalah ini secara 100% pada semua kasus (misal: slide lama sebelum SPEC-22, atau jika Fabric sendiri sudah memecah kata)?
   - Mengapa Presenter Mode (`ArtifactSlide.tsx`) saat ini mengabaikan `wrapLines` dan hanya me-render `content` mentah?

2. **Kasus Jenis 2**:
   - Jelaskan mengapa Google Fonts (seperti font script cursive) tidak muncul di PPTX. Apa perbedaan antara deklarasi nama font di PPTX (`fontFace`) vs font embedding binary?
   - Mengapa posisi/potongan elemen off-canvas di tepi slide terlihat sedikit bergeser di PPTX meskipun persentase koordinatnya sama? (Hubungan antara metrik glif sans-serif vs script, padding/margin box, dan baseline font).

3. **Solusi Arsitektural Menuju Paritas Sejati (WYSIWYG)**:
   - Apa arsitektur terbaik untuk menyelaraskan ketiga surface ini?
   - Berikan evaluasi konkret untuk:
     a) Otoritas line-break (`wrapLines` vs layout engine sentral).
     b) Penanganan font di PPTX (Font embedding TTF ke arsip PPTX vs Dual-mode Export / Canvas raster/vector rendering).
     c) Langkah implementasi bertahap (Wave / Spesifikasi berikutnya).

---

## 3. Instruksi Penyimpanan Output

Tuliskan seluruh hasil analisis dan rekomendasi arsitektur Anda secara lengkap ke dalam file berikut:
**`.scratch/wysiwyg-analysis/analysis-opus-5.md`**

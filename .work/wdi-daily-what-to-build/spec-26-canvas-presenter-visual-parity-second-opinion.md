# Second Opinion Review Packet: SPEC-26 Canvas vs Presenter Visual & Framing Parity

## 1. Path to Drafted Spec & Tickets
- Spec: `D:\Developer\wiradigital.id\worship-presenter-web\.scratch\SPEC-26-canvas-presenter-visual-parity\SPEC.md`
- Tickets:
  - `D:\Developer\wiradigital.id\worship-presenter-web\.scratch\SPEC-26-canvas-presenter-visual-parity\issues\01-browser-visual-diagnostics.md`
  - `D:\Developer\wiradigital.id\worship-presenter-web\.scratch\SPEC-26-canvas-presenter-visual-parity\issues\02-canvas-presenter-parity-fix.md`
  - `D:\Developer\wiradigital.id\worship-presenter-web\.scratch\SPEC-26-canvas-presenter-visual-parity\issues\03-parity-regression-tests.md`
- Registry:
  - `.control/registry/specs.yaml` (entry: `SPEC-26`)
  - `.control/registry/defects.yaml` (entry: `BUG-34`)

## 2. Original Raw Owner Notes (Unedited)
```
masih bermasalah, apakah sebelum buat spek/tiket, langsung kamu kontrol aja browser pakai computer use orca? biar langsung lihat perbedaannya, dan masalah soal deploy ke dev lokal, atau ke devops web bebas2 aja asal terpenuhi terselesaikan - soalnya udah mentok disini2 terus. Kalau butuh saran2 opus silahkan saja:
Admin Artifacts Editor (/admin/artifacts) — BUG-33 / SPEC-25-01
1. Re-measure All Batch Healing & Style Preservation
   [x] Konfirmasi proses selesai tanpa melempar error runtime ("t._set is not a function")
   [x] Buka template yang memiliki kombinasi teks dan shape (misal layout dengan shape block) dan pastikan fillColor (misal #5C2E16) dan opacity shape tetap utuh, tidak berubah menjadi hitam (#000000)
   [x] Pastikan style teks (warna teks fontColor, alignment, lineHeight, underline, shadow) tidak hilang/ter-reset pada elemen yang tidak berubah
   [x] Klik "Re-measure all" sekali lagi dan pastikan proses bersifat idempoten (tidak ada mutasi tambahan atau perubahan layout)

Presenter & Projector View (/projector, /slideshow) — BUG-34 / SPEC-25-03 -> masih belum sesuai antara canvas dan present
1. 16:9 Stage Letterbox Framing Parity
   [ ] Buka template dengan elemen teks dan balok warna di dekat batas frame (misal layout "Bandung international community") di Canvas Editor dan perhatikan marginnya
   [ ] Buka slide yang sama di Presenter atau Projector view di https://presenter-dev.bic.my.id
   [ ] Ubah ukuran jendela browser menjadi rasio lebih lebar dari 16:9 (misal ultra-wide atau window dipipihkan ke horizontal): pastikan muncul letterbox bar (pilar hitam di kiri/kanan) dan teks bagian atas (huruf "B"), bawah ("y"), serta balok warna di sisi kanan tidak terpotong
   [ ] Ubah ukuran jendela browser menjadi rasio lebih tinggi dari 16:9 (misal window kotak/portrait): pastikan muncul letterbox bar atas/bawah tanpa memotong konten
   [ ] Konfirmasi framing dan proporsi tampilan di Presenter presisi menyerupai preview Canvas Editor
```

## 3. Standing Reviewer Mandate
If this draft touches the architecture spine, an SRS, an SDD, or a SPEC, you're authorized to run `wdi-review` on it yourself and edit the document directly to apply its stamp — no need to ask first, that permission is already given for this dispatch.

## 4. Reviewer Instructions & Specific Focus Questions
You are acting as an independent second-opinion reviewer on `SPEC-26`. The owner is asking for deep analysis and advice on why the previous fix attempt in SPEC-25-03 (wrapping `ArtifactSlide` with CSS container queries) failed to resolve the visual discrepancy between Canvas Editor and Presenter/Projector view.

Please evaluate:
1. **Diagnosis & Mechanics**: What structural difference between Fabric.js's 960x540 canvas rendering (in `ArtifactEditor.tsx`) and `ArtifactSlide.tsx`'s HTML/CSS rendering could cause the slide to appear inset with margins on Canvas, yet scaled up and cropped (or lacking margins) in Presenter/Projector?
   - Consider Fabric canvas zoom vs CSS stage scaling.
   - Consider `overflow: hidden` on `boxStyle` vs Textbox rendering.
   - Consider `toCssGeometry` (`cqh` font sizes vs percentage dimensions).
   - Consider background image scaling (`scaleX/scaleY` in Fabric vs `backgroundSize: 'cover'` in CSS).
   - Consider container queries when parent height is indefinite or aspect-ratio derived.
2. **Owner's Question on Browser Control**: The owner asked: *"apakah sebelum buat spek/tiket, langsung kamu kontrol aja browser pakai computer use orca? biar langsung lihat perbedaannya, dan masalah soal deploy ke dev lokal, atau ke devops web bebas2 aja asal terpenuhi terselesaikan - soalnya udah mentok disini2 terus"*. Provide clear architectural and procedural advice on how we can use Playwright Chromium in this repo to inspect and verify the visual parity directly without relying on guesswork.
3. **Spec Completeness & Tickets Review**: Review `SPEC.md` and the 3 tickets in `.scratch/SPEC-26-canvas-presenter-visual-parity/issues/`. Edit and stamp them if they are sound, or identify any missing constraints, false assumptions, or gaps.

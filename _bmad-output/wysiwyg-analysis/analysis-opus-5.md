# WYSIWYG Parity — Audit Arsitektural (Claude Opus 5)

Ruang lingkup: `ArtifactEditor` (Fabric.js) · `ArtifactSlide` (CSS/DOM) · `pptx-draw` (PptxGenJS → LibreOffice/PowerPoint).
Basis bukti: 6 screenshot, pembacaan kode, **probe eksekusi nyata** terhadap `generatePptxFromPlan` (XML slide diperiksa),
pembacaan sumber Fabric v6.6.1 dan pptxgenjs 4.0.1, serta pemindaian `data.db` + kedua `default-registry.json`.

> **Catatan tracking.** Keenam screenshot yang dirujuk di bawah **tidak di-commit**: guard repo
> publik (`tests/public-repo-guard.test.mjs`) hanya mengizinkan gambar di-track di bawah `public/`.
> File-nya ada secara lokal di `.scratch/wysiwyg-analysis/` dan di-ignore. Setiap klaim yang
> bergantung padanya disebutkan sebagai pengukuran, bukan sebagai gambar yang bisa dibuka pembaca.

---

## 0. Ringkasan eksekutif

Tiga temuan yang mengubah cara masalah ini harus dibaca. Ketiganya diverifikasi, bukan disimpulkan dari screenshot saja.

**T1 — `wrapLines` saat ini inert pada seluruh data nyata.**
Pemindaian byte atas `data.db` (6,1 MB), `data/default-registry.json`, dan `data/local/default-registry.json`
menghasilkan **0 kemunculan** string `wrapLines`. Pipeline SPEC-22 (schema → validate → hydrate → render-model → pptx)
utuh dan benar, tetapi field-nya hanya lahir saat sebuah elemen teks di-*save ulang* lewat kanvas, dan tidak pernah untuk
elemen ber-`placeholderKey`. Jadi setiap slide yang ada hari ini masih menempuh jalur pra-SPEC-22. Ini menjelaskan
screenshot Jenis 1 sepenuhnya — dan menjelaskan mengapa "sudah ada `wrapLines`" tidak berlaku sebagai jawaban.

**T2 — Lebar kotak teks dipersist tepat sama dengan lebar kata terpanjang. Ini adalah *knife edge* by construction.**
Fabric `Textbox` tidak pernah memecah kata saat `splitByGrapheme: false`; alih-alih, ia **melebarkan dirinya sendiri**
sampai muat (`index.node.mjs:23008-23009`, `_set('width', this.dynamicMinWidth)`) dan melebarkan kolom wrap-nya
(`:23292`, `maxWidth = Math.max(desiredWidth, largestWordWidth, dynamicMinWidth)`). `serializeCanvas` kemudian
mendeteksi pelebaran itu sebagai resize dan menuliskannya balik ke registry (`canvas-utils.ts:344-358`). Hasilnya
`w` tersimpan ≈ lebar `"international"` **dengan slack nol**. Setiap perbedaan sub-persen antar engine — kerning,
shaping, pembulatan EMU — membalik keputusan wrap. Web kebetulan jatuh di sisi "muat", LibreOffice di sisi "tidak muat".

**T3 — `margin: 0` sudah benar-benar terbit; hipotesis "inset 0.2 inci" tidak lagi berlaku.**
Probe atas build saat ini menghasilkan `<a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" …>`.
Dua analisis pembanding (`analysis-gpt-5.6-sol-high.md`, `analysis-composer-2.5.md`) masih menaruh inset default
sebagai sebab utama/pendamping Jenis 1. Itu keliru untuk build ini. Penyempitan kolom bukan penyebabnya — **slack nol**-lah
penyebabnya.

Konsekuensi arsitektural: masalahnya bukan "PPTX salah wrap". Masalahnya adalah **tidak ada satu pun otoritas layout**;
ada tiga engine yang masing-masing membuat keputusan yang sama secara independen, dengan toleransi nol.

---

## 1. Peta: tiga layout engine, tiga kebijakan overflow

| | Canvas (Fabric 6.6.1) | Presenter (Chromium/CSS) | PPTX (LibreOffice / PowerPoint) |
|---|---|---|---|
| Sumber teks | `element.content` | `resolveElementText()` — **teks mentah** | `resolveElementTextForPptx()` — `wrapLines` bila ada |
| Kolom wrap | `max(box.w, lebar kata terpanjang)` | `box.w` persis | `box.w` persis (`lIns/rIns = 0`) |
| Kata > kolom | **tidak pernah dipecah**; kotak dilebarkan | **tidak pernah dipecah**; meluber, lalu di-clip | **dipecah per karakter** (emergency break) |
| Pengukuran glyph | `ctx.measureText` per grapheme, dijumlahkan — **tanpa kerning/shaping** | HarfBuzz penuh: kerning, ligatur, shaping | layout engine masing-masing, font pengganti |
| Shrink-to-fit | **tidak ada** | diukur browser, bisection 8 probe | estimasi server + `<a:normAutofit/>` |
| Resolusi font | Google Fonts (CSS stack) | Google Fonts (CSS stack) | **hanya nama** (`<a:latin typeface="…"/>`) |

Tiga baris terakhir adalah tiga kelas kegagalan yang berbeda. Jenis 1 lahir dari baris 3–5, Jenis 2 dari baris 6.

---

## 2. Jenis 1 — `"Bandung international community"`

### 2.1 Yang sebenarnya terjadi di Canvas

Fabric memecah pada spasi. `"international"` pada `fontSize` terpakai lebih lebar dari `w` yang di-author.
Karena `splitByGrapheme: false`, `_wrapLine` **tidak** memecah kata:

```
// node_modules/fabric/dist/index.node.mjs:23292
const maxWidth = Math.max(desiredWidth, largestWordWidth, this.dynamicMinWidth);
```

dan `initDimensions` melebarkan objeknya:

```
// :23007-23010
// if after wrapping, the width is smaller than dynamicMinWidth, change the width and re-wrap
if (this.dynamicMinWidth > this.width) { this._set('width', this.dynamicMinWidth); }
```

Jadi `textLines = ["Bandung", "international", "community"]` — **benar** — dan `obj.width` sudah bukan lagi
lebar yang di-author, melainkan lebar `"international"`. Huruf `l` tidak hilang di sini; kotaknya melewati tepi
stage dan **stage**-lah yang meng-clip-nya. Ini konsisten dengan image-1: `"internationa"` berhenti persis di tepi kanan.

### 2.2 Pelebaran itu dipersist — dan itulah akar knife edge-nya

```
// src/lib/registry/canvas-utils.ts:341-358
const measuredWidth = Math.abs(obj.width ?? 0) * scaleX;
const isWidthResized = Math.abs(measuredWidth - authoredWidth) > 1;
// SPEC-20-04: Auto-sync bounding box dimensions for text elements …
const w = isWidthResized ? pxToPct(measuredWidth, CANVAS_WIDTH) : …
```

`measuredWidth` di sini adalah `obj.width` **yang sudah dilebarkan Fabric**, bukan lebar yang diminta pengguna.
Selisihnya > 1px, jadi `isWidthResized` true, dan registry menerima `w` = lebar kata terpanjang **menurut metrik Fabric**.

Metrik Fabric adalah penjumlahan advance per-grapheme tanpa kerning dan tanpa shaping. Chromium (presenter) dan
LibreOffice keduanya *melakukan* shaping. Tidak ada jaminan hasil keduanya ≤ angka Fabric, dan tidak ada slack
sedikit pun untuk menyerap selisihnya. Kedua engine memutuskan hal yang sama pada nilai yang praktis identik,
lalu berbeda **hanya pada apa yang mereka lakukan ketika keputusannya "tidak muat"**.

### 2.3 Presenter: meluber lalu di-clip

`ArtifactSlide` menaruh teks di blok `width: 100%` dengan `white-space: pre-wrap`. Default CSS
`overflow-wrap: normal` berarti kata yang lebih lebar dari barisnya **meluber**, tidak dipecah. Kotak elemen
memakai `overflow: hidden` (`ArtifactSlide.tsx:44`) dan stage juga. Maka `l` hilang secara visual — persis
seperti canvas. Web dan canvas sepakat bukan karena berbagi otoritas, melainkan karena kebetulan berbagi
kebijakan overflow yang sama.

### 2.4 PPTX: emergency character break

OOXML/DrawingML tidak punya konsep "biarkan meluber". Ketika satu kata melebihi lebar shape, PowerPoint dan
LibreOffice memecahnya pada batas karakter. `"international"` → `"internationa"` + `"l"`, dan karena teks yang
dikirim adalah **satu paragraf** (`"Bandung international community"`, tanpa `\n`), sisa `"l"` lanjut di baris
berikutnya dan spasi berikutnya menempelkan `"community"` di sampingnya → `"l community"`. Ini juga bukti
negatif yang kuat: seandainya `wrapLines` terpakai, `"community"` akan berada di paragraf sendiri dan
**tidak mungkin** sebaris dengan `"l"`.

### 2.5 Mengapa `wrapLines` belum menyelesaikan masalah

Empat alasan berlapis, dari yang paling menentukan:

1. **Field-nya tidak ada di data mana pun.** 0 kemunculan di `data.db` dan di kedua registry. Semua slide
   lama tidak punya, dan tidak ada migrasi/backfill. Field hanya lahir saat re-save kanvas.
2. **Elemen placeholder secara sengaja dikecualikan** (`canvas-utils.ts:386-392`,
   `isPlaceholderToken`). Justru elemen dinamis — judul khotbah, lirik — yang paling sering panjang dan
   paling butuh otoritas wrap. Pengecualiannya beralasan (teks disubstitusi belakangan), tapi berarti
   kelas elemen terpenting permanen tanpa perlindungan.
3. **Guard koherensi menutup lebih dari yang perlu.** `flatWrap === flatText` setelah normalisasi whitespace
   (`render-model.ts:255-262`, `281-288`). Aman, tetapi setiap teks yang mengandung newline eksplisit
   *dan* soft-wrap, atau spasi non-breaking, atau hasil substitusi apa pun, jatuh diam-diam ke fallback
   tanpa jejak. Tidak ada telemetri kapan guard ini menolak.
4. **Dan bahkan bila `wrapLines` terpakai, Jenis 1 tetap tidak sembuh.** Ini poin yang terlewat di kedua
   analisis pembanding. Paragraf `"international"` sendirian tetap lebih lebar dari shape; LibreOffice
   tetap memecahnya. Hasilnya berubah dari `"internationa" / "l community"` menjadi
   `"internationa" / "l" / "community"` — berbeda dari web, hanya dengan cara lain. **`wrapLines` memindahkan
   otoritas *di mana* memecah, tetapi tidak bisa mengungkapkan "jangan pecah kata ini".** OOXML tidak punya
   padanan `word-break: keep-all`. Satu-satunya obat adalah memastikan kolomnya memang cukup lebar —
   yakni memberi slack, atau mengecilkan font sampai kata terpanjang muat.

### 2.6 Cacat kedua yang berdiri sendiri: estimator fit buta pada sumbu lebar

```
// src/lib/artifacts/render-model.ts:299-315
const lines = resolveWrapLineCount(element);
return resolveTextFitScale({
  contentWidth: 0,          // ← sumbu lebar tidak pernah menekan skala
  contentHeight: lines * TEXT_LINE_HEIGHT * em,
  …
});
```

Dua akibat:

- Tanpa `wrapLines`, `resolveWrapLineCount` jatuh ke `text.split('\n').length` = **1**. Paragraf tiga baris
  dinilai satu baris, `estimateTextFitScale` mengembalikan **1.0**, dan PPTX diekspor pada ukuran penuh —
  sementara presenter mengukur tiga baris nyata dan menyusut. Pengukuran saya pada image-2 vs image-3
  menunjukkan cap-height PPTX sekitar 5–7 % lebih besar dari presenter, konsisten dengan ini.
- Font yang lebih besar → kolom relatif lebih sempit → knife edge (§2.2) makin condong ke sisi "tidak muat"
  di PPTX. Jadi cacat estimator **memperkuat** cacat slack-nol. Keduanya bergandengan.

`contentWidth: 0` dikomentari sebagai "wrapping is accounted for by resolveWrapLineCount". Itu benar untuk
teks yang wrap-nya sudah diketahui, tetapi salah untuk **kata tunggal yang lebih lebar dari kotaknya** —
kasus yang justru sedang kita hadapi.

Cacat ketiga di area yang sama: `<a:normAutofit/>` diterbitkan **tanpa atribut `fontScale`** (terbukti di probe).
PowerPoint tidak menghitungnya sampai shape disentuh; LibreOffice menghitungnya sendiri saat layout. Jadi
`fit: 'shrink'` memberi hasil yang berbeda antara kedua aplikasi Office atas file yang sama — satu sumber
divergensi lagi yang tidak dikendalikan siapa pun.

### 2.7 Mengapa Presenter mengabaikan `wrapLines`

Karena tidak pernah disambungkan. `ArtifactSlide` memanggil `resolveElementText(element)` dan menyerahkan
string mentah ke DOM; hanya jalur PPTX yang memanggil `resolveElementTextForPptx`. Secara desain itu
konsisten dengan komentar di `ArtifactSlide` ("browser twin of the PPTX renderer") tetapi secara faktual
tidak: presenter adalah engine wrap **ketiga**, bukan kembaran.

Ada alasan sah untuk membiarkannya: presenter melakukan shrink-to-fit terukur, dan menyuntikkan hard break
dari `wrapLines` akan mengunci pemecahan yang dihitung pada ukuran font *sebelum* penyusutan — teks yang
menyusut mungkin muat dalam lebih sedikit baris, dan hard break akan mencegahnya (justru kasus yang
`largestFittingTextScale` diciptakan untuk menangani — lihat komentar "Welcome to"). Jadi menyambungkan
`wrapLines` ke presenter apa adanya akan **memperburuk** presenter demi paritas. Ini bukti bahwa `wrapLines`
sebagai snapshot adalah abstraksi yang salah: ia menyandera hasil wrap pada satu ukuran font tertentu,
padahal ukuran font itu sendiri turunan dari hasil wrap.

---

## 3. Jenis 2 — font script dan pergeseran potongan off-canvas

### 3.1 Nama font vs biner font

PPTX menyimpan **referensi nama**, bukan font:

```xml
<a:latin typeface="Great Vibes" pitchFamily="34" charset="0"/>
```

Itu instruksi "cari face bernama Great Vibes di sistem ini". Di mesin LibreOffice tanpa font tersebut,
fontconfig melakukan substitusi ke default sans (Liberation Sans) — dan tidak ada mekanisme fallback
berjenjang seperti CSS. `fallback: 'cursive'` di `font-catalog.ts` dan URL Google Fonts hanya hidup di
browser; keduanya nol pengaruh pada PPTX. PptxGenJS 4.0.1 tidak punya API embedding sama sekali.

OOXML **memang** mendukung embedding: `ppt/fonts/fontN.fntdata` (TTF/OTF mentah, tidak diobfuskasi — berbeda
dari `.odttf` milik Word), didaftarkan di `ppt/presentation.xml` lewat
`<p:embeddedFontLst><p:embeddedFont><p:font typeface="…"/><p:regular r:id="…"/></p:embeddedFont></p:embeddedFontLst>`,
plus rel dan `[Content_Types].xml` (`application/x-fontdata`). Repo ini **sudah punya hook yang tepat** untuk itu:
`postProcessArchive` di `pptx-draw.ts` membuka arsip dengan JSZip, sudah memodifikasi `.rels` dan XML slide
(`collapseDuplicateMedia`, `injectSlideTransitions`), lalu menulis ulang. Embedding font adalah satu tahap lagi
di pipeline yang sama.

Catatan lisensi yang menguntungkan: seluruh 35 Google Font di katalog berlisensi OFL atau Apache-2.0 —
embedding diizinkan tanpa syarat khusus. Ini jarang; jangan disia-siakan.

Yang perlu dicatat sebagai risiko: **dukungan pembaca bervariasi.** PowerPoint di Windows menghormati embedded
font. PowerPoint for Mac historisnya mengabaikannya. LibreOffice Impress mengimpor embedded font pada versi
modern, tetapi saya **tidak memverifikasi** ini pada versi yang dipakai jemaat. Ini harus diuji sebelum
dijadikan fondasi arsitektur, bukan diasumsikan.

### 3.2 Mengapa potongan off-canvas bergeser meski persentase koordinatnya identik

Koordinat kotak identik — itu benar dan bukan itu yang bergeser. Yang bergeser adalah **tinta di dalam kotak**.
Lima mekanisme, semuanya aktif sekaligus:

1. **Advance width berbeda.** Untuk kotak yang mulai di `x` negatif (kiri-bawah pada image-4/6), yang terlihat
   adalah ekor string; huruf mana yang muncul di batas ditentukan oleh akumulasi advance glyph yang terpotong.
   Great Vibes jauh lebih sempit per karakter daripada Liberation Sans → fragmen yang tampak berbeda. Ini
   persis yang terlihat: canvas menampilkan `"ew text"` kursif, PPTX menampilkan `"lew text"` sans.
2. **Kerning dan shaping.** Fabric menjumlahkan advance per-grapheme tanpa kerning; Chromium dan LibreOffice
   melakukan shaping penuh. Untuk face script dengan banyak pasangan kerning dan glyph yang saling tumpang
   tindih, selisihnya bisa beberapa persen — bukan sub-piksel.
3. **Ascent/descent dan baseline pertama.** CSS menempatkan baris pertama dalam line box setinggi
   `lineHeight × fontSize`, dengan **half-leading** `(1.2 − (ascent+descent)) / 2 em` di atasnya. OOXML dengan
   `tIns="0"` dan `anchor="t"` menempatkan puncak ascent di tepi atas kotak. Untuk Arial selisihnya ≈ 0.04 em;
   pada 96 px itu ~4 px. Untuk face script dengan ascent/descent ekstrem (Great Vibes punya ascender sangat
   tinggi), selisihnya jauh lebih besar — dan setelah substitusi ke sans, berubah lagi.
4. **Semantik line spacing berbeda.** `lineSpacingMultiple` hanya diterbitkan bila `style.lineHeight`
   bertipe number (`pptx-draw.ts:267`). Bila tidak, PowerPoint memakai 100 % = line gap milik font, sedangkan
   web selalu memakai `TEXT_LINE_HEIGHT = 1.2`. Dua definisi "satu baris" yang berbeda.
5. **Autofit yang tidak simetris** (§2.6) menggeser ukuran, dan ukuran menggeser semuanya.

### 3.3 Cacat yang berdiri sendiri: tidak ada gate kesiapan webfont

Stylesheet Google dimuat dengan `display=swap` (`spa/index.html:9`, `spa/projected.html:9`), dan **tidak ada satu pun**
`document.fonts.ready` / `document.fonts.load` di seluruh `src/` maupun `spa/`. Dua akibat nyata:

- **Editor:** bila Fabric membangun Textbox sebelum face tiba, seluruh pengukuran — `textLines`, `dynamicMinWidth`,
  dan `w` yang dipersist (§2.2) — dihitung terhadap font fallback, lalu **ditulis permanen ke registry**.
  Geometri yang salah menjadi data.
- **Presenter:** `applyFit` dijalankan sekali di `useLayoutEffect` lalu hanya diulang oleh `ResizeObserver`
  yang mengamati **kotak**. Kotak tidak berubah ukuran ketika font swap terjadi, jadi skala fit tidak
  pernah dihitung ulang — teks proyeksi bisa terkunci pada skala yang dihitung untuk face yang salah.
  Ini bug yang independen dari paritas PPTX dan berdampak langsung pada layar jemaat.

---

## 4. Arsitektur menuju paritas sejati

### 4.0 Prinsip

Paritas piksel dengan **teks yang tetap editable di PowerPoint** tidak mungkin dijamin — pembaca terakhir
selalu memiliki shaping engine sendiri. Yang bisa dijamin adalah **paritas keputusan**: line break, ukuran
font, dan penempatan baris ditentukan **satu kali oleh satu otoritas**, dan ketiga surface hanya
*mengeksekusi* keputusan itu. Setiap tempat di mana sebuah engine masih boleh memutuskan sendiri adalah
sumber drift, dan harus dihitung sebagai utang.

Rumusnya: **kurangi jumlah keputusan, lalu beri slack pada keputusan yang tersisa.**

### 4.a Otoritas line-break — evaluasi

| Opsi | Isi | Nilai | Vonis |
|---|---|---|---|
| **A. Status quo `wrapLines`** | snapshot `textLines` Fabric, dipakai PPTX saja | murah; sudah ada | **Tidak memadai.** Inert pada semua data (T1), tidak menutup kata overlong (§2.5.4), menyandera hasil pada satu ukuran font (§2.7), dan mengecualikan placeholder |
| **B. `wrapLines` + slack + backfill** | idem, plus jaminan `w ≥ lebar kata terpanjang × (1+ε)`, plus migrasi, plus `<a:br/>` alih-alih paragraf | masih murah; memperbaiki 90 % kasus nyata | **Jalur jangka pendek yang benar.** Bukan tujuan akhir |
| **C. Layout engine sentral, offline** | satu modul shaping (opentype.js / harfbuzzjs) atas font yang di-*self-host*, menghasilkan `TextLayout` — baris, fit scale, ascent/descent, baseline — disimpan di registry; ketiga surface merender plan itu tanpa me-wrap ulang | paritas keputusan sejati; deterministik; bisa dites tanpa browser | **Tujuan arsitektural.** Biaya: satu dependensi shaping + font TTF di repo |
| **D. Satu renderer untuk canvas & presenter** | presenter memakai Fabric juga (atau editor memakai DOM) | menghapus satu dari tiga engine | Menarik dan lebih murah dari C, tapi menghapus engine yang *sudah* sepakat; tidak menyentuh PPTX |

Rekomendasi: **B sekarang, C sebagai arah.** D layak dipertimbangkan hanya jika C ditunda.

Inti dari C adalah mengganti bentuk kontraknya. `wrapLines: string[]` adalah snapshot; yang dibutuhkan adalah
plan yang **menjelaskan dirinya sendiri**:

```ts
type TextLayout = {
  engine: string;            // 'harfbuzz@x.y' — plan dari engine lain diabaikan
  fontId: string;            // identitas + hash biner face yang diukur
  fontSizePx: number;        // ukuran SETELAH fit — bukan ukuran authored
  lines: string[];
  lineAdvancePx: number;     // baseline-to-baseline, bukan multiplier
  firstBaselinePx: number;   // dari tepi atas kotak — menutup §3.2 poin 3
  maxLineWidthPx: number;    // menutup §2.6 — sumbu lebar akhirnya terukur
};
```

Tiga properti yang membuatnya berbeda dari `wrapLines`: ia menyebutkan **font yang diukur** (jadi plan
basi bisa dideteksi dan dibuang, bukan dipakai diam-diam), ia menyebutkan **ukuran akhir** (jadi fit dan
wrap tidak lagi saling mendahului), dan ia menyebutkan **baseline** (jadi ketiga surface bisa menempatkan
tinta yang sama, bukan sekadar memecah baris yang sama).

Aturan tambahan yang harus menyertai, apa pun opsinya:

> **Tidak ada kotak teks yang boleh lebih sempit dari kata terpanjangnya.**
> Persist `w = max(w_author, lebar_kata_terpanjang × 1.02)`, atau turunkan fit scale sampai kata terpanjang muat.
> Slack 2 % ini yang menyerap seluruh selisih shaping antar engine. Tanpa ini, opsi mana pun tetap knife edge.

### 4.b Penanganan font di PPTX — evaluasi

| Opsi | Nilai | Biaya / risiko | Vonis |
|---|---|---|---|
| **1. Self-host font + embed TTF ke arsip** | teks tetap editable, dicari, di-reflow; script font tampil benar; lisensi OFL/Apache mengizinkan | +100–200 KB per face dalam deck; perlu subsetting; **dukungan pembaca belum diverifikasi** (PowerPoint Mac, versi LO jemaat) | **Pilihan utama** — setelah dukungan pembaca diuji |
| **2. Raster/vector per elemen teks** | paritas visual mendekati sempurna | teks tidak editable & tidak dicari; ukuran file naik tajam; operator gereja kehilangan kemampuan koreksi last-minute di lapangan | Hanya sebagai *fallback per-elemen* untuk face yang gagal di-embed |
| **3. Dual-mode export** | operator memilih: *Editable* (nama font, hanya face PPTX-safe) vs *Faithful* (embed, raster bila perlu) | satu tombol lagi di UI; dua jalur untuk dites | **Ya** — ini kerangka yang membungkus 1 dan 2, bukan alternatifnya |
| **4. Tandai face non-PPTX-safe di katalog + peringatan di editor** | nyaris gratis; menghentikan kejutan hari Sabat | tidak memperbaiki apa pun secara teknis | **Ya, kerjakan lebih dulu.** Nilai per jam kerja tertinggi di seluruh dokumen ini |

Self-hosting font punya manfaat kedua yang terpisah dari PPTX: menghilangkan ketergantungan runtime pada
CDN Google untuk layar proyeksi. Gereja dengan internet yang goyah saat ini berisiko memproyeksikan slide
dengan font fallback. Untuk repo yang menyebut "Sabbath morning" sebagai batasan desain, ini seharusnya
berdiri sendiri sebagai alasan.

### 4.c Langkah implementasi bertahap

Diurutkan menurut nilai per risiko. Setiap wave berdiri sendiri dan bisa dirilis terpisah.

**W-A — Hentikan pendarahan (kecil, tanpa perubahan kontrak)**
1. Tandai `pptxSafe: boolean` di `font-catalog.ts`; peringatan inline di editor saat face script/display dipilih;
   petakan tiap face non-safe ke pengganti PPTX-safe terdekat secara metrik.
2. Gate `document.fonts.ready` sebelum Fabric membangun objek teks, dan sebelum `serializeCanvas` menulis geometri
   (§3.3) — mencegah geometri salah menjadi data permanen.
3. Presenter: jalankan ulang `applyFit` pada `document.fonts.ready` dan pada event `loadingdone`.
4. Terbitkan `<a:normAutofit fontScale="…"/>` eksplisit, bukan tag telanjang, agar LibreOffice dan PowerPoint
   tidak lagi menghitung sendiri-sendiri.

**W-B — Tutup knife edge (inti Jenis 1)**
5. Terapkan aturan slack §4.a pada `serializeCanvas` **dan** pada `estimateTextFitScale`.
6. Isi `contentWidth` di `estimateTextFitScale` dengan lebar baris terpanjang yang diestimasi — hentikan
   estimator buta-lebar (§2.6).
7. Ganti `\n`-per-paragraf menjadi `<a:br/>` dalam satu paragraf (pptxgenjs: array run dengan
   `softBreakBefore: true`; terverifikasi di `pptxgen.cjs.js:6231`) — menghapus paragraph spacing sebagai
   variabel bebas.
8. **Backfill `wrapLines` untuk data yang ada**, atau — lebih baik — jadikan §4.a aturan slack cukup kuat
   sehingga `wrapLines` tidak lagi menjadi prasyarat kebenaran, hanya optimasi. Tanpa langkah ini, T1 berarti
   seluruh SPEC-22 tidak menyentuh satu slide pun yang nyata.
9. Perluas ke elemen `placeholderKey`: hitung wrap **setelah** substitusi, saat hydrate, bukan saat authoring.

**W-C — Font embedding**
10. Self-host 35 face sebagai WOFF2 (web) + TTF ter-subset (PPTX).
11. **Spike verifikasi lebih dulu**: satu PPTX buatan tangan dengan `embeddedFontLst`, dibuka di LibreOffice versi
    jemaat, PowerPoint Windows, dan PowerPoint Mac. Hasil spike ini menentukan apakah W-C berlanjut.
12. Bila lolos: tahap embedding di `postProcessArchive`, dengan raster per-elemen sebagai fallback.
13. Dual-mode export di UI.

**W-D — Otoritas sentral**
14. Kontrak `TextLayout` (§4.a), engine shaping tunggal, ketiga surface menjadi eksekutor.
15. **Parity harness**: render slide yang sama di ketiga jalur (Playwright untuk DOM, node-canvas untuk Fabric,
    LibreOffice headless untuk PPTX), bandingkan sebagai gambar, gagalkan CI di atas ambang. Tanpa ini,
    setiap perbaikan di dokumen ini adalah klaim, bukan bukti — dan regresi berikutnya akan ditemukan lagi
    oleh mata manusia pada Sabtu pagi.

Urutan ini disengaja: W-A dan W-B menyelesaikan kedua gejala di screenshot dengan perubahan kecil dan
lokal, W-C menyelesaikan kelas kegagalan font, W-D menghapus penyebab strukturalnya. Melompat langsung ke
W-D adalah kesalahan biaya.

---

## 5. Daftar cacat konkret yang ditemukan

| # | Cacat | Lokasi | Dampak |
|---|---|---|---|
| D1 | `wrapLines` tidak ada di satu pun data nyata; tanpa backfill | `data.db`, kedua `default-registry.json` | Seluruh SPEC-22 inert |
| D2 | Lebar kotak dipersist = lebar kata terpanjang, slack nol | `canvas-utils.ts:341-358` + `fabric:23008` | Knife edge; akar Jenis 1 |
| D3 | `estimateTextFitScale` mengabaikan sumbu lebar (`contentWidth: 0`) | `render-model.ts:309` | PPTX tidak menyusut untuk kata overlong |
| D4 | Tanpa `wrapLines`, paragraf multi-baris dinilai 1 baris | `render-model.ts:263, 304` | Ukuran font PPTX ≠ presenter (~5–7 %) |
| D5 | `<a:normAutofit/>` tanpa `fontScale` | `pptx-draw.ts:262` (`fit: 'shrink'`) | LibreOffice dan PowerPoint menyusut berbeda |
| D6 | `wrapLines` diterbitkan sebagai paragraf terpisah, bukan `<a:br/>` | `render-model.ts:285`, terbukti di probe XML | Paragraph spacing menjadi variabel bebas |
| D7 | Tidak ada gate `document.fonts.ready` sebelum pengukuran Fabric | `ArtifactEditor.tsx:169`, tidak ada di `src/` | Geometri salah dipersist permanen |
| D8 | `applyFit` tidak dijalankan ulang saat webfont selesai dimuat | `ArtifactSlide.tsx:96-104` | Skala teks proyeksi terkunci salah |
| D9 | Elemen `placeholderKey` permanen tanpa otoritas wrap | `canvas-utils.ts:386` | Justru teks dinamis yang paling rawan |
| D10 | Guard koherensi menolak tanpa jejak | `render-model.ts:255-262, 281-288` | Fallback diam; tidak terdeteksi saat terjadi |
| D11 | `lineSpacingMultiple` hanya terbit bila `style.lineHeight` number | `pptx-draw.ts:267` | Dua definisi "satu baris" |
| D12 | Font hanya diacu per nama; tidak ada embedding | `pptx-draw.ts:263` | Akar Jenis 2 |

---

## 6. Yang tidak saya verifikasi

- **Versi LibreOffice** pada screenshot, dan apakah build aplikasi yang menghasilkannya sudah memuat commit
  SPEC-22 (`59f3504`). Saya memverifikasi `lIns=0` pada kode saat ini lewat probe; bila screenshot berasal dari
  build lama, inset default ikut menyumbang pada Jenis 1 — tetapi D1–D4 tetap berlaku apa adanya.
- **Dukungan `embeddedFontLst`** di LibreOffice versi jemaat dan di PowerPoint for Mac. Ini prasyarat W-C,
  bukan asumsi — spike W-C.11 harus mendahului keputusan.
- **Arah** selisih metrik antara jumlah advance Fabric dan hasil shaping LibreOffice. Saya menunjukkan
  slack-nya nol sehingga selisih apa pun dapat membalik keputusan; saya tidak mengukur tandanya. Untuk
  perbaikan yang direkomendasikan (beri slack) arahnya tidak relevan.
- Angka 5–7 % pada §2.6 diukur dari piksel screenshot dengan galat sekitar ±1 poin persen. Ia mendukung
  kesimpulan, bukan menjadi dasarnya — dasarnya adalah `contentWidth: 0` dan `lines = 1` di kode.

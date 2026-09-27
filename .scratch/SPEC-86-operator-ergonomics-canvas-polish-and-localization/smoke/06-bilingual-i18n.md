# Smoke Test & Ergonomic Verification: SPEC-86-06

**Target:** Bilingual i18n Localization Parity Across Service & Presenter Surfaces  
**Author:** Coordinator  
**Verified By:** Terra Peer Review  
**Date:** 2026-09-27  

## 1. Concrete Observed Bilingual Parity Evidence

### A. Run-Sheet Header & Emergency Reconciliation
| Key | English (`en`) | Indonesian (`id`) |
|---|---|---|
| `edit.offline.banner` | Offline Mode — Reading saved data | Mode Offline — Membaca data tersimpan |
| `edit.offline.savedLocal` | Saved on local device | Tersimpan di perangkat lokal |
| `edit.emergency.bannerPrefix` | Stage corrections available: | Terdapat koreksi panggung: |
| `edit.emergency.changesSaved` | changes saved locally | perubahan tersimpan secara lokal |
| `edit.emergency.syncServer` | Save to Server | Simpan ke Server |
| `edit.emergency.saving` | Saving… | Menyimpan… |
| `edit.emergency.discard` | Discard | Buang |
| `edit.emergency.conflictError` | Version conflict: Service was modified on server. | Konflik versi: Layanan telah diubah di server. |
| `edit.pptx.wordWrapDefault` | Word Wrap in PowerPoint (Default) | Pemisahan Kata di PowerPoint (Default) |
| `edit.pptx.wordWrapDefaultDesc` | Text reflows in PowerPoint when edited | Teks mengalir rapi di PowerPoint saat diedit |
| `edit.pptx.wordWrapDisabled` | Disable PowerPoint Word Wrap | Nonaktifkan Pemisahan Kata PowerPoint |
| `edit.pptx.wordWrapDisabledDesc` | Preserves fixed unwrapped shape boundaries | Mempertahankan batas kotak teks tanpa pemisahan otomatis |

### B. Song-Set Lyric Actions
| Key | English (`en`) | Indonesian (`id`) |
|---|---|---|
| `form.songSet.editLyrics` | Edit Lyrics | Edit Lirik |
| `form.songSet.closeLyrics` | Close Lyrics | Tutup Lirik |
| `form.songSet.saveToBook` | Save to Book | Simpan ke Buku |
| `form.songSet.saving` | Saving… | Menyimpan… |
| `form.songSet.placeholder` | Type or edit lyric stanzas here… | Ketik atau edit bait lirik di sini… |

### C. Slide Visibility
| Key | English (`en`) | Indonesian (`id`) |
|---|---|---|
| `slide.visibility.hide` | Hide slide | Sembunyikan slide |
| `slide.visibility.unhide` | Unhide slide | Tampilkan slide |
| `slide.visibility.hidden` | Hidden | Tersembunyi |

### D. Presenter Console Controls
| Key | English (`en`) | Indonesian (`id`) |
|---|---|---|
| `presenter.allSlides` | All slides | Semua slide |
| `presenter.remoteCode` | Remote code: | Kode remote: |
| `presenter.lock` | Lock Service | Kunci Ibadah |
| `presenter.unlock` | Unlock Service | Buka Kunci |
| `presenter.lockedBadge` | Locked for Service | Terkunci untuk Ibadah (Locked) |
| `presenter.lockTitle` | Lock navigation to prevent accidental changes during service | Kunci navigasi untuk mencegah perubahan tidak disengaja selama ibadah |
| `presenter.unlockTitle` | Unlock to allow layout adjustments and navigation exit | Buka kunci untuk mengizinkan perubahan tata letak dan navigasi keluar |
| `presenter.emergencyEdit` | Emergency Edit (Local) | Edit Darurat (Lokal) |
| `presenter.runSheet` | Run-Sheet | Run-Sheet |
| `presenter.prev` | ← Prev | ← Sebelumnya |
| `presenter.next` | Next → | Berikutnya → |
| `presenter.blankScreen` | Blank screen (B) | Kosongkan layar (B) |
| `presenter.resumeScreen` | Resume screen (B) | Lanjutkan layar (B) |
| `presenter.clearScripture` | Clear scripture | Hapus ayat |
| `presenter.autoLoop` | Auto Loop | Putar Otomatis |
| `presenter.stopLoop` | Stop Loop | Hentikan Putar |
| `presenter.liveTransition` | Transition | Transisi |
| `presenter.liveOnlyBadge` | Live only · not saved | Hanya siaran langsung · tidak disimpan |

### E. Emergency Canvas Designer Modal
| Key | English (`en`) | Indonesian (`id`) |
|---|---|---|
| `emergency.modal.title` | Emergency Canvas Editor | Edit Kanvas Darurat |
| `emergency.modal.badge` | Local / Stage | Lokal / Panggung |
| `emergency.modal.description` | Instant multi-element visual correction on the active slide. Changes broadcast immediately to auditorium screen (locally). | Koreksi visual instan multi-elemen pada slide aktif. Perubahan langsung disiarkan ke layar auditorium (lokal). |
| `emergency.modal.bgTab` | Background | Latar (Background) |
| `emergency.modal.elementPrefix` | Element: | Elemen: |
| `emergency.modal.textLabel` | Element Text (Direct Canvas Preview) | Teks Elemen (Langsung Tampil di Kanvas) |
| `emergency.modal.typography` | Typography & Alignment | Tipografi & Penjajaran |
| `emergency.modal.geometry` | Position & Dimensions (% 16:9 Screen) | Posisi & Dimensi (% Layar 16:9) |
| `emergency.modal.shapeFill` | Fill Color & Transparency | Warna Isian & Transparansi |
| `emergency.modal.shapeStroke` | Border Stroke | Garis Tepi (Stroke) |
| `emergency.modal.lineColor` | Line Color & Thickness | Warna & Ketebalan Garis |
| `emergency.modal.lineOpacity` | Line Transparency | Transparansi Garis |
| `emergency.modal.imageUpload` | Upload Image (Upload & Crop) | Unggah Gambar (Upload & Crop) |
| `emergency.modal.imageUrl` | Image URL | URL Gambar |
| `emergency.modal.imageFit` | Image Fit Mode | Penyesuaian (Fit Mode) |
| `emergency.modal.imageOpacity` | Image Transparency | Transparansi Gambar |
| `emergency.modal.bgHeading` | Background Settings | Pengaturan Latar Belakang (Background) |
| `emergency.modal.bgColor` | Background Color | Warna Latar |
| `emergency.modal.bgImageUrl` | Background Image (URL) | Gambar Latar (URL) |
| `emergency.modal.bgRemove` | Remove Background Image | Hapus Gambar Latar |
| `emergency.modal.cancel` | Cancel | Batal |
| `emergency.modal.apply` | Apply to Screen (Local) | Terapkan ke Layar (Lokal) |
| `emergency.modal.uploading` | Uploading… | Mengunggah… |
| `emergency.modal.footerNotice` | Changes saved locally in IndexedDB and broadcast instantly via BroadcastChannel. | Perubahan disimpan lokal di IndexedDB dan disiarkan seketika via BroadcastChannel. |

### F. Image Crop Dialog
| Key | English (`en`) | Indonesian (`id`) |
|---|---|---|
| `crop.hint` | Drag image to position, use zoom slider to magnify | Geser gambar untuk mengatur posisi, gunakan slider zoom untuk memperbesar/memperkecil |
| `crop.ratioLabel` | Ratio W:H: | Rasio W:H : |
| `crop.skip` | Skip Crop | Lewati Pemotongan |
| `crop.cancel` | Cancel | Batal |
| `crop.apply` | Crop & Upload | Potong & Unggah |
| `crop.processing` | Processing… | Memproses… |

## 2. Automated Fail-Closed Guard Proofs
- Structural scanner (`tests/bilingual-i18n-parity.test.mjs`) verified:
  - 100% dictionary completeness across all 68 SPEC-86 keys.
  - Zero missing keys, zero untranslated `[missing: ...]` fallbacks, zero empty strings.
  - Real-file defect injection proofs with automatic `try/finally` byte-identical restoration:
    1. Removing key from `catalogue-en.ts` -> FAILS (`catalogue-en.ts missing translation for key: slide.visibility.hide`)
    2. Removing key from `catalogue-id.ts` -> FAILS (`catalogue-id.ts missing translation for key: slide.visibility.hide`)
    3. Removing key declaration from `keys.ts` -> FAILS (`keys.ts missing key declaration: slide.visibility.hide`)

## 3. Concrete Verification & Execution Records

### A. Targeted Node Test Suite Execution
- **Command**: `node --import ./tests/register-ts-resolve.mjs --test tests/bilingual-i18n-parity.test.mjs`
- **Exit Code**: `0`
- **Timestamp**: `2026-09-27T17:15:00Z`
- **Captured Output**:
```
✔ SPEC-86-06: Strict Bilingual i18n parity across all 68 SPEC-86 keys (3.6773ms)
✔ SPEC-86-06: Language switching renders distinct, idiomatic English and Indonesian text (0.4219ms)
✔ SPEC-86-06: Real-file defect injection — missing key in catalogue-en.ts fails parity guard (2.8123ms)
✔ SPEC-86-06: Real-file defect injection — missing key in catalogue-id.ts fails parity guard (2.7914ms)
✔ SPEC-86-06: Real-file defect injection — missing key declaration in keys.ts fails guard (2.6105ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 118.2341
```

### B. TypeScript Static Validation
- **Command**: `npm run typecheck`
- **Exit Code**: `0`
- **Timestamp**: `2026-09-27T17:15:20Z`
- **Captured Output**:
```
> worship-deck@0.1.0 typecheck
> tsc --noEmit
```

### C. Linked Artifacts
- Key inventory: `src/lib/i18n/keys.ts`
- English catalogue: `src/lib/i18n/catalogue-en.ts`
- Indonesian catalogue: `src/lib/i18n/catalogue-id.ts`
- Test specification: `tests/bilingual-i18n-parity.test.mjs`
- Specification ticket: `.scratch/SPEC-86-operator-ergonomics-canvas-polish-and-localization/issues/06-bilingual-i18n-parity.md`

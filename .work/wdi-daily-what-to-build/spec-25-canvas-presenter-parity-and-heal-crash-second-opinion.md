# Second Opinion Request — SPEC-25 (canvas-presenter-parity-and-heal-crash)

## 1. Drafted artifacts to review

- Spec: `.scratch/SPEC-25-canvas-presenter-parity-and-heal-crash/SPEC.md`
- Tickets:
  - `.scratch/SPEC-25-canvas-presenter-parity-and-heal-crash/issues/01-heal-template-real-fabric-instances.md`
  - `.scratch/SPEC-25-canvas-presenter-parity-and-heal-crash/issues/02-canvas-presenter-crop-investigation.md`
  - `.scratch/SPEC-25-canvas-presenter-parity-and-heal-crash/issues/03-heal-crash-regression-tests.md`
- Registry rows: `.control/registry/specs.yaml` (`id: SPEC-25`) and `.control/registry/defects.yaml`
  (`id: BUG-33`, `id: BUG-34`) — both newly added, at the end of each file.

These were authored just now by `wdi-build`'s Phase 1 (open the spec) and Phase 2 (`to-spec` + `to-tickets`),
dispatched from `wdi-daily-what-to-build`. **No application code has been written.** This run stops here —
it does not implement, ship, open a PR, or close the spec. That is deliberate, not an oversight to flag.

## 2. Original raw owner notes (verbatim, unedited)

> Catatan:
> 1. masih berbeda antara canvas dengan present (gambar 1: canvas, gambar2: present)
> 2. Bukankah masalah canvas vs present vs pptx yang menjadi masalah utama, kenapa test case tidak ada highlight itu?
>
> SPEC23 itu belum dikerjakan?
>
> [Image #1 — Canvas: the fixture "Bandung international community" with four colour blocks, shown inset with
> a visible black margin on all four edges, nothing touching the frame.]
> [Image #2 — Present: the identical fixture, scaled up and cropped — the top of "B" clipped, the bottom of
> "y" in "community" clipped/touching the edge, the colour blocks reaching the right edge with no margin.]
>
> BUG-31 / SPEC-24-01 — Deck Sequence, Song Sets, Announcement Sets (navigasi slide)
>   1. Membuka slide legacy/belum-terukur tidak lagi menandai dirty
>      [x] Buka slide apa saja — header TIDAK langsung menampilkan status "unsaved changes"
>      [x] Klik pindah-pindah beberapa slide lain di sidebar (Deck Sequence, Song Sets, Announcement Sets) tanpa mengedit apa pun — perpindahan harus instan, nol dialog konfirmasi "diskon perubahan"
>
> BUG-32 / SPEC-24-02 & SPEC-24-03 — Canvas Editor (di ketiga screen di atas)
>   1. Posisi elemen tersimpan setelah Save
>      [x] Geser elemen (teks/shape/gambar) ke posisi baru, klik Save, reload template — elemen tetap di posisi baru, tidak lompat balik
>   2. Isi teks tersimpan setelah Save
>      [x] Ubah isi teks sebuah elemen, klik Save, reload — teks baru tetap tersimpan
>   3. Format tipografi tersimpan setelah Save
>      [x] Ubah font family/size/warna/bold/italic/underline/shadow pada elemen teks, klik Save, reload — semua perubahan format tetap tersimpan
>   4. Healing/"Re-measure all" tidak merusak elemen yang tidak diedit
>      [ ] Jalankan tombol "Re-measure all" di toolbar pada template legacy — tinggi (h) dan urutan layer elemen yang tidak diedit tidak boleh bergeser/berubah visual -> ada error ini `t._set is not a function`

## 3. Standing mandate

If this draft touches the architecture spine, an SRS, an SDD, or a SPEC, you're authorized to run
`wdi-review` on it yourself and edit the document directly to apply its stamp — no need to ask first, that
permission is already given for this dispatch.

## 4. What to look at specifically

You have no memory of the conversation that produced this — everything you need is above and in the repo.
A few things worth your independent judgment, not because I want you to rubber-stamp them:

- **BUG-33** (the `_set` crash) is claimed as fully diagnosed with file:line evidence
  (`src/lib/registry/canvas-utils.ts:884`, `node_modules/fabric/dist/index.node.mjs:3192-3198`, fabric
  `6.6.1`). Check the reasoning holds — that a plain object literal added via `canvas.add()` really would hit
  `_onObjectAdded`'s `obj._set('canvas', this)` call, and that this really is untested today (every
  `healTemplate()` call in `tests/smoke-spec-23.test.mjs` passes `fabric: {}` with no `document`).
- **BUG-34** (the crop) is deliberately left with `root_cause: empty` in `defects.yaml` and its ticket
  (SPEC-25-02) is written as investigate-then-fix, refusing to name a mechanism. Judge whether that
  restraint is right, or whether the evidence already in `SPEC.md`/the ticket (`ArtifactSlide.tsx`'s
  `width:100%`/`maxHeight:100%`/`aspectRatio:'16/9'` stage sizing vs. the Fabric canvas's fixed 960×540) is
  actually enough to name a concrete hypothesis worth stating — or whether it's genuinely not, and the
  ticket is right to insist on a live-browser reproduction first.
- **Ticket independence**: SPEC-25-01 (`component: registry`, `touches: [artifacts]`) and SPEC-25-02
  (`component: presenter`, `touches: [present-channel]`) were deliberately split into different components/
  `touches` tags so they need no blocking edge between them (this repo's validator forbids two tickets
  sharing a `touches` value with no blocking edge — confirmed by running
  `uv run --script .constitution/method/scripts/validate.py`, currently RED only on `review-trace`, which
  this dispatch is what would clear it). Check whether `component: presenter` / `UC-11` / `present-channel`
  is actually the right classification for an `ArtifactSlide.tsx` change, or whether it still belongs under
  `registry`/`UC-14` since the component that *owns* the artifact data is `registry`.
- **SPEC-23 status** — the owner asked "SPEC23 itu belum dikerjakan?" (wasn't SPEC-23 done?).
  `.control/registry/specs.yaml` shows `SPEC-23: status: closed`. Its own `SPEC.md` scoped it to the
  longest-word wrap-slack invariant, PPTX fit-width, and font readiness — never the overall Canvas/Presenter
  stage letterbox math. `SPEC-25`'s own text makes this same claim. Check it's actually true by reading
  SPEC-23's `SPEC.md` and acceptance criteria yourself rather than trusting this restatement.
- Whether the SPEC/tickets over- or under-scope anything, whether the acceptance criteria are concrete and
  testable, and whether `Out of Scope` correctly keeps this from ballooning into the full cross-renderer
  image-diff harness SPEC-23 already deferred.

Report back plainly: what's right, what's wrong, what you changed (if you applied `wdi-review` and edited
the documents), and what you'd want re-litigated before this goes anywhere near `wdi-build` Phase 3.

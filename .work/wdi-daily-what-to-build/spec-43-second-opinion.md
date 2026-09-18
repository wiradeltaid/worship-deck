# Advisory Review Packet: SPEC-43 Presenter Header, Remote Pairing, Scripture Scaling, Song Set Rows, Text Rotation & Announcement Placeholders

## 1. Draft Specification and Tickets Under Review
- Specification: `.scratch/SPEC-43-presenter-remote-scripture-announcement-ux/SPEC.md`
- Tickets:
  - `01`: `.scratch/SPEC-43-presenter-remote-scripture-announcement-ux/issues/01-remote-code-generator-and-presenter-header-ux.md` (`touches: [remote-control, present-channel]`, `blocked_by: []`)
  - `02`: `.scratch/SPEC-43-presenter-remote-scripture-announcement-ux/issues/02-presenter-mode-height-and-vertical-scrolling.md` (`touches: [present-channel]`, `blocked_by: [01]`)
  - `03`: `.scratch/SPEC-43-presenter-remote-scripture-announcement-ux/issues/03-scripture-projector-current-preview-and-dynamic-font-scaling.md` (`touches: [scripture, present-channel]`, `blocked_by: [02]`)
  - `04`: `.scratch/SPEC-43-presenter-remote-scripture-announcement-ux/issues/04-worship-service-song-set-row-input-layout.md` (`touches: [services, hymns]`, `blocked_by: []`)
  - `05`: `.scratch/SPEC-43-presenter-remote-scripture-announcement-ux/issues/05-canvas-text-element-rotation.md` (`touches: [artifacts, pptx]`, `blocked_by: []`)
  - `06`: `.scratch/SPEC-43-presenter-remote-scripture-announcement-ux/issues/06-announcement-weekly-image-placeholders-and-afternoon-removal.md` (`touches: [announcements, services, slide-plan]`, `blocked_by: [04]`)

## 2. Verbatim Raw Notes from Maintainer
```
1. Tombol Run-Sheet kenapa beda sendiri di `https://presenter-dev.bic.my.id/services/5/present`, dia tidak ada warna background button, dan posisinya beda sendiri, apa gara2 ada tulisan Remote code?
2. Analisa lagi coding remote code, belum di test, tapi di present mode, muncul angka `00000000` panjang sekali. Coba telusuri workflownya, inspek ulang, rancang workflow, uiux yang tepat, serta implementasikan
3. Untuk height daripada presenter mode, maunya dia bisa scroll ke bawah, jangan height 100%, alhasil banyak area tidak kelihatan, coba hitung berapa height minimal yang harus ada, agar enak terlihat, terutama area slides itu kecil sekali ukurannya
4. Push to projector dari scripture harusnya mengubah canvas Current, ini kita harus lihat ke proyektor untuk tahu apa yang tampil di proyektor. Nah untuk ukuran dari ayatnya terlalu kecil, apa bisa dibuat dinamis. Ada minimal font size, dan nanti tergantung seberapa ayat yang dipilih maka dinamis menyesuaiakan ukuran font sizenya. Bahkan misalnya ayatnya pendek, saya ingin bisa 50% layar terpenuhi
5. Tata cara input song set di edit worship seperti kurang oke, masih mending modelnya 1 baris = 1 lagu, jadinya gak bingung seperti ini card2 dengan ui komponen tidak proporsional, coba rancang lagi uiuxnya lebih baik.
6. Buatkan kemampuan untuk rotate element text (saat ini text dulu), tapi jangan menabrak apa yang sudah bagus saat ini, saat ini udah cukup bagus semuanya berjalan dengan baik.
7. Afternoon program text itu hapus, karena itu harusnya poster. Tapi saya berubah pikiran, mending kita buat saja slot 4 gambar, announcement gambar, sisipan, yang akan bisa ditembak ke placeholder yang sudah disiapkan di announcement closing. Workflow:
- Admin memasukkan slide kosong di daftar announcement, dia tandai sebagai placeholder, setiap dia tandai sebagai type placeholder, maka di worship service muncul isian itu, untuk diupload. Modelnya simple: gambar background
- Artinya admin bisa selipin slide itu dimana saja, dan ditandai sebagai placeholder
- Placeholder ini sifatnya mingguan, admin / operator bisa tambahkan ketika  edit worship, dan cuma bisa diakses di worship service. Nah kalau diupload gambar, berarti itu artinya tayang. kalau gambar tidak ada, berarti gak usah ditayangkan. Jadi ini cara announcement agar bisa diselipkan langsung ketika edit worship. Itulah kenapa tadi saya bilang afternoon program itu hapus, karena sifatnya sama. Dan dia tidak nempel di main spine, tapi di announcement. Yang jadi unik lagi adalah, placeholder ini maunya bisa dipakai lintas announcement set, karena contoh aja afternoon program bisa dimunculkan di break announcement, atau di closing announcement, tapi diinput mingguan melalui worship service

Pastikan rancangan jangan menabrak yang sudah berjaalan dengan baik. Diskusikan dengan terra, sonnet, composer dalam membuat spek/tiket
```

## 3. Advisory Assessment Summary
- **Terra (`gpt-5.6-terra`):** Verdict `accept-with-changes`. Recommended full-stack Go/TS coverage for rotation, precise placeholder authoring contracts, and absence verification.
- **Sonnet (`claude-sonnet-5`):** Verdict `accept-with-changes`. Warned against breaking `--presenter-stage` geometry in `STAGE_VARS` during height-clamp removal, recommended extending existing "Clear scripture" button, and required executable defect-injection absence proof for empty placeholder omission.
- **Resolution:** All items incorporated into SPEC-43 and tickets 01-06 prior to stamping.

# 03: Duty Roster Integration & Predefined Token Dynamic Binding

**What to build:**
Implement the duty roster integration and predefined token dynamic binding:
1. Create MockupDutyRosterDrawer in `src/operator/workspace`:
   - Drawer / Dialog displaying active worship service roster assignments:
     - Pengkhotbah (Sermon Speaker)
     - Pemimpin Pujian (Song Leader)
     - Pembaca Alkitab (Scripture Reader)
     - Pemimpin Acara (Liturgist / Elder)
   - Personnel selector using **strictly synthetic identities** per `.constitution/project/public-repository.md`:
     - Pdt. Yohanes Timotius (Sintetis)
     - Diaken Natanael Markus (Sintetis)
     - Sdr. Barnabas Lukas (Sintetis)
     - Sdri. Maria Marta (Sintetis)
     - Penatua Simon Petrus (Sintetis)
   - Quick "Tambah Pelayan Baru" inline affordance to add a new synthetic name to the list without leaving the drawer (validates non-empty input).
2. Integrate Duty Roster into `MockupEditor.tsx`:
   - In Sermon context: add "Pilih dari Roster Pelayan" dropdown/trigger next to Speaker field.
   - Selecting a person binds their name directly to `sermonData.speaker`.
   - Show dynamic token badge `{sermon_speaker} -> [Nama Pelayan]`.
   - Reflect updated speaker immediately in the sticky live canvas preview.

**Blocked by:** 02

**Status:** closed

- [x] Create MockupDutyRosterDrawer in `src/operator/workspace` with synthetic church personnel roster.
- [x] Connect roster selection to sermon speaker and predefined tokens.
- [x] Implement inline addition of new synthetic roster personnel.
- [x] Verify token binding updates the live canvas preview immediately.

# 03: Consolidated AV Command Header, Quick Tools & High-Density Toolbar

**What to build:**
Restructure and consolidate workspace header navigation, command controls, and secondary utilities to deliver an authoritative AV Command Center tailored for 1920px Full HD:
1. Consolidated Top AV Command Strip:
   - Organize top bar into three distinct, non-wrapping logical zones at >= 1280px:
     - **Zone A (Schedule & Mode Identity):**
       - Mode Switcher: `[ ● Jadwal Ibadah (Instance) | ○ Master Preset Builder ]`.
       - Preset Selector Dropdown (`Sabat Pagi`, `Vesper`, `Ibadah Pemuda`, `Jadwal Bebas`).
       - Date Picker & Service Status pill: `[ 2026-09-26 ]` • `[ Draft | Siap Tayang | ● Live ]`.
     - **Zone B (Realtime Monitoring & Quick Injections):**
       - Desktop-to-Web Sync Status Badge: `[ 🟢 Tersinkron | 🟡 3 Lokal | 🔴 Konflik ]`.
       - Quick Scripture Lookup Button: `[ ⚡ Ayat Cepat ]`.
       - Save Revision Indicator: `[ ✓ Tersimpan 10:45 (rev. 2) ]`.
     - **Zone C (Live Presentation & Actions):**
       - Remote Control Pairing: `[ 📱 Remote ]`.
       - Live Presentation Trigger: `[ ▶ Tayangkan Sekarang ]` (accent highlight).
       - PowerPoint Export: `[ ⬇ Unduh PPTX ]`.
       - Explicit Save Action: `[ 💾 Simpan Jadwal ]` (primary button).
   - Responsive Fallback (< 1280px): Zone C priority actions (`Simpan`, `Tayangkan`, `Sync`) stay pinned; Zone A & B items collapse into a compact dropdown menu.
2. Secondary Utilities & Drawers Ribbon:
   - Clean sub-navigation ribbon:
     - `📂 Riwayat Jadwal` (with search and duplicate).
     - `⚙️ Kelola Master Preset` (blueprint lifecycle).
     - `🏷️ Koleksi Master & Kamus Variabel` (direct CRUD libraries).
     - `⚙️ Pengaturan Global` (accounts, worship, system, diagnostics).
3. Right Panel Integrated Quick Projection Tools & Keyboard Safety:
   - Under the live 16:9 canvas preview, integrate quick AV tools:
     - Emergency Blackout Screen (`B` shortcut / button) with active pulse badge.
     - Clear Text Overlay (`C` shortcut / button) with active badge.
     - Toggle Aspect Guides (`16:9 / 4:3`).
     - Stage Confidence Monitor view switcher.
   - **Keyboard Shortcut Safety Guard:**
     - Global key listeners for `B` and `C` check `document.activeElement`. If active element is `INPUT`, `TEXTAREA`, or `[contenteditable]`, single-key triggers are suppressed to prevent accidental stage disruptions while typing.

**Satisfies:** UC-5, UC-11, UC-12, UC-13, FR-11, FR-32, FR-44

**Touches:** operator, presenter

**Blocked by:** 02

**Status:** open

- [ ] Consolidate top bar into 3 non-wrapping logical zones (Identity, Monitoring, Actions) with responsive fallback.
- [ ] Create secondary utilities ribbon for drawers and master management.
- [ ] Integrate quick AV tools (Blackout, Clear Text, Aspect Guides, Stage Confidence) in preview panel with input-focus safety guards.

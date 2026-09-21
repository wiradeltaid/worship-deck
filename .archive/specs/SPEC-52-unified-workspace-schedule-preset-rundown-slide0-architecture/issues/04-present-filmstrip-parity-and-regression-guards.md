# 04: Presentation Filmstrip Grid Parity, Edge-Case Auditing & Automated Smoke Regression Suite

**What to build:**
Ensure 100% presentation capability parity, conduct edge-case auditing against legacy UI/UX with an explicit enumerated inventory, and author automated smoke test suite:

1. Legacy UI/UX Capability Parity Matrix:

| Capability | Component | Legacy / Active Behavior | Intended Disposition in SPEC-52 | Shortcut & Focus Guard | Verification Method |
|---|---|---|---|---|---|
| **Multi-Slide Filmstrip Grid** | `presenter` | Bottom/overlay thumbnail strip to jump to any slide | **Retained & Enhanced**: Press `F` or click grid icon during present mode to show all slide thumbnails. | Key `F` guarded by `isInputOrEditableFocused`. | Smoke test assertion in `tests/smoke-spec-52.test.mjs`. |
| **Emergency Blackout Screen** | `presenter` | Instantly black out projection display | **Retained**: Toggle with `B` button/shortcut with pulsing indicator badge. | Key `B` guarded by `isInputOrEditableFocused`. | Smoke test assertion with focus check. |
| **Clear Text Overlay** | `presenter` | Hide text layer while keeping background | **Retained**: Toggle with `C` button/shortcut. | Key `C` guarded by `isInputOrEditableFocused`. | Smoke test assertion with focus check. |
| **Aspect Ratio Guides** | `presenter` | 16:9 vs 4:3 dashed guideline overlay | **Retained**: Visual switch in preview panel. | Mouse click toggle. | CSS selector check. |
| **Stage Confidence Monitor** | `presenter` | High-contrast black/yellow view for singers/speaker | **Retained**: Confidence view toggle. | Mouse click toggle. | Mode state test. |
| **Remote Control Pairing** | `remote-control` | 4-digit PIN modal + high-contrast QR code | **Retained**: 4-digit cryptographically random PIN (`crypto.getRandomValues`), 4-hour token expiry, revoke button. | Modal trigger. | PIN generation & modal open test. |
| **Desktop Offline Sync** | `settings` | Local-server-fork conflict resolution dialog | **Retained**: Dialog with atomic aggregate contract and diff preview. | Dialog trigger. | State contract test. |
| **Media Gallery Asset Picker** | `artifacts` | Drawer to pick backgrounds/flyers | **Retained**: In-drawer asset selector and category filtering. | Drawer trigger. | Background selection test. |
| **Duty Roster Integration** | `services` | Synthetic personnel roster for service roles | **Retained**: Roster drawer accessible from secondary ribbon. | Drawer trigger. | Personnel token check. |

2. Presentation Mode Multi-Slide Filmstrip Grid Parity:
   - When entering full presentation mode (`▶ Tayangkan Sekarang` / Stage View):
     - Operators can toggle the bottom/overlay **Slide Filmstrip Grid** (`F` key or toggle button) to see all slides as visual thumbnails and jump to any slide instantly.
     - Active slide thumbnail is clearly highlighted with live presentation border.

3. Smoke Test Suite (`tests/smoke-spec-52.test.mjs`):
   - Layout and lifecycle tests:
     - Verify presence of `[Jadwal Baru]`, `[Muat Jadwal]`, and `[Salin Preset]` buttons in top-left Zone A.
     - Verify absence of live preset selector dropdown in the status strip.
     - Verify pinned Slide 0 at timeline index 0 and its non-deletable / non-reorderable status.
     - Verify Rundown Hub displays raw textarea parser and grouped predefined fields when Slide 0 is selected.
     - Verify absence of `Judul Agenda` and `Keterangan/Subtitle` inputs in Slide 1..N editors.
     - Verify Song Set and Announcement binding badges and `Detach` triggers.
     - Verify presentation mode filmstrip toggle availability (`F` key).
     - Verify `[Duplikat Jadwal]` and `[Duplikat Preset]` functions.
   - Defect injection proofs with real-file physical mutation and reversion.
   - Register `"test:smoke-spec-52"` in `package.json`.

**Satisfies:** UC-5, UC-11, UC-12, FR-11, FR-32

**Touches:** present-channel, remote-control, settings, services

**Blocked by:** SPEC-52-03

**Status:** closed

- [x] Verify and restore presentation mode multi-slide filmstrip grid navigation (`F` key toggle).
- [x] Audit and enforce legacy UI/UX parity matrix for quick projection, remote pairing, offline sync, and media gallery.
- [x] Author `tests/smoke-spec-52.test.mjs` with comprehensive assertions and defect injection proofs.
- [x] Register `"test:smoke-spec-52"` script in `package.json`.
- [x] Ensure full test suite passes cleanly.

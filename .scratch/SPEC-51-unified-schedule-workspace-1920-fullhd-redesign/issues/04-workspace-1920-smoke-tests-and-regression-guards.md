# 04: Full HD Workspace End-to-End Verification, Smoke Test Suite & Regression Guards

**What to build:**
Author an end-to-end smoke test suite and behavioral regression guards validating the 1920 Full HD redesign:
1. Smoke Test Suite (`tests/smoke-spec-51.test.mjs`):
   - **Layout Constraints & Proportions:**
     - Verify root wrapper includes 1920px Full HD responsive baseline classes (`max-w-[2560px]`, `2xl:px-8`).
     - Verify 3-panel container allocations: Timeline min-width >= 320px (2xl: 400px), Canvas Preview min-width >= 440px (2xl: 580px), Editor fluid width.
     - Verify viewport height binding (`calc(100vh - 175px)` / `min-h-[560px] 2xl:min-h-[700px]`).
   - **In-Drawer Direct Master Libraries CRUD:**
     - Verify "+ Tambah Song Set Baru" button and submission flow.
     - Verify "+ Tambah Warta Baru" action and flyer management.
     - Verify delete dependency check guard for master song sets (refuses deletion if referenced in presets).
     - Verify system token immutability protection (`disabled={tok.isSystem}`).
   - **Consolidated AV Command Header & Quick Projection:**
     - Verify Zone A, Zone B, and Zone C button renders and event callbacks.
     - Verify quick projection controls (Blackout, Clear Text, Stage Confidence toggle).
     - Verify keyboard shortcut safety guard: simulate `B` and `C` keydown with input focused (verifies blackout/clear are NOT triggered); simulate without input focus (verifies triggers fire).
2. Absence Guards & Defect Injection:
   - Prove that sub-1920px displays gracefully degrade without horizontal overflow cutting off action buttons.
   - Prove that deleting a master preset or master song set that is actively referenced triggers refusal.
   - Inject defects (e.g. remove input-focus check on shortcuts, disable preset dependency guard, break 1920px container constraint), watch suite fail RED, revert and verify suite turns GREEN.
3. Script Registration:
   - Register `"test:smoke-spec-51"` in `package.json`.
   - Ensure all assertions run cleanly with Node test runner.

**Satisfies:** UC-5, UC-11, UC-12, FR-11, FR-20, FR-32, FR-44

**Touches:** operator, spa, tests

**Blocked by:** 03

**Status:** closed

- [x] Create `tests/smoke-spec-51.test.mjs` verifying 1920px layout constraints, panel widths, and responsive classes.
- [x] Test in-drawer direct CRUD actions and dependency guards for Master Libraries.
- [x] Test consolidated AV Command Header, quick projection controls, and keyboard focus safety guards.
- [x] Prove absence guards with defect injection and register `"test:smoke-spec-51"` in `package.json`.
- [x] Verify test suite passes cleanly.

# 01: Workspace Shell, Preset Selector, and Route Mounting

**What to build:**
Implement the unified workspace shell and header navigation for the visual prototype:
1. Mount the unified schedule workspace mockup to route `/new` within `spa/src/App.tsx` under `OperatorShell` (accessible to authenticated operator sessions).
2. Build the top workspace header bar featuring:
   - Preset selector dropdown supporting 5 options: Ibadah Sabat Pagi (Dewasa), Ibadah Vesper Jumat, Ibadah Doa Rabu Malam, Kebaktian Khusus / Natal, and Jadwal Bebas (Non-Preset).
   - Service Date selector with preset-aware defaults.
   - Status badge (Draft, Siap Tayang, Live Presentation).
   - Quick action buttons (simulated with local toast notices): Quick Verse, Live Presentation, PPTX Export, and Sync Status indicator.
3. Establish the 3-panel layout:
   - Left Panel (Run Sheet Timeline): 300px - 340px width.
   - Center Panel (In-Place Item Editor): Flexible fluid width.
   - Right Panel (Live Canvas Preview & Controls): 400px - 460px sticky width.
4. Add `test:smoke-spec-48` entry in `package.json` and create `tests/smoke-spec-48.test.mjs`.

**Blocked by:** none

**Status:** closed

- [x] Mount workspace mockup component at route `/new` under `OperatorShell` in `spa/src/App.tsx`.
- [x] Build workspace header bar with interactive preset selector, status badges, and local simulated toast actions.
- [x] Implement responsive 3-panel layout with `data-testid="workspace-mockup"` root container.
- [x] Add smoke test asserting `/new` renders workspace header and preset selector.

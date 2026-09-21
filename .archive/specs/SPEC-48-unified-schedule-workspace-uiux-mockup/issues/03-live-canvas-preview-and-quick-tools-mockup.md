# 03: Sticky Live Canvas Preview, Quick Scripture Drawer, and Presenter Visual Simulation

**What to build:**
Implement the sticky live canvas preview, quick scripture lookup drawer, and presenter mode simulation:
1. Build the sticky live canvas preview in `src/operator`:
   - 16:9 canvas container rendering a high-fidelity visual slide simulation matching the selected timeline item.
   - Slide navigation controls: Previous, Next, Slide counter (Slide 1 of 4).
   - Slide filmstrip miniature previews below the main canvas.
   - Action controls: Black Screen toggle (B, preserving active slide position), Clear Text toggle (C), Fullscreen Projector Preview.
2. Build the Quick Scripture modal in `src/operator` (visual exploration for UC-13):
   - Instant verse search input (e.g. Yohanes 3:16, Mazmur 23).
   - Translation picker (TB2, KJV, BIS).
   - Instant Tayangkan Sekarang button simulating temporary overlay projection without altering the permanent run sheet.
3. Presenter Mode visual simulation (visual exploration for UC-11, UC-12):
   - Split preview toggle showing operator confidence display vs clean congregation projector output (without operator chrome).

**Blocked by:** 02

**Status:** closed

- [x] Build sticky 16:9 canvas preview in `src/operator` with filmstrip slide navigation.
- [x] Build Quick Scripture modal drawer with search and translation picker simulating temporary overlay.
- [x] Implement Presenter Mode visual simulation toggle with clean projector output view.
- [x] Add smoke tests verifying slide navigation and quick scripture modal interactions.

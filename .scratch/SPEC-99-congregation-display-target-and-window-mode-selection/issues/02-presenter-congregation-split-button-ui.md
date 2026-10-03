# 02: Presenter Congregation Split-Button & Target Selector UI

**What to build:** In `<src/operator/present/PresenterDisplayControl.tsx>`, `src/operator/present/PresenterOperator.tsx`, `src/lib/i18n/catalogue-en.ts`, and `src/lib/i18n/catalogue-id.ts`:

1. **PresenterDisplayControl Component**:
   - Create a dedicated component for the congregation screen launcher in `<src/operator/present/PresenterDisplayControl.tsx>`.
   - Implement an accessible **Split Button** pattern using Shadcn UI / Radix DropdownMenu / Button components:
     - Container: `inline-flex rounded-md shadow-sm border border-input`
     - **Primary Action Button**:
       - Dynamic label and icon based on resolved launch target and liveness state:
         - When closed & external screen available:
           `[ 📺 Buka di Layar Eksternal ]` / `[ 📺 Open on External Screen ]`
         - When closed & single screen (window fallback):
           `[ 📺 Buka sebagai Jendela ]` / `[ 📺 Open as Window ]`
         - When opened & liveness `active`:
           `[ 🟢 Layar Jemaat Aktif ]` / `[ 🟢 Congregation Screen Active ]`
         - When opened & liveness `lost`:
           `[ ⚠ Buka Ulang Layar ]` / `[ ⚠ Reopen Screen ]`
       - Behavior: Single click executes the resolved action directly (opens window or focuses existing window).
     - **Dropdown Trigger Button (`▾`)**:
       - Compact chevron button (`h-8 px-2 border-l border-input/60 hover:bg-accent`).
       - `aria-label`: "Display options".
       - Opens the target selection menu and triggers screen detection if permission is in `prompt` state.

2. **Dropdown Menu Options & Retargeting Flow**:
   - Section header: `TAMPILKAN KE` / `PROJECT TO`
   - Explicit radio items for every detected screen:
     - If multiple external screens are detected, render an item for each:
       `● Epson Projector (1920x1080) — Layar Penuh [Rekomendasi]`
       `○ TV Lobby (1920x1080) — Layar Penuh`
     - `○ Layar Laptop — Layar Penuh` (displays safety hint: `Akan menutupi kontrol operator`).
       - If clicked, show confirmation warning before applying.
     - `○ Window Mode` (displays hint: `Aman untuk latihan / satu layar`).
   - Section divider.
   - Utility & Diagnostic Actions:
     - `Deteksi Ulang Layar` / `Detect Displays`: explicitly re-runs `detectAvailableScreens()` (requests permission if needed).
     - Action items when screen is open:
       - `Fokuskan Layar Jemaat`: brings open window to front.
       - `Tutup Layar Jemaat`: cleanly closes the window handle.
   - Preference Checkbox:
     - `☑ Ingat pilihan untuk perangkat ini` (binds to `rememberOnDevice`).
   - **Live Re-targeting Behavior**:
     - If the congregation window is already open and the operator selects a different display in the dropdown, display a confirmation prompt:
       `"Layar jemaat sedang aktif. Buka ulang di layar [Nama Layar]?"`
       Upon confirmation, close the old window handle, open at the new target display, and dispatch sync.

3. **PresenterOperator Header Integration**:
   - In `PresenterOperator.tsx` header row 1, replace the plain `Button` (`t('presenter.openCongregationScreen')`) with `<PresenterDisplayControl />`.
   - Pass `projectorUrl`, `serviceId`, `liveness`, and channel dispatch handlers.
   - Maintain existing header layout proportions and safety constraints.

4. **Bilingual Localization (EN & ID)**:
   - Add new translation keys in `catalogue-en.ts` and `catalogue-id.ts`:
     - `presenter.displayTarget.openExternal`: "Open on External Screen" / "Buka di Layar Eksternal"
     - `presenter.displayTarget.openWindow`: "Open as Window" / "Buka sebagai Jendela"
     - `presenter.displayTarget.active`: "Congregation Screen Active" / "Layar Jemaat Aktif"
     - `presenter.displayTarget.reopen`: "Reopen Screen" / "Buka Ulang Layar"
     - `presenter.displayTarget.targetHeader`: "Project To" / "Tampilkan Ke"
     - `presenter.displayTarget.externalRecommended`: "External Display — Full Screen (Recommended)" / "Layar Eksternal — Full Screen (Rekomendasi)"
     - `presenter.displayTarget.laptopWarning`: "Laptop Display — Full Screen (Covers Controls)" / "Layar Laptop — Full Screen (Menutupi Kontrol)"
     - `presenter.displayTarget.windowSafe`: "Window Mode (Safe for Rehearsal)" / "Mode Jendela (Aman untuk Latihan)"
     - `presenter.displayTarget.detectDisplays`: "Detect Displays" / "Deteksi Ulang Layar"
     - `presenter.displayTarget.relocateConfirm`: "Move congregation screen to {screen}?" / "Pindahkan layar jemaat ke {screen}?"
     - `presenter.displayTarget.remember`: "Remember for this device" / "Ingat pilihan untuk perangkat ini"

5. **Test Suite (`tests/presenter-congregation-display-control.test.mjs`)**:
   - Assert split button renders in Presenter header row 1.
   - Assert primary button label dynamically reflects single-screen vs multi-screen status.
   - Assert dropdown menu contains all detected screens, window mode, and diagnostic actions.
   - Assert live retargeting confirmation triggers clean window relocation.
   - Assert bilingual translations exist for all display target keys.

**Blocked by:** `SPEC-99-01`

**Status:** closed

- [x] Create `<src/operator/present/PresenterDisplayControl.tsx>` implementing the split-button pattern.
- [x] Implement dropdown menu with multi-screen target radio selections, live retargeting, and utility actions.
- [x] Integrate into `PresenterOperator.tsx` header row 1.
- [x] Add bilingual translations in English and Indonesian catalogues.
- [x] Add component test suite in `tests/presenter-congregation-display-control.test.mjs`.

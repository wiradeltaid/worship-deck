# SPEC-94 — Desktop Dark Mode Title Bar, Congregation F11 Fullscreen Guidance, and Installer Metadata Alignment

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-10` (One Presenter Sync Channel, Client-Side Only)
  - `AD-29` (Presenter-Projector Cross-Window Liveness Handshake and Sync)
  - `AD-30` (Process Roles: Go API, React SPA, On-Demand PPTX Worker)
- **Related Delivery History (Non-binding context)**:
  - `DEC-076` (Historical mandate for SPEC-89 native desktop webview2 shell)
  - `DEC-079` (Historical mandate for SPEC-92 desktop window icon and installer license)
- **Functional Requirements**:
  - `FR-16` (Two-Screen Presenter View in the Browser — Congregation Screen)
- **Use Cases & Authorized Exception**:
  - `UC-12` (I Run the Two-Screen Presenter)
  - *Authorized Exception to `UC-12` / `SRS-presenter.md` Non-Slide Chrome Prohibition*: An ephemeral, self-dismissing onboarding cue is permitted strictly at congregation window startup when in windowed mode. Invariant: It renders strictly below the blanking layer (`blank === true`), never appears while blanked, immediately dismisses upon `F11` keydown or fullscreen entry, auto-dismisses after 5 seconds, and never becomes persistent room-facing chrome.
- **Bounded Operational Deliverables**:
  - Windows Desktop Title Bar Theming on Launch (`internal/desktop/window_windows.go`)
  - Windows Inno Setup Metadata Directives Alignment (`installer/worship-deck.iss`)
- **Components**: `hub`, `presenter`
- **Touches**: `desktop`, `projector`, `installer`

---

## Problem Statement

During operator manual verification and desktop workstation testing, three UX polish, ergonomics, and metadata hygiene findings were reported:

1. **Native Window Title Bar Remains White in Windows Dark Mode**:
   - In `internal/desktop/window_windows.go`, the native Win32 window hosting Microsoft Edge WebView2 is created via `webview2.NewWithOptions(...)`.
   - Windows 10 (1809+) and Windows 11 default to rendering Win32 non-client areas (title bar and borders) with a light/white background unless the Desktop Window Manager (DWM) immersive dark mode attribute is explicitly enabled.
   - When the user has configured dark mode across Windows (`AppsUseLightTheme = 0` in `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize`) and the WorshipDeck web application UI renders in dark theme, the native title bar remains stark white.
   - Operators expect the window title bar to adapt to the active Windows dark/light system preference on launch. Runtime dynamic re-theming on external theme toggle while the app remains open is out of scope.

2. **Absence of Fullscreen Guidance on Congregation Screen (`ProjectorClient`)**:
   - When the operator opens the congregation screen (`/services/:id/projector` or `projected.html`), the secondary window opens as a standard popup/browser window.
   - To achieve clean, distraction-free sanctuary projection without browser toolbars, address bars, or window borders, operators must press `F11` (or use browser fullscreen).
   - Currently, there is no visual onboarding cue or hint reminding the operator to press `F11` to enter fullscreen mode.
   - Operators requested a non-intrusive floating guidance cue upon opening the congregation screen that indicates F11 for fullscreen, which auto-dismisses after a short period, when F11 is pressed, or as soon as fullscreen is entered.

3. **Installer Support, Update, and Help Links Point to Raw Repository Instead of Canonical Ecosystem URLs**:
   - In `installer/worship-deck.iss`, the Inno Setup metadata directives `AppPublisherURL`, `AppSupportURL`, and `AppUpdatesURL` are all assigned to `MyAppURL` (`https://github.com/wiradeltaid/worship-deck`).
   - When users view WorshipDeck under Windows Control Panel (Programs and Features / Installed Apps), the Support link (`HelpLink`), Update information (`URLUpdateInfo`), and Publisher info (`URLInfoAbout`) all point indiscriminately to the raw GitHub source code repository.
   - In comparison, sister products `snapdown` (`snapdown.iss` and `spec-t16-aplikasi.md`) and `wira-desk` (`wiradesk.iss`) follow a structured pattern:
     - Publisher / Product URL points to the canonical product showcase website (`https://wiradelta.com/worship-deck/`).
     - Support link points to the public issue tracker or support channel (`https://github.com/wiradeltaid/worship-deck/issues`).
     - Update link points to the releases download page (`https://github.com/wiradeltaid/worship-deck/releases`).
   - Furthermore, `ops/research/wdi-ecosystem-strategy/plan/worship-deck.md` lacks a dedicated section standardizing these installer metadata URLs, leaving a governance gap between product implementation and studio ops.

---

## Solution

1. **Native DWM Immersive Dark Mode Integration on Launch (`internal/desktop/window_windows.go`)**:
   - Declare `dwmapi.dll` and dynamic procedure `DwmSetWindowAttribute`.
   - Define DWM window attribute constants:
     - `DWMWA_USE_IMMERSIVE_DARK_MODE = 20` (Windows 11 and Windows 10 20H1+ build 19041+)
     - `DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1 = 19` (Windows 10 1809–1909 fallback)
   - Read Windows active app theme preference from registry deterministically on startup:
     `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize` -> `AppsUseLightTheme` (DWORD).
     When `AppsUseLightTheme == 0`, dark mode is active. If the key is absent or reading fails, default deterministically to `false` (light mode).
   - Upon creating the native Win32 window (and obtaining `hwnd` from `w.Window()`), evaluate the theme and invoke `DwmSetWindowAttribute` (attribute 20 with fallback to 19).
   - Maintain graceful fallback if running on older Windows builds or if DWM API returns non-zero. Dynamic runtime tracking of Windows theme toggles while running is explicitly out of scope.

2. **Congregation Screen F11 Fullscreen Guidance Banner (`src/projected/ProjectorClient.tsx`)**:
   - In `ProjectorClient.tsx`, implement a self-contained, standalone bilingual pill component without provider dependencies:
     Text: `"Press F11 for full screen · Tekan F11 untuk layar penuh"` with `<kbd>F11</kbd>`.
   - Behavior & Ergonomics:
     - Displayed on initial window mount only if `!document.fullscreenElement`.
     - Automatically fades out and unmounts after 5 seconds.
     - Immediately dismisses if the user presses `F11` (via `keydown` listener, without `preventDefault()` so native browser fullscreen proceeds uninterrupted).
     - Immediately dismisses if `fullscreenchange` fires and `document.fullscreenElement` becomes active.
     - Can be dismissed manually via click on the pill.
     - Rendered with `pointer-events-none` on container wrapper and `pointer-events-auto` on the interactive badge only, ensuring clicks outside the badge pass through.
     - Positioned below the emergency blanking layer (`blank === true`) so a blanked congregation screen stays 100% black without leaking operator guidance.

3. **Inno Setup Programs & Features Metadata Alignment (`installer/worship-deck.iss`)**:
   - In `installer/worship-deck.iss`:
     - Define distinct canonical metadata URLs:
       - `#define MyAppURL "https://wiradelta.com/worship-deck/"` (Canonical product showcase website)
       - `#define MyAppSupportURL "https://github.com/wiradeltaid/worship-deck/issues"` (Public issue & support portal)
       - `#define MyAppUpdatesURL "https://github.com/wiradeltaid/worship-deck/releases"` (Official releases page)
     - Bind `[Setup]` directives:
       - `AppPublisherURL={#MyAppURL}`
       - `AppSupportURL={#MyAppSupportURL}`
       - `AppUpdatesURL={#MyAppUpdatesURL}`
   - In `tests/installer-pe-metadata.test.mjs`:
     - Extend existing installer metadata contract test with assertions verifying that `AppPublisherURL`, `AppSupportURL`, and `AppUpdatesURL` are bound and point to their respective canonical URLs.
   - In `ops` (`ops/research/wdi-ecosystem-strategy/plan/worship-deck.md`):
     - Update Section 3 in studio ops to govern and document the canonical installer metadata URL mapping.

---

## User Stories

1. As a desktop workstation operator using Windows Dark Mode, I want WorshipDeck's native window title bar to render in immersive dark theme on launch, so that the title bar blends seamlessly with my operating system theme and the dark application UI.
2. As a projectionist opening the congregation screen, I want a clear, temporary hint reminding me to press F11 for fullscreen, so that I can quickly switch to clean sanctuary presentation without having to search through browser menus.
3. As a system administrator viewing installed software in Windows Programs and Features, I want the Support Link, Update Information, and Publisher website to direct to their respective canonical portals, so that support and release information follow the standard WDI studio pattern.

---

## Implementation Decisions

- **Deterministic Registry Introspection on Launch**: On desktop startup, query `AppsUseLightTheme` under `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize`. If value is `0`, enable immersive dark mode; otherwise (value `1`, missing key, or query error), default to light mode. Dynamic runtime re-theming while running is out of scope.
- **Fail-Safe DWM Attribute Invocation**: If `DWMWA_USE_IMMERSIVE_DARK_MODE` (20) fails or returns error on older Windows 10 releases, the invocation falls back to attribute 19, and quietly succeeds or logs without aborting window creation.
- **Self-Contained Bilingual Fullscreen Pill**: Avoids coupling to `OperatorUiLocaleProvider` on projected routes by embedding a concise static bilingual string (`Press F11 for full screen · Tekan F11 untuk layar penuh`).
- **Dual Fullscreen Dismissal Triggers**: The guidance badge dismisses on both `keydown` event for `F11` (preserving browser default behavior) and `fullscreenchange` DOM event.
- **Authorized Room-Facing Startup Exception**: The hint is scoped strictly to `ProjectorClient.tsx` (the congregation view under `UC-12`), renders below the blanking layer, and uses `pointer-events-none` outside the pill to prevent accidental pointer capture.
- **Installer Test Consolidation**: Rather than creating a separate test file that duplicates Inno Setup parsing, `tests/installer-pe-metadata.test.mjs` is extended to verify `AppPublisherURL`, `AppSupportURL`, and `AppUpdatesURL`.

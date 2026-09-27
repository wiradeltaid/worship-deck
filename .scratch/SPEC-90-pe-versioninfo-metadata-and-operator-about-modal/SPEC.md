# SPEC-90 — Windows PE VersionInfo Metadata Staging and Operator UI Legal About Modal

## Requirement Traceability & Scope
- **PRD**: `offline-deck`
- **Architectural Decisions**:
  - `AD-30` (Three-Tier Architecture — Go HTTP API + Vite React SPA + Node.js PPTX worker)
- **Functional Requirements**:
  - `FR-40` (Manual Device Sync & Standalone Offline-Desktop Packaging Distribution Integrity)
- **Components**: `hub`, `registry`
- **Touches**: `artifacts`, `settings`

---

## Problem Statement

Following the pure-Go Microsoft Edge WebView2 desktop window wrapper and default seed staging implementation (`SPEC-89`), two critical distribution, packaging, and legal compliance gaps remain on WorshipDeck:

1. **Missing Windows PE VersionInfo Resource & Inno Setup Metadata (`CompanyName = "Wira Delta Indonesia"`):**
   - The desktop executable `dist-desktop/worship-deck.exe` is compiled by Go with `-trimpath -ldflags="-s -w -H=windowsgui"`. However, Go does not embed Windows PE `VERSIONINFO` resources by default unless compiled with a resource object (`.syso`). Consequently, inspecting file properties on `worship-deck.exe` shows empty `CompanyName`, `FileDescription`, `LegalCopyright`, `ProductName`, and `ProductVersion`.
   - In `installer/worship-deck.iss`, while `AppPublisher="Wira Delta Indonesia"` is set (populating the Inno Setup wizard header and Windows Settings *Installed Apps*), the `[Setup]` section lacks the standard Inno Setup `VersionInfo*` directives (`VersionInfoCompany`, `VersionInfoDescription`, `VersionInfoCopyright`, `VersionInfoProductName`, `VersionInfoProductVersion`). The compiled installer setup executable (`WorshipDeck-<version>-x64-setup.exe`) therefore lacks publisher metadata in its Windows PE file details.
   - Per WDI legal and publisher guidelines (`legal/about-and-publisher-identity.md` §1 & §5), all binary metadata must stamp `Wira Delta Indonesia` as `CompanyName` without the "PT" prefix.

2. **Missing Legal About Dialog in Operator UI:**
   - In the React/Vite operator SPA, `src/components/Header.tsx` provides Navigation, Theme Toggle, and User Profile Dropdown (Change Password, Sync, Logout), but provides no "About" menu or modal.
   - Per `legal/about-and-publisher-identity.md` §4 C and `legal/worship-deck/about.md`, WorshipDeck is legally required to present a clear, offline-accessible About modal in the application UI that contains:
     - Product name and exact version number (`WorshipDeck <version>`), strictly synchronized with `package.json`.
     - Publisher copyright notice: `Copyright (c) 2026 Wira Delta Indonesia`.
     - License grant: `Free software under the MIT License. Source: LICENSE`.
     - Mandatory Church Operator Liability Separation (`legal/terms-guideline.md` §4):
       `This installation is operated by the local church administration, not by the publisher. What is stored, and who answers for it: PRIVACY.md`.
     - Mandatory Hymn Text Exclusion Notice (`legal/worship-deck/about.md`):
       `Hymn texts are not covered by the MIT license and are not ours to license. See ATTRIBUTIONS.md`.
     - Publisher contact: Studio website `https://wiradelta.id/worship-deck` and support email `support@wiradelta.com`.
   - In alignment with WorshipDeck's local-first zero-telemetry architecture and hybrid model (where self-hosted server is primary and desktop is experimental per `plan/worship-deck.md`), no background update checking or telemetry polling is performed.

---

## Architecture & Detailed Solution

### 1. Windows PE Metadata Generation & Inno Setup VersionInfo Directives (`scripts/build-desktop.mjs`, `installer/worship-deck.iss`)
- In `installer/worship-deck.iss`:
  - Add explicit `VersionInfo*` and `AppCopyright` directives inside `[Setup]`:
    ```iss
    VersionInfoVersion={#MyAppVersion}
    VersionInfoCompany={#MyAppPublisher}
    VersionInfoDescription={#MyAppName} Setup
    VersionInfoCopyright=Copyright (c) 2026 {#MyAppPublisher}
    VersionInfoProductName={#MyAppName}
    VersionInfoProductVersion={#MyAppVersion}
    VersionInfoOriginalFileName=WorshipDeck-{#MyAppVersion}-x64-setup.exe
    AppCopyright=Copyright (c) 2026 {#MyAppPublisher}
    UninstallDisplayName={#MyAppName}
    UninstallDisplayIcon={app}\worship-deck.ico
    ```
- In `scripts/build-desktop.mjs` & `internal/desktop/window_windows.go`:
  - Enforce a deterministic build invariant:
    - Parse `package.json` semver into numeric major, minor, patch components (`X,Y,Z,0`) for `FILEVERSION` and `PRODUCTVERSION`.
    - Generate Windows resource script (`cmd/api/worship-deck.rc`) embedding application shell icon (`1 ICON "../../installer/worship-deck.ico"`) and version resource:
      ```rc
      1 ICON "../../installer/worship-deck.ico"
      1 VERSIONINFO
      FILEVERSION <major>,<minor>,<patch>,0
      PRODUCTVERSION <major>,<minor>,<patch>,0
      FILEFLAGSMASK 0x3fL
      FILEFLAGS 0x0L
      FILEOS 0x40004L
      FILETYPE 0x1L
      FILESUBTYPE 0x0L
      BEGIN
          BLOCK "StringFileInfo"
          BEGIN
              BLOCK "040904b0"
              BEGIN
                  VALUE "CompanyName", "Wira Delta Indonesia"
                  VALUE "FileDescription", "WorshipDeck"
                  VALUE "FileVersion", "<version>"
                  VALUE "InternalName", "worship-deck"
                  VALUE "LegalCopyright", "Copyright (c) 2026 Wira Delta Indonesia"
                  VALUE "OriginalFilename", "worship-deck.exe"
                  VALUE "ProductName", "WorshipDeck"
                  VALUE "ProductVersion", "<version>"
              END
          END
          BLOCK "VarFileInfo"
          BEGIN
              VALUE "Translation", 0x409, 1200
          END
      END
      ```
    - Check for `windres` compiler (on PATH or WinGet MingW toolchain) to compile `cmd/api/worship-deck.rc` into `cmd/api/rsrc_windows_amd64.syso`.
    - Fail closed on desktop packaging if `rsrc_windows_amd64.syso` cannot be produced or is stale relative to `package.json`.
    - Go compiler automatically links `cmd/api/rsrc_windows_amd64.syso` into `dist-desktop/worship-deck.exe` with zero CGO (`CGO_ENABLED=0`).

### 2. Operator UI About Modal (`<src/components/AboutModal.tsx>`, `src/components/Header.tsx`, `src/lib/i18n/operator.tsx`)
- Authoritative Version Source:
  - Synchronized from `package.json` via Vite define `__APP_VERSION__` in `spa/vite.config.ts`, ensuring zero version drift across SPA and PE binary.
- Component `<src/components/AboutModal.tsx>`:
  - Responsive modal dialog implemented with `@/components/ui/dialog`.
  - Header: WorshipDeck logo mark (`/branding/worship-deck-icon-square.svg`), application title, and dynamic version badge (`v${__APP_VERSION__}`).
  - Content sections:
    1. Publisher Copyright: `Copyright (c) 2026 Wira Delta Indonesia`.
    2. License: `Free software under the MIT License. Source: LICENSE`.
    3. Church Operator Disclaimer: `This installation is operated by the local church administration, not by the publisher. What is stored, and who answers for it: PRIVACY.md`.
    4. Hymn Text Exclusion: `Hymn texts are not covered by the MIT license and are not ours to license. See ATTRIBUTIONS.md`.
    5. Support & Studio Links: External links to `https://wiradelta.id/worship-deck` and mailto link to `support@wiradelta.com`.
    6. Local-First & Zero Telemetry Badge: Explaining that WorshipDeck operates strictly local-first with zero telemetry and zero background outbound calls.
- Header Dropdown Integration (`src/components/Header.tsx`):
  - Add an "About WorshipDeck" item in `DropdownMenuContent` with `Info` icon.
  - Clicking the item opens the About Modal.
- Localization (`src/lib/i18n/operator.tsx`):
  - Add translation keys under `chrome.about.*` for both English (`en`) and Indonesian (`id`), maintaining canonical English legal disclaimer text alongside Indonesian explanations.

### 3. Automated Test Suite Integration (`package.json`, `tests/installer-pe-metadata.test.mjs`, `tests/about-modal.test.mjs`, `tests/desktop-about-contract.test.mjs`)
- Test Suite Registration (`package.json`):
  - Add `tests/installer-pe-metadata.test.mjs`, `tests/about-modal.test.mjs`, and `tests/desktop-about-contract.test.mjs` to canonical `npm test` script.
  - Add dedicated npm scripts `"smoke:spec-90"` and `"test:smoke-spec-90"`.
- Artifact-Level PE Inspection (`tests/installer-pe-metadata.test.mjs`):
  - Verify that `dist-desktop/worship-deck.exe` (when built) has `CompanyName = "Wira Delta Indonesia"` and matching `ProductVersion`.
  - Verify that `installer/worship-deck.iss` declares all required `VersionInfo*` and `AppCopyright` directives.
- UI & Legal Parity Guard (`tests/about-modal.test.mjs`):
  - Assert that About Modal renders all mandatory legal statements verbatim.
  - Assert that `Header.tsx` exposes the trigger button/item.
- Bounded Zero-Telemetry & Absence Guard (`tests/desktop-about-contract.test.mjs`):
  - Explicitly test for absence of automatic update check endpoints (`api/v1/update`, `latest.json`, GitHub release polling) and third-party analytics/telemetry libraries.
- Per-Monitor V2 DPI Awareness:
  - In `internal/desktop/window_windows.go`, invoke `SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)` from `user32.dll` prior to WebView2 initialization, eliminating DWM bitmap scaling and rendering text and UI sharply on high-DPI displays.

---

## Ticket Breakdown

- **SPEC-90-01**: Windows PE VersionInfo Metadata Staging & Inno Setup Directives (`installer/worship-deck.iss`, `scripts/build-desktop.mjs`, `tests/installer-pe-metadata.test.mjs`, `package.json`)
- **SPEC-90-02**: Operator UI Legal About Modal & Profile Menu Integration (`<src/components/AboutModal.tsx>`, `src/components/Header.tsx`, `src/lib/i18n/operator.tsx`, `tests/about-modal.test.mjs`, `package.json`)
- **SPEC-90-03**: Desktop Packaging, Per-Monitor DPI Awareness, and End-to-End Contract Verification (`tests/desktop-about-contract.test.mjs`, `scripts/build-desktop.mjs`, `internal/desktop/window_windows.go`, `package.json`)

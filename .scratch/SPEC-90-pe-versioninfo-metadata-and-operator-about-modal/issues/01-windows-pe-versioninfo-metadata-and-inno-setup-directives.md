# 01: Windows PE VersionInfo Metadata Staging & Inno Setup Directives

**What to build:** In `installer/worship-deck.iss`, `scripts/build-desktop.mjs`, `package.json`, and `tests/installer-pe-metadata.test.mjs`:

1. **Inno Setup Setup Header Metadata (`installer/worship-deck.iss`)**:
   - In `[Setup]`, declare explicit `VersionInfo*` and `AppCopyright` directives:
     ```iss
     VersionInfoVersion={#MyAppVersion}
     VersionInfoCompany={#MyAppPublisher}
     VersionInfoDescription={#MyAppName} Setup
     VersionInfoCopyright=Copyright (c) 2026 {#MyAppPublisher}
     VersionInfoProductName={#MyAppName}
     VersionInfoProductVersion={#MyAppVersion}
     VersionInfoOriginalFileName=WorshipDeck-{#MyAppVersion}-x64-setup.exe
     AppCopyright=Copyright (c) 2026 {#MyAppPublisher}
     ```
   - Ensure `MyAppPublisher` is strictly `"Wira Delta Indonesia"` without "PT".

2. **Deterministic Windows PE VERSIONINFO Resource Compilation (`scripts/build-desktop.mjs`)**:
   - Parse `package.json` semver into numeric components (`X,Y,Z,0`) and display strings.
   - Generate `cmd/api/worship-deck.rc` containing:
     - `CompanyName`: `"Wira Delta Indonesia"`
     - `FileDescription`: `"WorshipDeck"`
     - `FileVersion`: semver string from `package.json`
     - `ProductVersion`: semver string from `package.json`
     - `LegalCopyright`: `"Copyright (c) 2026 Wira Delta Indonesia"`
     - `ProductName`: `"WorshipDeck"`
     - `OriginalFilename`: `"worship-deck.exe"`
   - Compile `cmd/api/worship-deck.rc` into `cmd/api/rsrc_windows_amd64.syso` via `windres` before Go compilation.
   - Fail closed if desktop packaging is executed without producing valid, up-to-date `rsrc_windows_amd64.syso`.
   - Ensure `go build` links the syso object into `dist-desktop/worship-deck.exe`.

3. **Artifact-Level Inspection & Test Registration (`package.json`, `tests/installer-pe-metadata.test.mjs`)**:
   - Register `tests/installer-pe-metadata.test.mjs` in `package.json` under `"test"` and `"smoke:spec-90"`.
   - Assert `installer/worship-deck.iss` contains all required `VersionInfo*` directives.
   - Assert `worship-deck.rc` generation produces valid syntax and valid metadata.
   - On Windows environments with built artifacts, verify that `worship-deck.exe` file version properties contain `CompanyName = "Wira Delta Indonesia"`.
   - Inject defect test: verify that missing `VersionInfoCompany` or incorrect publisher name triggers test failure.

Satisfies `FR-40`.

**Blocked by:** none

**Status:** closed

- [x] In `installer/worship-deck.iss`:
      - Add `VersionInfoVersion`, `VersionInfoCompany`, `VersionInfoDescription`, `VersionInfoCopyright`, `VersionInfoProductName`, `VersionInfoProductVersion`, `VersionInfoOriginalFileName`, and `AppCopyright`.
- [x] In `scripts/build-desktop.mjs`:
      - Implement deterministic `worship-deck.rc` resource generator and `windres` compilation to `cmd/api/rsrc_windows_amd64.syso`.
- [x] In `package.json`:
      - Add `tests/installer-pe-metadata.test.mjs` to `test` script and create `smoke:spec-90` command.
- [x] In `tests/installer-pe-metadata.test.mjs`:
      - Add guard assertions for Inno Setup directives, PE resource definitions, and artifact-level metadata inspection with defect injection.

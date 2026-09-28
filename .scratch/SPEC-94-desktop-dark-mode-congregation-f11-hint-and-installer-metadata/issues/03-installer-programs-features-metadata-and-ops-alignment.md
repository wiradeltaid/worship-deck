# 03: Installer Programs & Features Metadata Alignment and Ops Governance

**What to build:** In `installer/worship-deck.iss`, `tests/installer-pe-metadata.test.mjs`, and `D:\Developer\wiradeltaid\ops\research\wdi-ecosystem-strategy\plan\worship-deck.md`:

1. **Inno Setup Programs & Features Directives (`installer/worship-deck.iss`)**:
   - Decouple publisher showcase, support, and release update channels in `installer/worship-deck.iss`:
     ```ini
     #define MyAppName "WorshipDeck"
     #define MyAppPublisher "Wira Delta Indonesia"
     #define MyAppURL "https://wiradelta.com/worship-deck/"
     #define MyAppSupportURL "https://github.com/wiradeltaid/worship-deck/issues"
     #define MyAppUpdatesURL "https://github.com/wiradeltaid/worship-deck/releases"
     ```
   - Update `[Setup]` section directives:
     ```ini
     AppPublisher={#MyAppPublisher}
     AppPublisherURL={#MyAppURL}
     AppSupportURL={#MyAppSupportURL}
     AppUpdatesURL={#MyAppUpdatesURL}
     ```
   - Resulting Windows Programs & Features (Add/Remove Programs) registry mapping:
     - `URLInfoAbout` -> `https://wiradelta.com/worship-deck/` (Product Showcase Homepage)
     - `HelpLink` -> `https://github.com/wiradeltaid/worship-deck/issues` (Community Issue & Support Portal)
     - `URLUpdateInfo` -> `https://github.com/wiradeltaid/worship-deck/releases` (Binary Release & Update Feed)

2. **Automated Verification Suite Extension (`tests/installer-pe-metadata.test.mjs`)**:
   - Extend `tests/installer-pe-metadata.test.mjs` (the existing installer contract test suite) to assert that:
     - `installer/worship-deck.iss` declares `#define MyAppURL "https://wiradelta.com/worship-deck/"`
     - `installer/worship-deck.iss` declares `#define MyAppSupportURL "https://github.com/wiradeltaid/worship-deck/issues"`
     - `installer/worship-deck.iss` declares `#define MyAppUpdatesURL "https://github.com/wiradeltaid/worship-deck/releases"`
     - `[Setup]` section binds `AppPublisherURL={#MyAppURL}`, `AppSupportURL={#MyAppSupportURL}`, and `AppUpdatesURL={#MyAppUpdatesURL}`.
   - Maintain strict repository test portability (no cross-repository test assertion against external checkout paths).
   - Provide defect injection proofs.

3. **Studio Ops Plan Governance (`ops/research/wdi-ecosystem-strategy/plan/worship-deck.md`)**:
   - In `plan/worship-deck.md`, under Section 3 ("Penyelarasan README & Higiene Repositori"), add subsection:
     `### 3.1 Standardisasi Metadata Installer Windows (Inno Setup & Add/Remove Programs)`
     - Document canonical mapping of `AppPublisherURL`, `AppSupportURL`, and `AppUpdatesURL`.
     - Align with `snapdown` (`spec-t16-aplikasi.md` §7 / `snapdown.iss`) and `wira-desk` (`wiradesk.iss`).

Bounded operational installer deliverable.

**Blocked by:** SPEC-94-01

**Status:** done

- [x] In `installer/worship-deck.iss`:
      - Define `MyAppSupportURL` and `MyAppUpdatesURL` alongside `MyAppURL`.
      - Bind `AppPublisherURL`, `AppSupportURL`, and `AppUpdatesURL` in `[Setup]`.
- [x] In `tests/installer-pe-metadata.test.mjs`:
      - Extend contract assertions to verify canonical metadata URLs and Setup bindings.
- [x] In `D:\Developer\wiradeltaid\ops\research\wdi-ecosystem-strategy\plan\worship-deck.md`:
      - Document Windows Installer metadata specification under Section 3.

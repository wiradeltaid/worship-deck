# 02: Inno Setup License Page & User Data Uninstall Prompt

**What to build:** In `installer/worship-deck.iss` and `tests/installer-license-and-uninstall.test.mjs`:

1. **License Agreement Page (`installer/worship-deck.iss`)**:
   - In `[Setup]`, add directive:
     ```iss
     LicenseFile=..\dist-desktop\LICENSE
     ```
   - Displays the official MIT License agreement page in the installation wizard before directory selection, aligning with WDI legal policy in `ops/research/wdi-ecosystem-strategy/legal/license-policy.md` and sister products `wira-desk` and `snapdown`.
   - The license file `LICENSE` is staged from repository root into `dist-desktop/LICENSE` by `stageCorporaAndNotices` in `scripts/build-desktop.mjs`.

2. **Interactive Data Removal Prompt on Uninstall (`installer/worship-deck.iss`)**:
   - In `[Code]`, inside `CurUninstallStepChanged`:
     - When `CurUninstallStep = usUninstall`:
     - Prompt the user with a message box:
       ```pascal
       if MsgBox('Do you also want to remove all local user data, service plans, and local databases in ' + DataDir + '?' + #13#10#13#10 + 'Select "No" to keep your data for future installations.', mbConfirmation, MB_YESNO) = IDYES then
       begin
         DelTree(DataDir, True, True, True);
       end;
       ```
     - If the user selects `IDNO`, preserve the directory and log data retention.

3. **Installer Verification Suite (`tests/installer-license-and-uninstall.test.mjs`)**:
   - Assert `installer/worship-deck.iss` specifies `LicenseFile` pointing to the staged `LICENSE`.
   - Assert `installer/worship-deck.iss` contains the uninstallation confirmation prompt with `mbConfirmation` and `DelTree` on `IDYES`.
   - Provide defect injection proofs asserting that removing `LicenseFile` or uninstaller prompt triggers test failure.

Satisfies `FR-20`, `FR-21`.

**Blocked by:** none

**Status:** closed

- [x] In `installer/worship-deck.iss`:
      - Add `LicenseFile=..\dist-desktop\LICENSE` in `[Setup]`.
      - Implement interactive data removal confirmation dialog in `CurUninstallStepChanged`.
- [x] In `package.json`:
      - Register `tests/installer-license-and-uninstall.test.mjs`.
- [x] In `tests/installer-license-and-uninstall.test.mjs`:
      - Implement static assertions and defect injection proofs for license file directive and uninstallation prompt.

/**
 * SPEC-92-02: Inno Setup License Agreement Page and Uninstaller Data Wipe Prompt
 *
 * Verifies that:
 * 1. installer/worship-deck.iss declares `LicenseFile=..\dist-desktop\LICENSE` strictly inside the [Setup] section.
 * 2. Uninstaller in [Code] provides interactive data removal prompt on uninstall (CurUninstallStep = usUninstall),
 *    asking the user whether to delete local databases in %LocalAppData%\WorshipDeck with mbConfirmation / MB_YESNO,
 *    and executing DelTree(DataDir, True, True, True) strictly nested inside the IDYES confirmation block.
 * 3. Real-file defect injection proofs on installer/worship-deck.iss.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function stripComments(content) {
  // Strip line comments: Pascal // and Inno ;
  return content
    .replace(/\/\/[^\r\n]*/g, '')
    .replace(/^;[^\r\n]*/gm, '');
}

export function scanInstallerLicenseAndUninstallContract(issContent) {
  const findings = [];
  const cleanContent = stripComments(issContent);

  // 1. Isolate [Setup] section
  const setupMatch = cleanContent.match(/\[Setup\]([\s\S]*?)(?:\[[A-Za-z0-9_-]+\]|$)/i);
  if (!setupMatch) {
    findings.push('installer/worship-deck.iss must contain [Setup] section');
  } else {
    const setupBody = setupMatch[1];
    if (!/LicenseFile\s*=\s*\.\.\\dist-desktop\\LICENSE/i.test(setupBody)) {
      findings.push('installer/worship-deck.iss must declare LicenseFile=..\\dist-desktop\\LICENSE inside [Setup] section');
    }
  }

  // 2. Isolate CurUninstallStepChanged procedure
  const procMatch = cleanContent.match(/procedure\s+CurUninstallStepChanged\s*\([^)]*\)\s*;[\s\S]*?begin([\s\S]*?)end\s*;/i);
  if (!procMatch) {
    findings.push('installer/worship-deck.iss must declare procedure CurUninstallStepChanged');
  } else {
    const procBody = procMatch[1];

    if (!/CurUninstallStep\s*=\s*usUninstall/i.test(procBody)) {
      findings.push('CurUninstallStepChanged must handle CurUninstallStep = usUninstall');
    }

    if (!procBody.includes("'{localappdata}\\WorshipDeck'")) {
      findings.push("CurUninstallStepChanged must expand '{localappdata}\\WorshipDeck' for user data directory");
    }

    // Verify DelTree is strictly nested inside IDYES block
    const idYesBlockMatch = procBody.match(/if\s+MsgBox\([^)]*mbConfirmation[^)]*MB_YESNO[^)]*\)\s*=\s*IDYES\s+then\s+begin([\s\S]*?)end/i);
    if (!idYesBlockMatch) {
      findings.push('CurUninstallStepChanged must prompt with MsgBox confirmation (mbConfirmation, MB_YESNO) and check IDYES with begin...end block');
    } else {
      const idYesBody = idYesBlockMatch[1];
      if (!/DelTree\(\s*DataDir\s*,\s*True\s*,\s*True\s*,\s*True\s*\)/i.test(idYesBody)) {
        findings.push('CurUninstallStepChanged must invoke DelTree(DataDir, True, True, True) strictly inside IDYES block');
      }
    }
  }

  return findings;
}

test('SPEC-92-02: installer/worship-deck.iss satisfies license page and uninstall clean wipe contract', () => {
  const issPath = path.join(root, 'installer', 'worship-deck.iss');
  const content = fs.readFileSync(issPath, 'utf8');
  const findings = scanInstallerLicenseAndUninstallContract(content);
  assert.deepEqual(findings, [], `Installer license & uninstall contract findings:\n${findings.join('\n')}`);
});

test('SPEC-92-02: scanInstallerLicenseAndUninstallContract defect injection detects missing or misplaced directives on production file', () => {
  const issPath = path.join(root, 'installer', 'worship-deck.iss');
  const prodContent = fs.readFileSync(issPath, 'utf8');

  // Defect 1: missing LicenseFile in [Setup]
  const defectNoLicense = prodContent.replace(/LicenseFile\s*=\s*\.\.\\dist-desktop\\LICENSE/gi, '');
  const findings1 = scanInstallerLicenseAndUninstallContract(defectNoLicense);
  assert.ok(findings1.some(f => f.includes('LicenseFile')), 'must detect missing LicenseFile directive in [Setup]');

  // Defect 2: LicenseFile placed in [Files] instead of [Setup]
  const defectMisplacedLicense = prodContent
    .replace(/LicenseFile\s*=\s*\.\.\\dist-desktop\\LICENSE/gi, '')
    .replace('[Files]', '[Files]\nLicenseFile=..\\dist-desktop\\LICENSE');
  const findings2 = scanInstallerLicenseAndUninstallContract(defectMisplacedLicense);
  assert.ok(findings2.some(f => f.includes('inside [Setup] section')), 'must detect LicenseFile placed outside [Setup]');

  // Defect 3: missing usUninstall step
  const defectNoStep = prodContent.replace(/usUninstall/g, 'usPostUninstall');
  const findings3 = scanInstallerLicenseAndUninstallContract(defectNoStep);
  assert.ok(findings3.some(f => f.includes('usUninstall')), 'must detect missing usUninstall step');

  // Defect 4: DelTree outside IDYES block (unconditional deletion defect)
  const defectUnconditionalDelTree = prodContent.replace(
    /if\s+MsgBox\([^)]*\)\s*=\s*IDYES\s+then\s+begin[\s\S]*?end/i,
    'Log("unconditional"); DelTree(DataDir, True, True, True);'
  );
  const findings4 = scanInstallerLicenseAndUninstallContract(defectUnconditionalDelTree);
  assert.ok(findings4.some(f => f.includes('IDYES with begin...end block')), 'must detect DelTree outside IDYES block');
});

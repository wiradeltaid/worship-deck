/**
 * SPEC-94-02: Congregation Screen F11 Fullscreen Guidance Banner Contract Test
 *
 * Verifies that ProjectorClient.tsx implements a self-contained, bilingual
 * fullscreen guidance overlay ("Press F11 for full screen · Tekan F11 untuk layar penuh")
 * with proper lifecycle (5s auto-dismiss, F11 keydown without preventDefault,
 * fullscreenchange event listener) and room-facing constraints (below blanking z-50,
 * pointer-events pass-through on container).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export function scanCongregationFullscreenGuidanceContract(content) {
  const findings = [];

  if (!/showHint/.test(content)) {
    findings.push('ProjectorClient.tsx must declare showHint state');
  }
  if (!content.includes('!document.fullscreenElement')) {
    findings.push('ProjectorClient.tsx must initialize showHint based on !document.fullscreenElement');
  }
  if (!content.includes('5000')) {
    findings.push('ProjectorClient.tsx must auto-dismiss hint after 5000ms');
  }
  if (!content.includes("e.key === 'F11'") && !content.includes('e.key === "F11"')) {
    findings.push('ProjectorClient.tsx must handle keydown event checking for F11');
  }
  if (/e\.preventDefault\(\)/.test(content) && content.includes('F11')) {
    findings.push('ProjectorClient.tsx must NOT preventDefault on F11 keydown');
  }
  if (!content.includes('fullscreenchange')) {
    findings.push('ProjectorClient.tsx must listen to fullscreenchange event');
  }
  if (!content.includes('Press F11 for full screen · Tekan F11 untuk layar penuh')) {
    findings.push('ProjectorClient.tsx must include bilingual guidance text: "Press F11 for full screen · Tekan F11 untuk layar penuh"');
  }
  if (!content.includes('<kbd') || !/F11\s*<\/kbd>/.test(content)) {
    findings.push('ProjectorClient.tsx must render <kbd>F11</kbd> shortcut tag');
  }
  if (!content.includes('z-40') && !content.includes('z-[40]')) {
    findings.push('ProjectorClient.tsx must position guidance overlay at z-40 (below z-50 blanking)');
  }
  if (!/showHint\s*&&\s*!blank/.test(content)) {
    findings.push('ProjectorClient.tsx must guard guidance overlay with showHint && !blank');
  }
  if (!content.includes('pointer-events-none') || !content.includes('pointer-events-auto')) {
    findings.push('ProjectorClient.tsx must use pointer-events-none on container and pointer-events-auto on interactive badge');
  }

  return findings;
}

test('SPEC-94-02: src/projected/ProjectorClient.tsx satisfies congregation F11 guidance contract', () => {
  const projectorPath = path.join(root, 'src', 'projected', 'ProjectorClient.tsx');
  const content = fs.readFileSync(projectorPath, 'utf8');
  const findings = scanCongregationFullscreenGuidanceContract(content);
  assert.deepEqual(findings, [], `Congregation F11 guidance contract findings:\n${findings.join('\n')}`);
});

test('SPEC-94-02: scanCongregationFullscreenGuidanceContract defect injection detects missing hint and event listeners', () => {
  const projectorPath = path.join(root, 'src', 'projected', 'ProjectorClient.tsx');
  const prodContent = fs.readFileSync(projectorPath, 'utf8');

  // Defect 1: missing showHint state
  const defectNoState = prodContent.replace(/showHint/g, 'otherState');
  const findings1 = scanCongregationFullscreenGuidanceContract(defectNoState);
  assert.ok(findings1.some(f => f.includes('showHint state')), 'must detect missing showHint state');

  // Defect 2: missing bilingual text
  const defectNoText = prodContent.replace('Press F11 for full screen · Tekan F11 untuk layar penuh', 'Full screen please');
  const findings2 = scanCongregationFullscreenGuidanceContract(defectNoText);
  assert.ok(findings2.some(f => f.includes('bilingual guidance text')), 'must detect missing bilingual text');

  // Defect 3: missing fullscreenchange listener
  const defectNoFsChange = prodContent.replace(/fullscreenchange/g, 'otherchange');
  const findings3 = scanCongregationFullscreenGuidanceContract(defectNoFsChange);
  assert.ok(findings3.some(f => f.includes('fullscreenchange')), 'must detect missing fullscreenchange listener');

  // Defect 4: missing F11 key listener
  const defectNoF11 = prodContent.replace(/e\.key === 'F11'/g, "e.key === 'F12'");
  const findings4 = scanCongregationFullscreenGuidanceContract(defectNoF11);
  assert.ok(findings4.some(f => f.includes('keydown event checking for F11')), 'must detect missing F11 keydown');

  // Defect 5: 5000ms timeout missing
  const defectNoTimeout = prodContent.replace(/5000/g, '3000');
  const findings5 = scanCongregationFullscreenGuidanceContract(defectNoTimeout);
  assert.ok(findings5.some(f => f.includes('5000ms')), 'must detect altered or missing 5000ms timeout');

  // Defect 6: preventDefault erroneously injected
  const defectWithPreventDefault = prodContent.replace("if (e.key === 'F11') {", "if (e.key === 'F11') {\n        e.preventDefault();");
  const findings6 = scanCongregationFullscreenGuidanceContract(defectWithPreventDefault);
  assert.ok(findings6.some(f => f.includes('must NOT preventDefault')), 'must detect preventDefault on F11 keydown');

  // Defect 7: missing !blank condition
  const defectNoBlankGuard = prodContent.replace(/showHint && !blank/g, 'showHint');
  const findings7 = scanCongregationFullscreenGuidanceContract(defectNoBlankGuard);
  assert.ok(findings7.some(f => f.includes('showHint && !blank')), 'must detect missing !blank guard');

  // Defect 8: missing pointer-events hierarchy
  const defectNoPointerHierarchy = prodContent.replace(/pointer-events-none/g, 'pointer-events-auto');
  const findings8 = scanCongregationFullscreenGuidanceContract(defectNoPointerHierarchy);
  assert.ok(findings8.some(f => f.includes('pointer-events-none on container')), 'must detect missing pointer-events-none on container');
});

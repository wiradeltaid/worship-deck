/**
 * SPEC-92-01: Desktop Win32 Window Icon Stamping and Taskbar Integration Contract Test
 *
 * Verifies that internal/desktop/window_windows.go declares the required Win32 icon
 * procedures and constants, accesses the underlying HWND from WebView2, loads the embedded
 * application icon resource (ID 1 from rsrc_windows_amd64.syso), and dispatches WM_SETICON
 * for both ICON_SMALL (title bar) and ICON_BIG (taskbar and Alt+Tab).
 *
 * Runtime Verification Procedure:
 * 1. Build desktop binary: `npm run prepare:desktop` (compiles cmd/api with rsrc_windows_amd64.syso).
 * 2. Execute `dist-desktop\worship-deck.exe --desktop`.
 * 3. Observe runtime window:
 *    - Top-left title bar displays the branded WorshipDeck icon instead of generic Win32 window icon.
 *    - Windows Taskbar and Alt+Tab switch list display the branded 32x32 WorshipDeck icon.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export function scanWindowIconContract(content) {
  const findings = [];

  if (!/kernel32\s*=\s*windows\.NewLazySystemDLL\("kernel32\.dll"\)/.test(content)) {
    findings.push('window_windows.go must declare kernel32 DLL');
  }
  if (!/procSendMessageW\s*=\s*user32\.NewProc\("SendMessageW"\)/.test(content)) {
    findings.push('window_windows.go must declare procSendMessageW = user32.NewProc("SendMessageW")');
  }
  if (!/procLoadIconW\s*=\s*user32\.NewProc\("LoadIconW"\)/.test(content)) {
    findings.push('window_windows.go must declare procLoadIconW = user32.NewProc("LoadIconW")');
  }
  if (!/procGetModuleHandleW\s*=\s*kernel32\.NewProc\("GetModuleHandleW"\)/.test(content)) {
    findings.push('window_windows.go must declare procGetModuleHandleW = kernel32.NewProc("GetModuleHandleW")');
  }
  if (!/WM_SETICON\s*=\s*0x0080|WM_SETICON\s*=\s*0x80/.test(content)) {
    findings.push('window_windows.go must declare WM_SETICON = 0x0080');
  }
  if (!/ICON_SMALL\s*=\s*0/.test(content)) {
    findings.push('window_windows.go must declare ICON_SMALL = 0');
  }
  if (!/ICON_BIG\s*=\s*1/.test(content)) {
    findings.push('window_windows.go must declare ICON_BIG = 1');
  }
  if (!content.includes('w.Window()')) {
    findings.push('window_windows.go must access window handle via w.Window()');
  }
  if (!content.includes('procLoadIconW.Call')) {
    findings.push('window_windows.go must load icon resource via procLoadIconW.Call');
  }
  if (!/procSendMessageW\.Call\(\s*hwnd\s*,\s*WM_SETICON\s*,\s*uintptr\(ICON_SMALL\)\s*,\s*hIcon\s*\)/.test(content)) {
    findings.push('window_windows.go must dispatch WM_SETICON with ICON_SMALL via procSendMessageW.Call');
  }
  if (!/procSendMessageW\.Call\(\s*hwnd\s*,\s*WM_SETICON\s*,\s*uintptr\(ICON_BIG\)\s*,\s*hIcon\s*\)/.test(content)) {
    findings.push('window_windows.go must dispatch WM_SETICON with ICON_BIG via procSendMessageW.Call');
  }

  return findings;
}

test('SPEC-92-01: internal/desktop/window_windows.go satisfies Win32 icon binding contract', () => {
  const windowPath = path.join(root, 'internal', 'desktop', 'window_windows.go');
  const content = fs.readFileSync(windowPath, 'utf8');
  const findings = scanWindowIconContract(content);
  assert.deepEqual(findings, [], `Win32 window icon contract findings:\n${findings.join('\n')}`);
});

test('SPEC-92-01: scanWindowIconContract defect injection detects missing Win32 icon declarations on production file', () => {
  const windowPath = path.join(root, 'internal', 'desktop', 'window_windows.go');
  const prodContent = fs.readFileSync(windowPath, 'utf8');

  // Defect 1: missing WM_SETICON
  const defectNoWmSetIcon = prodContent.replace('WM_SETICON = 0x0080', '');
  const findings1 = scanWindowIconContract(defectNoWmSetIcon);
  assert.ok(findings1.some(f => f.includes('WM_SETICON')), 'must detect missing WM_SETICON on production file');

  // Defect 2: missing procSendMessageW
  const defectNoSendMessage = prodContent.replace('procSendMessageW                  = user32.NewProc("SendMessageW")', '');
  const findings2 = scanWindowIconContract(defectNoSendMessage);
  assert.ok(findings2.some(f => f.includes('procSendMessageW')), 'must detect missing procSendMessageW on production file');

  // Defect 3: missing w.Window()
  const defectNoWindow = prodContent.replace('w.Window()', '0');
  const findings3 = scanWindowIconContract(defectNoWindow);
  assert.ok(findings3.some(f => f.includes('w.Window()')), 'must detect missing w.Window() on production file');

  // Defect 4: omitting ICON_SMALL dispatch
  const defectNoSmallIcon = prodContent.replace('procSendMessageW.Call(hwnd, WM_SETICON, uintptr(ICON_SMALL), hIcon)', '// omitted small icon');
  const findings4 = scanWindowIconContract(defectNoSmallIcon);
  assert.ok(findings4.some(f => f.includes('ICON_SMALL')), 'must detect missing ICON_SMALL dispatch on production file');

  // Defect 5: omitting ICON_BIG dispatch
  const defectNoBigIcon = prodContent.replace('procSendMessageW.Call(hwnd, WM_SETICON, uintptr(ICON_BIG), hIcon)', '// omitted big icon');
  const findings5 = scanWindowIconContract(defectNoBigIcon);
  assert.ok(findings5.some(f => f.includes('ICON_BIG')), 'must detect missing ICON_BIG dispatch on production file');
});

/**
 * SPEC-94-01: Desktop Win32 Immersive Dark Mode Title Bar Integration Contract Test
 *
 * Verifies that internal/desktop/window_windows.go declares the required DWM procedures
 * and constants, inspects Windows system theme preference via registry (AppsUseLightTheme),
 * falls back gracefully to light mode (false) if registry key is absent or errors,
 * implements SetWindowImmersiveDarkMode with attribute 20 (and 19 fallback), and
 * applies the dark mode attribute to the native Win32 window HWND on launch.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export function scanDesktopDarkModeTitlebarContract(content) {
  const findings = [];

  if (!/dwmapi\s*=\s*windows\.NewLazySystemDLL\("dwmapi\.dll"\)/.test(content)) {
    findings.push('window_windows.go must declare dwmapi DLL');
  }
  if (!/procDwmSetWindowAttribute\s*=\s*dwmapi\.NewProc\("DwmSetWindowAttribute"\)/.test(content)) {
    findings.push('window_windows.go must declare procDwmSetWindowAttribute = dwmapi.NewProc("DwmSetWindowAttribute")');
  }
  if (!/DWMWA_USE_IMMERSIVE_DARK_MODE\s*=\s*20/.test(content)) {
    findings.push('window_windows.go must declare DWMWA_USE_IMMERSIVE_DARK_MODE = 20');
  }
  if (!/DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1\s*=\s*19/.test(content)) {
    findings.push('window_windows.go must declare DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1 = 19');
  }
  if (!/func IsWindowsSystemDarkMode\(\)\s*bool/.test(content)) {
    findings.push('window_windows.go must declare func IsWindowsSystemDarkMode() bool');
  }
  if (!content.includes('AppsUseLightTheme')) {
    findings.push('window_windows.go must query AppsUseLightTheme from Personalize registry key');
  }
  if (!content.includes('Themes\\Personalize') && !content.includes('Themes\\\\Personalize')) {
    findings.push('window_windows.go must reference registry path Themes\\Personalize');
  }
  if (!/func SetWindowImmersiveDarkMode\(/.test(content)) {
    findings.push('window_windows.go must declare func SetWindowImmersiveDarkMode(hwnd uintptr, darkMode bool) error');
  }
  if (!content.includes('procDwmSetWindowAttribute.Call')) {
    findings.push('window_windows.go must call procDwmSetWindowAttribute.Call');
  }
  if (!/SetWindowImmersiveDarkMode\(\s*hwnd\s*,\s*isDark\s*\)/.test(content) &&
      !/SetWindowImmersiveDarkMode\(\s*hwnd\s*,\s*IsWindowsSystemDarkMode\(\)\s*\)/.test(content)) {
    findings.push('window_windows.go RunDesktopWindow must apply SetWindowImmersiveDarkMode to window HWND');
  }
  if (!/DwmSetWindowAttribute failed with HRESULT/.test(content)) {
    findings.push('window_windows.go SetWindowImmersiveDarkMode must return an error when both attribute 20 and 19 fail');
  }

  return findings;
}

test('SPEC-94-01: internal/desktop/window_windows.go satisfies Win32 dark mode title bar contract', () => {
  const windowPath = path.join(root, 'internal', 'desktop', 'window_windows.go');
  const content = fs.readFileSync(windowPath, 'utf8');
  const findings = scanDesktopDarkModeTitlebarContract(content);
  assert.deepEqual(findings, [], `Win32 dark mode title bar contract findings:\n${findings.join('\n')}`);
});

test('SPEC-94-01: scanDesktopDarkModeTitlebarContract defect injection detects missing DWM and registry declarations', () => {
  const windowPath = path.join(root, 'internal', 'desktop', 'window_windows.go');
  const prodContent = fs.readFileSync(windowPath, 'utf8');

  // Defect 1: missing dwmapi DLL declaration
  const defectNoDwmapi = prodContent.replace(/dwmapi\s*=\s*windows\.NewLazySystemDLL\("dwmapi\.dll"\)/, '');
  const findings1 = scanDesktopDarkModeTitlebarContract(defectNoDwmapi);
  assert.ok(findings1.some(f => f.includes('dwmapi DLL')), 'must detect missing dwmapi DLL');

  // Defect 2: missing DWMWA_USE_IMMERSIVE_DARK_MODE constant
  const defectNoConst = prodContent.replace(/DWMWA_USE_IMMERSIVE_DARK_MODE\s*=\s*20/, '');
  const findings2 = scanDesktopDarkModeTitlebarContract(defectNoConst);
  assert.ok(findings2.some(f => f.includes('DWMWA_USE_IMMERSIVE_DARK_MODE = 20')), 'must detect missing constant');

  // Defect 3: missing AppsUseLightTheme registry lookup
  const defectNoAppsUseLight = prodContent.replaceAll('AppsUseLightTheme', 'OtherKey');
  const findings3 = scanDesktopDarkModeTitlebarContract(defectNoAppsUseLight);
  assert.ok(findings3.some(f => f.includes('AppsUseLightTheme')), 'must detect missing AppsUseLightTheme lookup');

  // Defect 4: missing SetWindowImmersiveDarkMode invocation on hwnd
  const defectNoApply = prodContent.replace(/SetWindowImmersiveDarkMode\([^)]+\)/g, '');
  const findings4 = scanDesktopDarkModeTitlebarContract(defectNoApply);
  assert.ok(findings4.some(f => f.includes('SetWindowImmersiveDarkMode to window HWND')), 'must detect missing invocation on window HWND');

  // Defect 5: suppressed fallback failure
  const defectNoFallbackError = prodContent.replace(/DwmSetWindowAttribute failed with HRESULT/g, '');
  const findings5 = scanDesktopDarkModeTitlebarContract(defectNoFallbackError);
  assert.ok(findings5.some(f => f.includes('must return an error when both attribute 20 and 19 fail')), 'must detect suppressed fallback failure');
});

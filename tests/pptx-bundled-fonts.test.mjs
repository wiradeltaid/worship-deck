/**
 * SPEC-73: Offline PPTX font embedding from local bundled fonts (WSD-H-07)
 *
 * Enforces:
 * 1. embed-fonts.ts getFontData reads strictly from local data/fonts/ directory.
 * 2. getFontData makes zero network requests under any circumstance (proven by network trap).
 * 3. An offline export with a missing font family falls back strictly to bundled Inter.ttf.
 * 4. Zero network font fetching calls exist in src/lib/fonts/.
 * 5. Real-file defect injection proofs for network absence guard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const embedFontsUrl = pathToFileURL(path.join(root, 'src', 'lib', 'fonts', 'embed-fonts.ts')).href;
const { getFontData } = await import(embedFontsUrl);

test('WSD-H-07: getFontData resolves local font files from multiple categories without network calls', async () => {
  // Global network trap: any call to globalThis.fetch MUST fail the test
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error('NETWORK CALL DETECTED: Font embedding must be strictly offline');
  };

  try {
    const testFamilies = [
      'Inter',            // Sans
      'Roboto',           // Sans
      'Merriweather',     // Serif
      'Cinzel',           // Serif
      'Bebas Neue',       // Display
      'Righteous',        // Display
      'Great Vibes',      // Script
      'Pacifico',         // Script
    ];

    for (const fam of testFamilies) {
      const data = await getFontData(fam);
      assert.ok(data instanceof Buffer, `Expected Buffer for font ${fam}`);
      assert.ok(data.length > 1000, `Expected non-trivial font file for ${fam}, got ${data?.length} bytes`);
    }

    assert.equal(fetchCalled, false, 'No network fetch should have been attempted');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('SPEC-79: getFontData resolves new curated fonts and distinct bold variant buffers', async () => {
  const newFamilies = ['Plus Jakarta Sans', 'Fraunces', 'Source Serif 4', 'Calistoga', 'Cinzel Decorative', 'Syne'];
  for (const fam of newFamilies) {
    const regular = await getFontData(fam, 'normal');
    assert.ok(regular instanceof Buffer, `Expected regular buffer for ${fam}`);
    assert.ok(regular.length > 1000, `Expected non-trivial regular font file for ${fam}`);
  }

  const boldFamilies = ['Plus Jakarta Sans', 'Fraunces', 'Source Serif 4', 'Cinzel Decorative', 'Syne'];
  for (const fam of boldFamilies) {
    const regular = await getFontData(fam, 'normal');
    const bold = await getFontData(fam, 'bold');
    assert.ok(bold instanceof Buffer, `Expected bold buffer for ${fam}`);
    assert.notEqual(regular.length, bold.length, `Bold buffer for ${fam} must be distinct from regular`);
  }
});

test('WSD-H-07: missing font family falls back strictly to local bundled Inter without network calls', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error('NETWORK CALL DETECTED');
  };

  try {
    const data = await getFontData('NonExistentFontXYZ');
    assert.ok(data instanceof Buffer, 'Expected fallback font data buffer');
    assert.equal(fetchCalled, false, 'Missing font must not trigger network call');

    // Confirm the returned buffer matches data/fonts/Inter.ttf exactly
    const interBuf = fs.readFileSync(path.join(root, 'data', 'fonts', 'Inter.ttf'));
    assert.deepEqual(data, interBuf, 'Fallback font must match bundled Inter.ttf');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

export function scanNetworkFontCalls() {
  const violations = [];
  const target = path.join(root, 'src', 'lib', 'fonts', 'embed-fonts.ts');
  const content = fs.readFileSync(target, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check for fetch calls or font CDN URLs
    if (/\bfetch\s*\(/.test(line) && !line.trim().startsWith('//')) {
      violations.push(`src/lib/fonts/embed-fonts.ts:${i + 1}: network fetch call found: ${line.trim()}`);
    }
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(line) && !line.trim().startsWith('//')) {
      violations.push(`src/lib/fonts/embed-fonts.ts:${i + 1}: Google Font CDN reference found: ${line.trim()}`);
    }
  }
  return violations;
}

test('WSD-H-07: zero network font fetching calls exist in src/lib/fonts/embed-fonts.ts', () => {
  const violations = scanNetworkFontCalls();
  assert.deepEqual(violations, [], `Network font calls found:\n${violations.join('\n')}`);
});

test('WSD-H-07: guard proof — injected fetch in embed-fonts.ts is detected', () => {
  const target = path.join(root, 'src', 'lib', 'fonts', 'embed-fonts.ts');
  const original = fs.readFileSync(target, 'utf8');
  try {
    fs.writeFileSync(target, original + '\nconst leaked = await fetch("https://fonts.googleapis.com/css2");\n');
    const violations = scanNetworkFontCalls();
    assert.ok(
      violations.some((v) => v.includes('network fetch call found') || v.includes('Google Font CDN reference found')),
      'Injected fetch call in embed-fonts.ts must be detected'
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});
